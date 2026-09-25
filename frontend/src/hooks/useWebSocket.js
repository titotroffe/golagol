import { useEffect, useRef } from 'react';
import { useWsStore } from '../store';

const WS_URL = `ws://${window.location.host}/ws`;

let socketInstance = null;

export function useWebSocket(onEvento) {
  const setConectado = useWsStore((s) => s.setConectado);
  const setUltimoEvento = useWsStore((s) => s.setUltimoEvento);
  const callbackRef = useRef(onEvento);
  callbackRef.current = onEvento;

  useEffect(() => {
    if (socketInstance && socketInstance.readyState === WebSocket.OPEN) return;

    function conectar() {
      const ws = new WebSocket(WS_URL);
      socketInstance = ws;

      ws.onopen = () => {
        console.log('🟢 WebSocket conectado');
        setConectado(true);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          setUltimoEvento(msg);
          if (callbackRef.current) callbackRef.current(msg);
        } catch (_) {}
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket desconectado. Reintentando...');
        setConectado(false);
        socketInstance = null;
        setTimeout(conectar, 3000);
      };

      ws.onerror = () => ws.close();
    }

    conectar();
  }, []);
}

export function sendWsMessage(payload) {
  if (socketInstance?.readyState === WebSocket.OPEN) {
    socketInstance.send(JSON.stringify(payload));
  }
}
