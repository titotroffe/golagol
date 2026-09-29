import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { jugadoresApi } from '../../api';
import styles from './ModalJugador.module.css';

export default function ModalJugador({ jugadorId, dorsal, onClose }) {
  const cardRef = useRef(null);
  const [hoverProps, setHoverProps] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: 0 });

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

  const numero = dorsal || jugador?.numero_camiseta;

  const handleMove = (clientX, clientY) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Calcular rotación entre -20 y 20 grados
    const rx = ((y / rect.height) - 0.5) * -40; 
    const ry = ((x / rect.width) - 0.5) * 40;
    
    // Posición del resplandor (glare) en %
    const mx = (x / rect.width) * 100;
    const my = (y / rect.height) * 100;
    
    setHoverProps({ rx, ry, mx, my, active: 1 });
  };

  const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
  
  const handleTouchMove = (e) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleLeave = () => {
    // Volver a posición 0
    setHoverProps({ rx: 0, ry: 0, mx: 50, my: 50, active: 0 });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.btnClose} onClick={onClose}>×</button>
        
        {isLoading && <p className={styles.msg}>Cargando perfil...</p>}
        {error && <p className={styles.error}>Error al cargar jugador.</p>}
        
        {jugador && (
          <div 
            ref={cardRef}
            className={styles.elegantCard}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleLeave}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleLeave}
            style={{
              '--rx': `${hoverProps.rx}deg`,
              '--ry': `${hoverProps.ry}deg`,
              '--mx': `${hoverProps.mx}%`,
              '--my': `${hoverProps.my}%`,
              '--active': hoverProps.active,
              background: `linear-gradient(135deg, color-mix(in srgb, ${jugador.equipo_color_local || '#21262d'} 35%, rgba(255, 255, 255, 0.15)), color-mix(in srgb, ${jugador.equipo_color_visita || '#161b22'} 35%, rgba(255, 255, 255, 0.15)))`
            }}
          >
            
            {/* Holographic Glare Layer */}
            <div className={styles.holographicGlare}></div>
            
            {/* Header Gradient */}
            <div className={styles.cardHeader} style={{ background: 'transparent' }}>
              {numero && (
                <div className={styles.headerBadge}>
                  Nº {numero}
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
