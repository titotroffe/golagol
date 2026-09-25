import { useQuery } from '@tanstack/react-query';
import { torneosApi } from '../api';
import { useTorneoStore } from '../store';
import styles from './Tabla.module.css';

export default function Tabla() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);

  const { data: tabla, isLoading, error } = useQuery({
    queryKey: ['tabla', torneoActivo?.id],
    queryFn: () => torneosApi.tabla(torneoActivo.id),
    enabled: !!torneoActivo,
    refetchInterval: 30000,
  });

  if (!torneoActivo) return <p className={styles.msg}>Seleccioná un torneo</p>;
  if (isLoading)     return <p className={styles.msg}>Cargando tabla...</p>;
  if (error)         return <p className={styles.msgErr}>Error al cargar la tabla</p>;

  return (
    <div className={styles.wrap}>

      {/* Encabezado de sección */}
      <div className={styles.secHead}>
        <span className={styles.secTitle}>Tabla de posiciones</span>
        <span className={styles.secSub}>
          Desempate: puntos cara a cara · dif. goles · goles a favor
        </span>
      </div>

      {/* Tabla principal */}
      <div className={styles.tableOuter}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thPos}>#</th>
              <th className={styles.thEquipo}>Equipo</th>
              <th className={styles.thPts} title="Puntos">PTS.</th>
              <th className={styles.thNum} title="Partidos Jugados">PJ</th>
              <th className={styles.thNum} title="Partidos Ganados">PG</th>
              <th className={styles.thNum} title="Partidos Empatados">PE</th>
              <th className={styles.thNum} title="Partidos Perdidos">PP</th>
              <th className={styles.thNum} title="Goles a Favor">GF</th>
              <th className={styles.thNum} title="Goles en Contra">GC</th>
            </tr>
          </thead>
          <tbody>
            {tabla.map((eq, idx) => (
              <tr
                key={eq.equipo_id}
                className={styles.row}
              >
                <td className={`${styles.tdPos} ${idx < 8 ? styles.posPlayoff : ''}`}>
                  {eq.posicion}
                </td>

                <td className={styles.tdEquipo}>
                  <div className={styles.equipoWrap}>
                    {eq.escudo_url
                      ? <img src={eq.escudo_url} alt="" className={styles.escudo} />
                      : <span className={styles.escudoVacio} />
                    }
                    <span className={styles.equipoNombre}>{eq.nombre}</span>
                  </div>
                </td>

                <td className={styles.tdPts}>{eq.puntos}</td>
                <td>{eq.pj || 0}</td>
                <td>{eq.pg || 0}</td>
                <td>{eq.pe || 0}</td>
                <td>{eq.pp || 0}</td>
                <td>{eq.gf || 0}</td>
                <td>{eq.gc || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tabla.length === 0 && (
        <p className={styles.msg}>Aún no hay partidos cargados en este torneo.</p>
      )}

      {/* Leyenda */}
      {tabla.length > 0 && (
        <div className={styles.leyenda}>
          <span className={styles.leyendaItem}>
            <span className={styles.leyendaBadge}>1-8</span>
            Clasifican a play-offs
          </span>
        </div>
      )}
    </div>
  );
}
