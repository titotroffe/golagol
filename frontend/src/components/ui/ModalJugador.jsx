import { useQuery } from '@tanstack/react-query';
import { jugadoresApi } from '../../api';
import styles from './ModalJugador.module.css';

export default function ModalJugador({ jugadorId, dorsal, onClose }) {
  const { data: jugador, isLoading, error } = useQuery({
    queryKey: ['jugador', jugadorId],
    queryFn: () => jugadoresApi.obtenerPerfil(jugadorId),
    enabled: !!jugadorId,
  });

  let edad = null;
  if (jugador?.fecha_nacimiento) {
    const nac = new Date(jugador.fecha_nacimiento);
    if (!isNaN(nac.getTime())) {
      const diff = Date.now() - nac.getTime();
      edad = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }
  }

  // Usar el dorsal pasado por props (del partido), o el del jugador por defecto
  const numero = dorsal || jugador?.numero_camiseta;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.btnClose} onClick={onClose}>×</button>
        
        {isLoading && <p className={styles.msg}>Cargando perfil...</p>}
        {error && <p className={styles.error}>Error al cargar jugador.</p>}
        
        {jugador && (
          <div className={styles.elegantCard}>
            
            {/* Header Gradient */}
            <div className={styles.cardHeader}>
              {numero && (
                <div className={styles.headerBadge}>
                  DORSAL {numero}
                </div>
              )}
              <div className={styles.avatarWrapper}>
                <div className={styles.avatarCircle}>
                  {jugador.avatar_url ? (
                    <img src={`http://localhost:3001${jugador.avatar_url}`} alt="Avatar" className={styles.avatarImg} />
                  ) : (
                    <span>{jugador.nombre[0]}{jugador.apellido[0]}</span>
                  )}
                </div>
                {jugador.equipo_escudo && (
                  <img src={jugador.equipo_escudo} alt="Escudo" className={styles.escudoBadge} />
                )}
              </div>
            </div>

            {/* Body */}
            <div className={styles.cardBody}>
              <h2 className={styles.playerName}>
                {jugador.nombre} {jugador.apellido}
              </h2>
              
              <div className={styles.playerDetails}>
                <span>{jugador.posicion || 'Jugador'}</span>
                {edad && (
                  <>
                    <span className={styles.dot}></span>
                    <span>{edad} años</span>
                  </>
                )}
                <span className={styles.dot}></span>
                <span style={{ color: 'var(--primary-color, #8b949e)', fontWeight: 600 }}>{jugador.equipo_nombre}</span>
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{jugador.estadisticas.partidos_jugados || 0}</span>
                  <span className={styles.statLabel}>Partidos</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{jugador.estadisticas.goles || 0}</span>
                  <span className={styles.statLabel}>Goles</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue} style={{ color: '#e3b341' }}>{jugador.estadisticas.amarillas || 0}</span>
                  <span className={styles.statLabel}>Amarillas</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue} style={{ color: '#da3633' }}>{jugador.estadisticas.rojas || 0}</span>
                  <span className={styles.statLabel}>Rojas</span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
