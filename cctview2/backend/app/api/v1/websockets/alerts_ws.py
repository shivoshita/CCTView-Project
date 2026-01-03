"""
Instant alerts WebSocket

Broadcasts anomaly alerts to connected clients
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import logging

logger = logging.getLogger(__name__)


class AlertsConnectionManager:
	"""Manages WebSocket connections for anomaly alerts"""

	def __init__(self):
		self.active_connections: List[WebSocket] = []

	async def connect(self, websocket: WebSocket):
		await websocket.accept()
		self.active_connections.append(websocket)
		logger.info("✅ Alerts WebSocket connected")

	def disconnect(self, websocket: WebSocket):
		if websocket in self.active_connections:
			self.active_connections.remove(websocket)
		logger.info("❌ Alerts WebSocket disconnected")

	async def send_alert(self, data: dict):
		"""Broadcast alert to all connected clients"""
		if not self.active_connections:
			logger.warning(f"⚠️ No active WebSocket connections to send alert: {data.get('rule_name', 'Unknown')}")
			return
		logger.info(f"📤 Broadcasting alert to {len(self.active_connections)} client(s): {data.get('rule_name', 'Unknown')}")
		disconnected = []
		for connection in self.active_connections:
			try:
				await connection.send_json(data)
				logger.debug(f"✅ Alert sent to WebSocket client: {data.get('rule_name', 'Unknown')}")
			except Exception as e:
				logger.error(f"❌ Error sending alert to WebSocket: {e}", exc_info=True)
				disconnected.append(connection)
		for conn in disconnected:
			self.disconnect(conn)


# Singleton instance
alerts_manager = AlertsConnectionManager()