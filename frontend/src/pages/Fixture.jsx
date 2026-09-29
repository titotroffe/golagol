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
      <div className={styles.partidosGrid}>
        {loadingPartidos && <p className={styles.msg}>Cargando partidos...</p>}
        
        {!loadingPartidos && partidos?.length === 0 && (
          <p className={styles.msg}>No hay partidos cargados en esta fecha.</p>
        )}

        {!loadingPartidos && partidos?.map(p => {
          const date = p.fecha_hora ? new Date(p.fecha_hora) : null;
          const dia = date ? date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Pronto';
          const hora = date ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'A def.';

          return (
            <div key={p.id} className={styles.partidoCard}>
              <div className={styles.equiposContainer}>
                {/* Equipo Local */}
                <div className={styles.equipo}>
                  {p.local_escudo && <img src={p.local_escudo} alt="" className={styles.escudo} />}
                  <span className={styles.equipoNombre}>{p.local_nombre}</span>
                </div>

                {/* Marcador Central */}
                <div className={styles.marcadorWrapper}>
                  {p.estado === 'pendiente' ? (
                    <div className={styles.horaBadge}>
                      <span className={styles.dia}>{dia}</span>
                      <span className={styles.hora}>{hora}</span>
                    </div>
                  ) : (
                    <div className={styles.marcadorLive}>
                      <span>{p.goles_local}</span>
                      <span>-</span>
                      <span>{p.goles_visita}</span>
                    </div>
                  )}
                </div>

                {/* Equipo Visita */}
                <div className={styles.equipo}>
                  {p.visita_escudo && <img src={p.visita_escudo} alt="" className={styles.escudo} />}
                  <span className={styles.equipoNombre}>{p.visita_nombre}</span>
                </div>
              </div>

              {/* Extras Row */}
              <div className={styles.partidoFooter}>
                {p.estado === 'en_curso' && <span className={styles.enVivoBadge}>En vivo</span>}
                {p.estado === 'finalizado' && <span className={styles.finBadge}>Final</span>}
                {p.cancha && <span>🏟️ {p.cancha}</span>}
                {p.arbitro && <span>👤 {p.arbitro}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
