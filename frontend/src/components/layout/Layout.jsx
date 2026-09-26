import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useTorneoStore, useWsStore } from '../../store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { torneosApi } from '../../api';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Notificaciones from '../ui/Notificaciones';
import styles from './Layout.module.css';

const NAV_ITEMS = [
  { to: '/',             label: 'Tabla',        end: true },
  { to: '/fixture',      label: 'Fixture'                },
  { to: '/prode',        label: 'Prode'                  },
  { to: '/equipos',      label: 'Equipos'                },
  { to: '/estadisticas', label: 'Estadísticas'           },
  { to: '/sancionados',  label: 'Sancionados'            },
  { to: '/simular',      label: 'Simular tabla'          },
];
const ADMIN_ITEM = { to: '/admin', label: 'Admin' };

export default function Layout() {
  const { usuario, logout } = useAuthStore();
  const { torneoActivo, torneos, setTorneos, setTorneoActivo } = useTorneoStore();
  const conectado = useWsStore((s) => s.conectado);
  const navigate = useNavigate();
  const [userOpen, setUserOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: torneosData } = useQuery({
    queryKey: ['torneos'],
    queryFn: torneosApi.listar,
  });

  useEffect(() => {
    if (torneosData) setTorneos(torneosData);
  }, [torneosData]);

  useWebSocket(null);

  const esAdmin = ['admin', 'reportero'].includes(usuario?.rol);
  const navItems = esAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <div className={styles.app}>

      {/* ─── HEADER ─── */}
      <header className={styles.header}>

        {/* Fila 1: logo + estado + usuario */}
        <div className={styles.headerTop}>
          <div className={styles.logo}>
            <span className={styles.logoBall}></span>
            <span className={styles.logoText}>Liga Nicoleña</span>
          </div>

          <div className={styles.headerRight}>
            {/* Indicador live */}
            <div className={styles.liveIndicator}>
              <span className={conectado ? styles.dotVerde : styles.dotRojo} />
              <span className={styles.liveLabel}>{conectado ? 'En vivo' : 'Sin conexión'}</span>
            </div>

            {/* Menú usuario */}
            {usuario && (
              <div className={styles.userMenu}>
                <button
                  className={styles.userBtn}
                  onClick={() => setUserOpen((v) => !v)}
                  aria-label="Menú de usuario"
                >
                  <span className={styles.userAvatar}>
                    {usuario.nombre?.[0]}{usuario.apellido?.[0]}
                  </span>
                  <span className={styles.userName}>{usuario.nombre}</span>
                  <span className={styles.chevron}>{userOpen ? '▲' : '▼'}</span>
                </button>

                {userOpen && (
                  <>
                    <div className={styles.overlay} onClick={() => setUserOpen(false)} />
                    <div className={styles.dropdown}>
                      <div className={styles.dropInfo}>
                        <strong>{usuario.nombre} {usuario.apellido}</strong>
                        <small>@{usuario.usuario} · {usuario.rol}</small>
                      </div>
                      <button
                        className={styles.dropLogout}
                        onClick={() => { logout(); navigate('/login'); }}
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Burger Menu Button (Mobile Only) */}
            <button 
              className={styles.burgerBtn} 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menú principal"
            >
              ☰
            </button>
          </div>
        </div>



        {/* Fila 3: tabs de navegación (Desktop) */}
        <nav className={styles.navDesktop} aria-label="Navegación principal">
          <div className={styles.navScroll}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Menú Mobile Desplegable */}
        {mobileMenuOpen && (
          <nav className={styles.navMobile}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  isActive ? `${styles.mobileTab} ${styles.mobileTabActive}` : styles.mobileTab
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* ─── CONTENIDO ─── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Notificaciones en tiempo real */}
      <Notificaciones />
    </div>
  );
}
