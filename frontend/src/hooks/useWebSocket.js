import { useEffect, useRef } from 'react';
import { useWsStore, useNotificacionesStore } from '../store';

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.host}/ws`;

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

          // Verificar si hay que mostrar notificación
          const suscripciones = useNotificacionesStore.getState().suscripciones;
          if (msg.partido_id && suscripciones.includes(Number(msg.partido_id))) {
            if ('Notification' in window && Notification.permission === 'granted') {
              const titulo = '¡Gol a Gol Liga Nicoleña!';
              let cuerpo = `Actualización en el partido`;
              const e = msg.evento || msg;
              const jNombre = e.jugador_nombre ? `${e.jugador_nombre} ${e.jugador_apellido || ''}`.trim() : 'un jugador';
              
              if (e.tipo === 'GOL' || e.tipo === 'GOL_PENAL' || e.tipo === 'AUTOGOL') {
                cuerpo = `⚽ ¡GOL de ${e.equipo_nombre || 'un equipo'}!`;
              } else if (e.tipo === 'AMARILLA') {
                cuerpo = `🟨 Amarilla para ${jNombre}`;
              } else if (e.tipo === 'ROJA') {
                cuerpo = `🟥 Roja para ${jNombre}`;
              } else if (e.tipo === 'INICIO_PARTIDO') {
                cuerpo = `⚽ ¡Empezó el partido!`;
              } else if (e.tipo === 'FIN_PARTIDO') {
                cuerpo = `🏁 ¡Terminó el partido!`;
              }

              new Notification(titulo, { body: cuerpo });
            }
          }

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
