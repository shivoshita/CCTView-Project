import { useState, useEffect, useRef } from 'react';

const useCameraCaptions = (cameraId) => {
  const [captions, setCaptions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!cameraId) return;

    let isMounted = true; // Track if component is still mounted
    let ws = null;

    const connectWebSocket = () => {
      // Don't connect if component unmounted or already have a connection
      if (!isMounted || ws) return;

      const wsUrl = `ws://10.215.101.38:8000/api/v1/ws/camera/${cameraId}/captions`;
      
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) {
          ws.close();
          return;
        }
        console.log(`WebSocket connected for camera: ${cameraId}`);
        setIsConnected(true);
      };

      ws.onmessage = async (event) => {
        if (!isMounted) return;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'caption') {
            console.log('Received caption:', data);
            
            setCaptions(prev => {
              const newCaptions = [{
                id: data.event_id,
                text: data.caption,
                confidence: data.confidence,
                timestamp: new Date(data.timestamp),
                camera_id: data.camera_id
              }, ...prev];
              
              return newCaptions.slice(0, 10);
            });
            
            // Trigger anomaly check for this caption
            if (data.caption && data.camera_id) {
              try {
                const response = await fetch('http://10.215.101.38:8000/api/v1/anomaly-detection/check-caption', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    camera_id: data.camera_id,
                    caption: data.caption,
                    timestamp: data.timestamp,
                    confidence: data.confidence || 0.0
                  })
                });
                
                if (response.ok) {
                  const result = await response.json();
                  if (result.anomaly_detected) {
                    console.log('⚠️ Anomaly detected:', result.anomaly);
                  }
                }
              } catch (error) {
                console.error('Error checking for anomalies:', error);
              }
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (isMounted) {
          setIsConnected(false);
        }
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for camera: ${cameraId}`);
        if (isMounted) {
          setIsConnected(false);
        }
        ws = null;
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        }
      };
    };

    connectWebSocket();

    // Cleanup function - this runs BEFORE the second effect in StrictMode
    return () => {
      isMounted = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws) {
        console.log(`Cleaning up WebSocket for camera: ${cameraId}`);
        ws.close();
      }
    };
  }, [cameraId]);

  const clearCaptions = () => {
    setCaptions([]);
  };

  return { captions, isConnected, clearCaptions };
};

export default useCameraCaptions;