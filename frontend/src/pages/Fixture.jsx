import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { torneosApi, partidosApi } from '../api';
import { useTorneoStore } from '../store';
import styles from './Fixture.module.css';

export default function Fixture() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);

  const { data: fechas, isLoading: loadingFechas } = useQuery({
    queryKey: ['fechas', torneoActivo?.id],
    queryFn: () => torneosApi.fechas(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  // Automatically select the best "fecha" when loaded
  useEffect(() => {
    if (fechas && fechas.length > 0 && !selectedFecha) {
      // Find the first one that is not closed (or first overall)
      const pending = fechas.find(f => f.estado !== 'cerrada');
      setSelectedFecha(pending || fechas[0]);
    }
  }, [fechas, selectedFecha]);

  const { data: partidos, isLoading: loadingPartidos } = useQuery({
    queryKey: ['partidos', selectedFecha?.id],
    queryFn: () => partidosApi.porFecha(selectedFecha.id),
    enabled: !!selectedFecha,
    refetchInterval: 30000,
  });

  if (!torneoActivo) return <p className={styles.msg}>Seleccioná un torneo</p>;
  if (loadingFechas) return <p className={styles.msg}>Cargando fixture...</p>;

  return (
    <div className={styles.wrap}>
      <div className={styles.secHead}>
        <span className={styles.secTitle}>Fixture</span>
      </div>

      {/* Selector de Fechas (Pills horizontales) */}
      <div className={styles.fechasScroll}>
        <div className={styles.fechasTrack}>
          {fechas?.map(f => (
            <button
              key={f.id}
              className={`${styles.fechaPill} ${selectedFecha?.id === f.id ? styles.fechaActive : ''}`}
              onClick={() => setSelectedFecha(f)}
            >
              F{f.numero}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de partidos de la fecha */}
      <div className={styles.partidosList}>
        {loadingPartidos && <p className={styles.msg}>Cargando partidos...</p>}
        
        {!loadingPartidos && partidos?.length === 0 && (
          <p className={styles.msg}>No hay partidos cargados en esta fecha.</p>
        )}

        {!loadingPartidos && partidos?.map(p => (
          <div key={p.id} className={styles.partidoCard}>
            
            {/* Equipo Local */}
            <div className={`${styles.equipo} ${styles.equipoLocal}`}>
              <span className={styles.equipoNombre}>{p.local_nombre}</span>
              {p.local_escudo 
                ? <img src={p.local_escudo} alt="" className={styles.escudo} />
                : <span className={styles.escudoVacio} />
              }
            </div>

            {/* Marcador Central */}
            <div className={styles.marcadorCol}>
              {p.estado === 'pendiente' ? (
                <div className={styles.vsBlock}>
                  <span className={styles.vsText}>VS</span>
                  {p.fecha_hora && <span className={styles.horaText}>{new Date(p.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                </div>
              ) : (
                <div className={styles.golesBlock}>
                  <span className={`${styles.gol} ${p.goles_local > p.goles_visita ? styles.golGana : ''}`}>
                    {p.goles_local}
                  </span>
                  <span className={styles.golSep}>-</span>
                  <span className={`${styles.gol} ${p.goles_visita > p.goles_local ? styles.golGana : ''}`}>
                    {p.goles_visita}
                  </span>
                </div>
              )}
              {p.estado === 'en_curso' && <span className={styles.enVivoBadge}>En vivo</span>}
              {p.estado === 'finalizado' && <span className={styles.finBadge}>Final</span>}
            </div>

            {/* Equipo Visita */}
            <div className={`${styles.equipo} ${styles.equipoVisita}`}>
              {p.visita_escudo 
                ? <img src={p.visita_escudo} alt="" className={styles.escudo} />
                : <span className={styles.escudoVacio} />
              }
              <span className={styles.equipoNombre}>{p.visita_nombre}</span>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
