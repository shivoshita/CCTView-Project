//WebSocket connection management

class AlertsWebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.listeners = new Set();
    this.wsUrl = 'ws://10.215.101.38:8000/api/v1/ws/alerts';
  }

  connect() {
    if (this.ws || this.isConnected) return;
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('✅ Alerts WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          this.listeners.forEach((cb) => {
            try { 
              cb(data); 
            } catch (err) {
              console.error('Error in WebSocket listener:', err);
            }
          });
        } catch (e) {
          console.error('Error parsing WebSocket message:', e, event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('❌ Alerts WebSocket disconnected, will reconnect...');
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        try { this.ws && this.ws.close(); } catch (_) {}
      };
    } catch (_) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  onMessage(callback) {
    this.listeners.add(callback);
    this.connect();
    return () => this.listeners.delete(callback);
  }
}

const alertsWebSocket = new AlertsWebSocketService();

export default alertsWebSocket;