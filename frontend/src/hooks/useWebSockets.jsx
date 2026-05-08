import { useState, useEffect, useRef, useCallback } from "react";

export function useWebSocket(url, sessionId) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const isConnecting = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (isConnecting.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    isConnecting.current = true;
    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;
    
    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      isConnecting.current = false;
      setStatus("connected");
    };
    
    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      
      if (data.type === "history") {
        const hist = (data.messages || []).map((m, i) => ({
          id: `hist_${i}_${Date.now()}`,
          type: m.sender === "user" ? "user" : "bot",
          text: m.content || m.text || "",
          timestamp: m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "",
        }));
        setMessages(hist);
        return;
      }
      
      if (data.type === "bot") {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          type: "bot",
          text: data.text || "",
          timestamp: data.timestamp || "",
        }]);
      }
    };
    
    ws.onerror = () => { 
      isConnecting.current = false; 
      if (mountedRef.current) setStatus("error"); 
    };
    
    ws.onclose = () => {
      isConnecting.current = false;
      if (!mountedRef.current) return;
      setStatus("disconnected");
      clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const send = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        text,
        session_id: sessionId,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
    }
  }, [sessionId]);

  return { status, messages, send };
}