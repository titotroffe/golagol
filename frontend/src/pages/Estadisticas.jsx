import { useQuery } from "@tanstack/react-query";
import { torneosApi } from "../api";
import { useTorneoStore } from "../store";
import styles from "./Tabla.module.css";
import est from "./Estadisticas.module.css";

export default function Estadisticas() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);

  const { data: goleadores, isLoading: loadingGol } = useQuery({
    queryKey: ["goleadores", torneoActivo?.id],
    queryFn: () => torneosApi.goleadores(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  const { data: expulsados, isLoading: loadingExp } = useQuery({
    queryKey: ["expulsados", torneoActivo?.id],
    queryFn: () => torneosApi.expulsados(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  if (!torneoActivo) return <p className={styles.msg}>Selecciona un torneo</p>;

  return (
    <div className={est.wrap}>

      {/* Goleadores */}
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Goleadores</span>
          <span className={est.secSub}>Top anotadores del torneo</span>
        </div>

        {loadingGol && <p className={styles.msg}>Cargando...</p>}

        {!loadingGol && (!goleadores || goleadores.length === 0) && (
          <p className={styles.msg}>No hay goles registrados aun.</p>
        )}

        {!loadingGol && goleadores && goleadores.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thPos}>#</th>
                  <th className={est.thJugador}>Jugador</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum}>Goles</th>
                </tr>
              </thead>
              <tbody>
                {goleadores.map((j, idx) => (
                  <tr key={j.id} className={est.row}>
                    <td style={{
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '10px 6px',
                      color: idx === 0 ? '#d29922' : idx === 1 ? '#8b949e' : idx === 2 ? '#a0714f' : '#6e7681'
                    }}>
                      {idx + 1}
                    </td>
                    <td style={{padding: '10px'}}>
                      <div style={{fontWeight: 600}}>{j.nombre} {j.apellido}</div>
                      {j.numero_camiseta && (
                        <div style={{fontSize: '0.72rem', color: '#6e7681'}}>#{j.numero_camiseta}</div>
                      )}
                    </td>
                    <td style={{padding: '10px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        {j.escudo_url && (
                          <img src={j.escudo_url} alt="" style={{width: '18px', height: '18px', objectFit: 'contain'}} />
                        )}
                        <span>{j.equipo_nombre}</span>
                      </div>
                    </td>
                    <td style={{textAlign: 'center', padding: '10px'}}>
                      <span style={{
                        fontWeight: idx === 0 ? 900 : 700,
                        fontSize: idx === 0 ? '1.05rem' : '0.95rem',
                        color: idx === 0 ? '#d29922' : '#e6edf3'
                      }}>
                        {j.goles}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Expulsados */}
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Expulsados</span>
          <span className={est.secSub}>Jugadores con tarjeta roja en el torneo</span>
        </div>

        {loadingExp && <p className={styles.msg}>Cargando...</p>}

        {!loadingExp && (!expulsados || expulsados.length === 0) && (
          <p className={styles.msg}>No hay expulsados registrados.</p>
        )}

        {!loadingExp && expulsados && expulsados.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thJugador}>Jugador</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum}>Rojas</th>
                </tr>
              </thead>
              <tbody>
                {expulsados.map((j) => (
                  <tr key={j.id} className={est.row}>
                    <td style={{padding: '10px', fontWeight: 600}}>
                      {j.nombre} {j.apellido}
                    </td>
                    <td style={{padding: '10px'}}>
                      {j.equipo_nombre}
                    </td>
                    <td>
                      <span className={est.rojasBadge}>{j.cantidad_rojas}</span>
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