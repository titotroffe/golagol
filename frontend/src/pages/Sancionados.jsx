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


        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px', opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {!isLoading && (!sancionados || sancionados.length === 0) && (
          <p className={styles.msg}>No hay jugadores sancionados actualmente.</p>
        )}

        {!isLoading && sancionados && sancionados.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thJugador} style={{ width: '40%' }}>Jugador</th>
                  <th className={est.thEquipo} style={{ width: '30%' }}>Equipo</th>
                  <th className={est.thNum} title="Fechas a cumplir" style={{ textAlign: 'center', width: '10%' }}>
                    <span className={est.hideMobile}>Total</span>
                    <span className={est.showMobile}>Tot</span>
                  </th>
                  <th className={est.thNum} title="Fechas cumplidas" style={{ textAlign: 'center', width: '10%' }}>
                    <span className={est.hideMobile}>Cumplidas</span>
                    <span className={est.showMobile}>Cump</span>
                  </th>
                  <th className={est.thNum} title="Fechas restantes" style={{ textAlign: 'center', width: '10%' }}>
                    <span className={est.hideMobile}>Restan</span>
                    <span className={est.showMobile}>Rest</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sancionados.map((s) => (
                  <tr key={`${s.id}-${s.motivo}`} className={est.row}>
                    <td>
                      <div className={est.tdJugador}>
                        <span className={est.nombreJugador}>{s.nombre} {s.apellido}</span>
                      </div>
                    </td>
                    <td>
                      <div className={est.tdEquipo}>
                        {s.escudo_url && <img src={s.escudo_url} alt="" className={est.escudo} />}
                        <span className={est.equipoTextMobile}>{s.equipo_nombre}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{s.fechas_a_cumplir}</td>
                    <td style={{ textAlign: 'center' }}>{s.fechas_cumplidas}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={est.rojasBadge}>{s.fechas_restantes}</span>
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