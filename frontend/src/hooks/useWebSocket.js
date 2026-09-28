import { useEffect, useRef } from 'react';
import { useWsStore, useNotificacionesStore, useToastStore, useAuthStore } from '../store';
import { playWhistle, playGoal, playPop, initAudio } from '../utils/sounds';

// Activar audio en el primer click del usuario
if (typeof window !== 'undefined') {
  const init = () => {
    initAudio();
    window.removeEventListener('click', init);
    window.removeEventListener('touchstart', init);
  };
  window.addEventListener('click', init);
  window.addEventListener('touchstart', init);
}

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.host}/ws`;

let socketInstance = null;
const listeners = new Set();

export function useWebSocket(onEvento) {
  const setConectado = useWsStore((s) => s.setConectado);
  const setUltimoEvento = useWsStore((s) => s.setUltimoEvento);

  useEffect(() => {
    if (onEvento) {
      listeners.add(onEvento);
    }

    if (!socketInstance) {
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
              let cuerpo = `Actualización en el partido`;
              const evt = msg.evento || msg;
              const jNombre = evt.jugador_nombre ? `${evt.jugador_nombre} ${evt.jugador_apellido || ''}`.trim() : 'un jugador';
              
              const p = msg.partido;
              const resultadoStr = p ? ` (${p.local_nombre} ${p.goles_local} - ${p.goles_visita} ${p.visita_nombre})` : '';
              const minStr = evt.minuto ? ` al min ${evt.minuto}'` : '';
              
              if (evt.tipo === 'GOL' || evt.tipo === 'GOL_PENAL' || evt.tipo === 'AUTOGOL') {
                cuerpo = `⚽ ¡GOL de ${evt.equipo_nombre}${minStr}! Lo hizo ${jNombre}${resultadoStr}`;
                try { playGoal(); } catch(e){}
              } else if (evt.tipo === 'AMARILLA') {
                cuerpo = `🟨 Amarilla para ${jNombre}${minStr}`;
                try { playPop(); } catch(e){}
              } else if (evt.tipo === 'DOBLE_AMARILLA') {
                cuerpo = `🟥 ¡Doble amarilla y Expulsión para ${jNombre}${minStr}!`;
                try { playPop(); } catch(e){}
              } else if (evt.tipo === 'ROJA') {
                cuerpo = `🟥 ¡Roja directa para ${jNombre}${minStr}!`;
                try { playPop(); } catch(e){}
              } else if (evt.tipo === 'CAMBIO') {
                let entra = 'un jugador';
                try {
                  if (evt.detalle) entra = JSON.parse(evt.detalle).entra_nombre || entra;
                } catch(e) {}
                cuerpo = `🔄 Cambio${minStr}: Entra ${entra}, sale ${jNombre}`;
                try { playPop(); } catch(e){}
              } else if (evt.tipo === 'PENAL_A_FAVOR') {
                cuerpo = `⚠️ ¡Penal a favor de ${evt.equipo_nombre || 'un equipo'}${minStr}!`;
                try { playWhistle(); } catch(e){}
              } else if (evt.tipo === 'PENAL_ATAJADO') {
                cuerpo = `🧤 ¡Penal atajado a ${jNombre}${minStr}!`;
                try { playPop(); } catch(e){}
              } else if (evt.tipo === 'PENAL_ERRADO') {
                cuerpo = `❌ ¡Penal errado por ${jNombre}${minStr}!`;
                try { playPop(); } catch(e){}
              } else if (evt.tipo === 'INICIO_PARTIDO') {
                cuerpo = `⚽ ¡Empezó el partido!`;
                try { playWhistle(); } catch(e){}
              } else if (evt.tipo === 'FIN_1T') {
                cuerpo = `⏳ ¡Final del primer tiempo! Parcial: ${resultadoStr}`;
                try { playWhistle(); } catch(e){}
              } else if (evt.tipo === 'INICIO_2T') {
                cuerpo = `⚽ ¡Arrancó el segundo tiempo!`;
                try { playWhistle(); } catch(e){}
              } else if (evt.tipo === 'FIN_PARTIDO') {
                cuerpo = `🏁 ¡Terminó el partido! Final: ${resultadoStr}`;
                try { playWhistle(); } catch(e){}
                
                // Mostrar puntos prode
                const myUserId = useAuthStore.getState().usuario?.id;
                if (myUserId && msg.puntos_usuarios) {
                  const misPuntos = msg.puntos_usuarios.find(u => u.usuario_id === myUserId)?.puntos;
                  if (misPuntos !== undefined) {
                    if (misPuntos > 0) {
                      cuerpo += `\n🎯 ¡Sumaste ${misPuntos} puntos en el Prode!`;
                    } else {
                      cuerpo += `\n❌ No sumaste puntos en este partido.`;
                    }
                  }
                }
              }

              // Mostrar notificación in-app (Toast)
              useToastStore.getState().addToast(cuerpo);

              // Mostrar notificación de sistema (si hay permiso)
              if ('Notification' in window && Notification.permission === 'granted') {
                const titulo = '¡Gol a Gol Liga Nicoleña!';
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(titulo, { body: cuerpo, icon: '/favicon.svg' });
                  }).catch(() => {
                    try { new Notification(titulo, { body: cuerpo }); } catch (e) {}
                  });
                } else {
                  try { new Notification(titulo, { body: cuerpo }); } catch (e) {}
                }
              }
            }

            listeners.forEach(l => l(msg));
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
    }

    return () => {
      if (onEvento) {
        listeners.delete(onEvento);
      }
    };
  }, [onEvento, setConectado, setUltimoEvento]);
}

export function sendWsMessage(payload) {
  if (socketInstance?.readyState === WebSocket.OPEN) {
    socketInstance.send(JSON.stringify(payload));
  }
}
