import { useEffect, useState } from "react";
import { useWsStore } from "../../store";
import est from "../../pages/Estadisticas.module.css";

export default function Notificaciones() {
  const ultimoEvento = useWsStore((s) => s.ultimoEvento);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!ultimoEvento) return;

    const tipo = ultimoEvento.tipo;
    // Solo mostrar eventos relevantes como notificaciones
    const tiposNotificar = ["GOL", "GOL_PENAL", "ROJA", "FIN_1T", "FIN_PARTIDO", "INICIO_PARTIDO", "INICIO_2T"];
    if (!tiposNotificar.includes(tipo)) return;

    let titulo = "";
    let cuerpo = "";
    let clase = "";

    const equipo = ultimoEvento.equipo_nombre || ultimoEvento.equipo_id || "";
    const jugador = ultimoEvento.jugador_nombre || ultimoEvento.jugador_apellido || "";

    if (tipo === "GOL" || tipo === "GOL_PENAL") {
      titulo = "Gol";
      cuerpo = jugador ? `${jugador}${equipo ? " (" + equipo + ")" : ""}` : equipo;
      clase = est.notifGol;
    } else if (tipo === "ROJA") {
      titulo = "Expulsado";
      cuerpo = jugador ? `${jugador}${equipo ? " (" + equipo + ")" : ""}` : equipo;
      clase = est.notifRoja;
    } else if (tipo === "INICIO_PARTIDO") {
      titulo = "Inicio del partido";
      cuerpo = "Primer tiempo en curso";
    } else if (tipo === "INICIO_2T") {
      titulo = "Segundo tiempo";
      cuerpo = "Comenzo el segundo tiempo";
    } else if (tipo === "FIN_1T") {
      titulo = "Fin del primer tiempo";
      cuerpo = "";
    } else if (tipo === "FIN_PARTIDO") {
      titulo = "Partido finalizado";
      cuerpo = "";
    }

    if (!titulo) return;

    const id = Date.now();
    setNotifs(prev => [...prev, { id, titulo, cuerpo, clase }]);

    // Auto-eliminar tras 5 segundos
    setTimeout(() => {
      setNotifs(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, [ultimoEvento]);

  if (notifs.length === 0) return null;

  return (
    <div className={est.notifContainer}>
      {notifs.map(n => (
        <div key={n.id} className={`${est.notif} ${n.clase || ""}`}>
          <div className={est.notifTitle}>{n.titulo}</div>
          {n.cuerpo && <div className={est.notifBody}>{n.cuerpo}</div>}
        </div>
      ))}
    </div>
  );
}