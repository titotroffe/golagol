import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { torneosApi } from '../api';
import { useTorneoStore } from '../store';
import { Link } from 'react-router-dom';
import styles from './Inicio.module.css';

export default function Inicio() {
  const { torneoActivo } = useTorneoStore();
  const [suscripciones, setSuscripciones] = useState(new Set());

  const toggleSuscripcion = (id) => {
    setSuscripciones(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['inicio', torneoActivo?.id],
    queryFn: () => torneosApi.inicio(torneoActivo.id),
    enabled: !!torneoActivo,
    refetchInterval: 30000 // Refrescar cada 30 segundos
  });

  if (!torneoActivo) return <p className={styles.msg}>Seleccioná un torneo.</p>;
  if (isLoading) return <p className={styles.msg}>Cargando inicio...</p>;
  if (error) return <p className={styles.msg}>Error al cargar datos.</p>;

  const { enVivo, proximos } = data;

  return (
    <div className={styles.wrap}>
      {/* SECCIÓN EN VIVO */}
      {enVivo && enVivo.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.liveDot}></span>
            <h2 className={styles.sectionTitle}>En Vivo</h2>
          </div>
          <div className={styles.partidosGrid}>
            {enVivo.map((p) => (
              <div key={p.id} className={`${styles.partidoCard} ${styles.liveCard}`}>
                <div className={styles.fechaBadge}>Fecha {p.fecha_numero}</div>
                <div className={styles.equiposContainer}>
                  <div className={styles.equipo}>
                    {p.local_escudo && <img src={p.local_escudo} alt="" className={styles.escudo} />}
                    <span className={styles.equipoNombre}>{p.local_nombre}</span>
                  </div>
                  <div className={styles.marcadorWrapper}>
                    <div className={styles.marcadorLive}>
                      <span>{p.goles_local ?? 0}</span>
                      <span>-</span>
                      <span>{p.goles_visita ?? 0}</span>
                    </div>
                  </div>
                  <div className={styles.equipo}>
                    {p.visita_escudo && <img src={p.visita_escudo} alt="" className={styles.escudo} />}
                    <span className={styles.equipoNombre}>{p.visita_nombre}</span>
                  </div>
                </div>
                <Link to={`/admin/partido/${p.id}`} className={styles.btnVer}>Ver Minuto a Minuto</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECCIÓN PRÓXIMOS PARTIDOS */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Próximos Partidos</h2>
        {proximos && proximos.length > 0 ? (
          <div className={styles.partidosGrid}>
            {proximos.map((p) => {
              const date = new Date(p.fecha_hora);
              const dia = date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
              const hora = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
              const estaSuscrito = suscripciones.has(p.id);

              return (
                <div key={p.id} className={styles.partidoCard}>
                  <div className={styles.fechaBadge}>Fecha {p.fecha_numero}</div>
                  
                  <button 
                    className={`${styles.btnCampana} ${estaSuscrito ? styles.campanaActiva : ''}`}
                    onClick={() => toggleSuscripcion(p.id)}
                    title={estaSuscrito ? "Desactivar notificaciones" : "Recibir notificaciones"}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      {estaSuscrito && <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2" stroke="currentColor"></line>}
                    </svg>
                  </button>

                  <div className={styles.equiposContainer}>
                    <div className={styles.equipo}>
                      {p.local_escudo && <img src={p.local_escudo} alt="" className={styles.escudo} />}
                      <span className={styles.equipoNombre}>{p.local_nombre}</span>
                    </div>
                    <div className={styles.marcadorWrapper}>
                      <div className={styles.horaBadge}>
                        <span className={styles.dia}>{dia}</span>
                        <span className={styles.hora}>{hora}</span>
                      </div>
                    </div>
                    <div className={styles.equipo}>
                      {p.visita_escudo && <img src={p.visita_escudo} alt="" className={styles.escudo} />}
                      <span className={styles.equipoNombre}>{p.visita_nombre}</span>
                    </div>
                  </div>
                  {p.cancha && <div className={styles.canchaInfo}>📍 {p.cancha}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.noData}>No hay partidos programados próximamente.</p>
        )}
      </section>
    </div>
  );
}
