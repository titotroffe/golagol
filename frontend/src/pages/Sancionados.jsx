import { useQuery } from "@tanstack/react-query";
import { torneosApi } from "../api";
import { useTorneoStore } from "../store";
import styles from "./Tabla.module.css";
import est from "./Estadisticas.module.css";

export default function Sancionados() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);

  const { data: sancionados, isLoading } = useQuery({
    queryKey: ["sancionados", torneoActivo?.id],
    queryFn: () => torneosApi.sancionados(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  if (!torneoActivo) return <p className={styles.msg}>Selecciona un torneo</p>;

  return (
    <div className={est.wrap}>
      <section className={est.section}>


        {isLoading && <p className={styles.msg}>Cargando...</p>}

        {!isLoading && (!sancionados || sancionados.length === 0) && (
          <p className={styles.msg}>No hay jugadores sancionados actualmente.</p>
        )}

        {!isLoading && sancionados && sancionados.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thJugador} style={{ width: '28%' }}>Jugador</th>
                  <th className={est.thEquipo} style={{ width: '22%' }}>Equipo</th>
                  <th className={est.thNum} title="Fechas a cumplir" style={{ textAlign: 'center', width: '9%' }}>Total</th>
                  <th className={est.thNum} title="Fechas cumplidas" style={{ textAlign: 'center', width: '12%' }}>Cumplidas</th>
                  <th className={est.thNum} title="Fechas restantes" style={{ textAlign: 'center', width: '9%' }}>Restan</th>
                  <th className={est.thMotivo} style={{ width: '20%' }}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {sancionados.map((s) => (
                  <tr key={`${s.id}-${s.motivo}`} className={est.row}>
                    <td style={{ padding: '10px' }}>
                      <div className={est.tdJugador}>
                        <span className={est.nombreJugador}>{s.nombre} {s.apellido}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div className={est.tdEquipo}>
                        {s.escudo_url && <img src={s.escudo_url} alt="" className={est.escudo} />}
                        <span>{s.equipo_nombre}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{s.fechas_a_cumplir}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{s.fechas_cumplidas}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span className={est.rojasBadge}>{s.fechas_restantes}</span>
                    </td>
                    <td className={est.tdMotivo} style={{ padding: '10px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                      {s.motivo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}