"""
Notification Service

Delivers anomaly alerts via configured channels (currently: SMS via Twilio).
Looks up enabled `NotificationChannel` nodes in Neo4j and dispatches messages
based on their configuration.
"""

import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.config import settings
from app.db.neo4j.client import neo4j_client

logger = logging.getLogger(__name__)


class NotificationService:
    """Coordinates alert delivery across channels."""

    def __init__(self):
        self.twilio_available = False
        try:
            # Lazy check; actual import done when sending
            import twilio  # type: ignore
            self.twilio_available = True
        except Exception:
            # Library might not be installed; we'll log a warning at send time
            self.twilio_available = False

    async def deliver_alerts(self, anomaly: Dict[str, Any]) -> None:
        """
        Deliver alert via all enabled channels (subset implemented: SMS).

        Args:
            anomaly: Dict containing anomaly details (camera_id, rule info, etc.)
        """
        try:
            logger.info(f"📨 Delivering alerts for anomaly: {anomaly.get('rule_name', 'Unknown')}")
            channels = await self._get_enabled_channels()
            if not channels:
                logger.warning("⚠️ No enabled notification channels configured - alerts will not be sent")
                return

            logger.info(f"📋 Found {len(channels)} enabled notification channel(s)")

            # Fetch camera details for richer messages
            camera = await self._get_camera(anomaly.get("camera_id"))
            camera_name = camera.get("name") if camera else anomaly.get("camera_id")
            camera_location = camera.get("location") if camera else "Unknown"

            for ch in channels:
                channel_type = (ch.get("channel_type") or "").lower()
                config = ch.get("config") or {}
                logger.debug(f"📬 Processing channel: {ch.get('name')} (type: {channel_type})")
                
                if channel_type == "sms":
                    logger.info(f"📱 Sending SMS via channel: {ch.get('name')}")
                    await self._send_sms_via_twilio(
                        config=config,
                        anomaly=anomaly,
                        camera_name=camera_name,
                        camera_location=camera_location,
                    )
                # Other channels (email, push, webhook) can be added here

        except Exception as e:
            logger.error(f"❌ Notification delivery failed: {e}", exc_info=True)

    async def _get_enabled_channels(self) -> List[Dict[str, Any]]:
        """Return enabled NotificationChannel nodes from Neo4j."""
        try:
            query = (
                "MATCH (nc:NotificationChannel)\n"
                "WHERE nc.enabled = true\n"
                "RETURN nc"
            )
            results = await neo4j_client.async_execute_query(query)
            channels: List[Dict[str, Any]] = []
            logger.debug(f"Found {len(results)} enabled notification channels in Neo4j")
            
            for rec in results:
                nc = dict(rec["nc"]) if isinstance(rec, dict) else dict(rec[0])
                
                # Parse config from JSON string if needed (Neo4j stores JSON as strings)
                config = nc.get("config") or {}
                if isinstance(config, str):
                    try:
                        config = json.loads(config)
                    except (json.JSONDecodeError, TypeError):
                        logger.warning(f"Failed to parse config JSON for channel {nc.get('id')}: {config}")
                        config = {}
                
                # Parse filters from JSON string if needed
                filters = nc.get("filters") or {}
                if isinstance(filters, str):
                    try:
                        filters = json.loads(filters)
                    except (json.JSONDecodeError, TypeError):
                        logger.warning(f"Failed to parse filters JSON for channel {nc.get('id')}: {filters}")
                        filters = {}
                
                channel_data = {
                    "id": nc.get("id"),
                    "name": nc.get("name"),
                    "channel_type": nc.get("channel_type"),
                    "config": config,
                    "filters": filters,
                }
                logger.debug(f"Channel loaded: {channel_data.get('name')} (type: {channel_data.get('channel_type')}, enabled: {nc.get('enabled')})")
                channels.append(channel_data)
            
            logger.info(f"✅ Loaded {len(channels)} enabled notification channel(s)")
            return channels
        except Exception as e:
            logger.error(f"❌ Failed to read channels: {e}", exc_info=True)
            return []

    async def _get_camera(self, camera_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not camera_id:
            return None
        try:
            res = await neo4j_client.async_execute_query(
                "MATCH (c:Camera {id: $id}) RETURN c",
                {"id": camera_id},
            )
            if not res:
                return None
            return dict(res[0]["c"]) if isinstance(res[0], dict) else dict(res[0][0])
        except Exception:
            return None

    async def _send_sms_via_twilio(
        self,
        *,
        config: Dict[str, Any],
        anomaly: Dict[str, Any],
        camera_name: str,
        camera_location: str,
    ) -> None:
        """Send SMS messages using Twilio to configured phone numbers."""
        try:
            # Ensure config is a dict (should already be parsed in _get_enabled_channels, but double-check)
            if not isinstance(config, dict):
                if isinstance(config, str):
                    try:
                        config = json.loads(config)
                    except (json.JSONDecodeError, TypeError):
                        logger.warning("Config for SMS channel is a string but not valid JSON; skipping")
                        return
                else:
                    logger.warning(f"Config for SMS channel is not a dict or string: {type(config)}; skipping")
                    return

            phone_numbers: List[str] = config.get("phone_numbers") or []
            if not phone_numbers:
                return

            if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER):
                logger.warning("Twilio credentials not configured; skipping SMS delivery (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)")
                return

            try:
                from twilio.rest import Client  # type: ignore
            except Exception as imp_err:
                logger.warning(f"Twilio SDK not available ({imp_err}); skipping SMS delivery")
                return

            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            # Compose concise message (keep within SMS limits)
            detected_at = anomaly.get("timestamp") or datetime.now().isoformat()
            severity = (anomaly.get("severity") or "medium").upper()
            rule_name = anomaly.get("rule_name") or anomaly.get("rule_type") or "Anomaly"
            caption = anomaly.get("caption") or ""
            caption_short = caption[:120] + ("..." if len(caption) > 120 else "")

            body = (
                f"[{severity}] {rule_name} at {camera_name} ({camera_location})\n"
                f"Time: {detected_at}\n"
                f"Details: {caption_short}"
            )

            # Support either Messaging Service SID (preferred) or From Number
            messaging_service_sid: Optional[str] = None
            try:
                messaging_service_sid = config.get("messaging_service_sid")
            except Exception:
                messaging_service_sid = None

            for to_number in phone_numbers:
                try:
                    msg_kwargs: Dict[str, Any] = {
                        "body": body,
                        "to": to_number,
                    }
                    if messaging_service_sid:
                        msg_kwargs["messaging_service_sid"] = messaging_service_sid
                    else:
                        msg_kwargs["from_"] = settings.TWILIO_FROM_NUMBER

                    message = client.messages.create(**msg_kwargs)
                    logger.info(f"SMS queued to {to_number} (sid={message.sid})")
                except Exception as send_err:
                    logger.error(f"Failed to send SMS to {to_number}: {send_err}")

        except Exception as e:
            logger.error(f"Twilio SMS delivery error: {e}", exc_info=True)


# Singleton
notification_service = NotificationService()
