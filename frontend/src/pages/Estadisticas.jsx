import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { torneosApi } from "../api";
import { useTorneoStore } from "../store";
import styles from "./Tabla.module.css";
import est from "./Estadisticas.module.css";
import prodeStyles from "./Prode.module.css";

export default function Estadisticas() {
  const [tab, setTab] = useState('goleadores');
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

  const { data: tabla, isLoading: loadingTabla } = useQuery({
    queryKey: ['tabla-est', torneoActivo?.id],
    queryFn: () => torneosApi.tabla(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  if (!torneoActivo) return <p className={styles.msg}>Selecciona un torneo</p>;

  const equiposGoleadores = tabla ? [...tabla].sort((a, b) => b.gf - a.gf).slice(0, 5) : [];
  const equiposMenosVencidos = tabla ? [...tabla].filter(e => e.pj > 0).sort((a, b) => a.gc - b.gc).slice(0, 5) : [];
  
  const equiposConMasExpulsados = (() => {
    if (!expulsados) return [];
    const counts = {};
    expulsados.forEach(j => {
      if (!counts[j.equipo_nombre]) {
        counts[j.equipo_nombre] = { nombre: j.equipo_nombre, escudo_url: j.escudo_url, rojas: 0 };
      }
      counts[j.equipo_nombre].rojas += j.cantidad_rojas;
    });
    return Object.values(counts)
      .filter(e => e.rojas > 0)
      .sort((a,b) => b.rojas - a.rojas)
      .slice(0, 5);
  })();

  return (
    <div className={est.wrap}>

      <div className={prodeStyles.fechasScroll}>
        <div className={prodeStyles.fechasTrack}>
          <button 
            className={`${prodeStyles.fechaPill} ${tab === 'goleadores' ? prodeStyles.fechaActive : ''}`}
            onClick={() => setTab('goleadores')}
          >Goleadores</button>
          <button 
            className={`${prodeStyles.fechaPill} ${tab === 'expulsados' ? prodeStyles.fechaActive : ''}`}
            onClick={() => setTab('expulsados')}
          >Expulsados</button>
          <button 
            className={`${prodeStyles.fechaPill} ${tab === 'mas_expulsados' ? prodeStyles.fechaActive : ''}`}
            onClick={() => setTab('mas_expulsados')}
          >Más Expulsados</button>
          <button 
            className={`${prodeStyles.fechaPill} ${tab === 'mas_goleador' ? prodeStyles.fechaActive : ''}`}
            onClick={() => setTab('mas_goleador')}
          >Más Goleador</button>
          <button 
            className={`${prodeStyles.fechaPill} ${tab === 'menos_vencido' ? prodeStyles.fechaActive : ''}`}
            onClick={() => setTab('menos_vencido')}
          >Menos Vencido</button>
        </div>
      </div>

      {tab === 'goleadores' && (
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
      )}

      {tab === 'expulsados' && (
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
                  <th className={est.thPos}>#</th>
                  <th className={est.thJugador}>Jugador</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum}>Rojas</th>
                </tr>
              </thead>
              <tbody>
                {expulsados.map((j, idx) => (
                  <tr key={j.id} className={est.row}>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.8rem', padding: '10px 6px', color: idx === 0 ? '#d29922' : idx === 1 ? '#8b949e' : idx === 2 ? '#a0714f' : '#6e7681' }}>
                      {idx + 1}
                    </td>
                    <td style={{padding: '10px', fontWeight: 600}}>
                      {j.nombre} {j.apellido}
                    </td>
                    <td style={{padding: '10px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        {j.escudo_url && (
                          <img src={j.escudo_url} alt="" style={{width: '18px', height: '18px', objectFit: 'contain'}} />
                        )}
                        <span>{j.equipo_nombre}</span>
                      </div>
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={est.rojasBadge}>{j.cantidad_rojas}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {tab === 'mas_expulsados' && (
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Equipos Más Expulsados</span>
          <span className={est.secSub}>Clubes con más tarjetas rojas en el torneo</span>
        </div>

        {loadingExp && <p className={styles.msg}>Cargando...</p>}

        {!loadingExp && equiposConMasExpulsados.length === 0 && (
          <p className={styles.msg}>No hay expulsados registrados.</p>
        )}

        {!loadingExp && equiposConMasExpulsados.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thPos}>#</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum}>Rojas</th>
                </tr>
              </thead>
              <tbody>
                {equiposConMasExpulsados.map((e, idx) => (
                  <tr key={e.nombre} className={est.row}>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.8rem', padding: '10px 6px', color: idx === 0 ? '#d29922' : idx === 1 ? '#8b949e' : idx === 2 ? '#a0714f' : '#6e7681' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {e.escudo_url && <img src={e.escudo_url} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />}
                        <span style={{ fontWeight: 600 }}>{e.nombre}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#f85149' }}>
                      <span className={est.rojasBadge}>{e.rojas}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {tab === 'mas_goleador' && (
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Equipos Más Goleadores</span>
          <span className={est.secSub}>Clubes con más goles a favor</span>
        </div>

        {loadingTabla && <p className={styles.msg}>Cargando...</p>}

        {!loadingTabla && equiposGoleadores.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thPos}>#</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum}>GF</th>
                </tr>
              </thead>
              <tbody>
                {equiposGoleadores.map((e, idx) => (
                  <tr key={e.equipo_id} className={est.row}>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.8rem', padding: '10px 6px', color: idx === 0 ? '#d29922' : idx === 1 ? '#8b949e' : idx === 2 ? '#a0714f' : '#6e7681' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {e.escudo_url && <img src={e.escudo_url} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />}
                        <span style={{ fontWeight: 600 }}>{e.nombre}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontWeight: idx === 0 ? 900 : 700,
                        fontSize: idx === 0 ? '1.05rem' : '0.95rem',
                        color: '#3fb950'
                      }}>
                        {e.gf}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {tab === 'menos_vencido' && (
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Valla Menos Vencida</span>
          <span className={est.secSub}>Clubes con menos goles en contra</span>
        </div>

        {loadingTabla && <p className={styles.msg}>Cargando...</p>}

        {!loadingTabla && equiposMenosVencidos.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thPos}>#</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum}>GC</th>
                </tr>
              </thead>
              <tbody>
                {equiposMenosVencidos.map((e, idx) => (
                  <tr key={e.equipo_id} className={est.row}>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.8rem', padding: '10px 6px', color: idx === 0 ? '#d29922' : idx === 1 ? '#8b949e' : idx === 2 ? '#a0714f' : '#6e7681' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {e.escudo_url && <img src={e.escudo_url} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />}
                        <span style={{ fontWeight: 600 }}>{e.nombre}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontWeight: idx === 0 ? 900 : 700,
                        fontSize: idx === 0 ? '1.05rem' : '0.95rem',
                        color: '#f85149'
                      }}>
                        {e.gc}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

    </div>
  );
}