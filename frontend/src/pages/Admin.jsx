import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { torneosApi, partidosApi, equiposApi } from '../api';
import { useTorneoStore, useAuthStore } from '../store';
import { Navigate, Link } from 'react-router-dom';
import AdminHistorico from './AdminHistorico';
import styles from './Admin.module.css';

function PartidoAdminCard({ partido }) {
  const queryClient = useQueryClient();
  const [localStr, setLocalStr] = useState('');
  const [visitaStr, setVisitaStr] = useState('');
  const [showEventos, setShowEventos] = useState(false);
  const [nuevoGolLocal, setNuevoGolLocal] = useState('');
  const [nuevoGolVisita, setNuevoGolVisita] = useState('');

  // Sincronizar estado local
  useEffect(() => {
    if (partido.goles_local != null) setLocalStr(partido.goles_local.toString());
    if (partido.goles_visita != null) setVisitaStr(partido.goles_visita.toString());
  }, [partido]);

  const handleLocalChange = (e) => {
    const val = e.target.value;
    if (val === '') { setLocalStr(''); return; }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 99) setLocalStr(num.toString());
  };

  const handleVisitaChange = (e) => {
    const val = e.target.value;
    if (val === '') { setVisitaStr(''); return; }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 99) setVisitaStr(num.toString());
  };

  const { data: plantelLocal } = useQuery({
    queryKey: ['plantel', partido.equipo_local_id],
    queryFn: () => equiposApi.plantel(partido.equipo_local_id),
    enabled: showEventos,
  });

  const { data: plantelVisita } = useQuery({
    queryKey: ['plantel', partido.equipo_visita_id],
    queryFn: () => equiposApi.plantel(partido.equipo_visita_id),
    enabled: showEventos,
  });

  const cargarResultadoMut = useMutation({
    mutationFn: (body) => partidosApi.cargarResultado(partido.id, body),
    onSuccess: () => {
      // Invalidate to refresh this fecha matches
      queryClient.invalidateQueries(['partidosAdmin', partido.fecha_id]);
      alert('Resultado cargado y puntos del Prode calculados correctamente.');
    },
    onError: (err) => {
      alert('Error: ' + err.message);
    }
  });

  const agregarEventoMut = useMutation({
    mutationFn: (body) => partidosApi.registrarEvento(partido.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['partidosAdmin', partido.fecha_id]);
      setNuevoGolLocal('');
      setNuevoGolVisita('');
    },
    onError: (err) => alert('Error al agregar gol: ' + err.message)
  });

  const handleAddGol = (isLocal) => {
    const nombre = isLocal ? nuevoGolLocal : nuevoGolVisita;
    if (!nombre.trim()) return;

    agregarEventoMut.mutate({
      tipo: 'GOL',
      equipo_id: isLocal ? partido.equipo_local_id : partido.equipo_visita_id,
      jugador_nombre: nombre,
    });
  };

  const handleCargarResultado = () => {
    if (localStr === '' || visitaStr === '') {
      alert('Faltan cargar goles.');
      return;
    }
    if (window.confirm(`¿Confirmar finalización de partido con resultado ${partido.local_nombre} ${localStr} - ${visitaStr} ${partido.visita_nombre}? Se calcularán los puntos del Prode para todos los usuarios y NO se puede deshacer.`)) {
      cargarResultadoMut.mutate({
        goles_local: parseInt(localStr, 10),
        goles_visita: parseInt(visitaStr, 10)
      });
    }
  };

  return (
    <div className={styles.partidoCard}>
      <div className={styles.mainRow}>
        
        {/* Equipo Local */}
        <div className={`${styles.equipo} ${styles.equipoLocal}`}>
          <span className={styles.equipoNombre}>{partido.local_nombre}</span>
          {partido.local_escudo 
            ? <img src={partido.local_escudo} alt="" className={styles.escudo} />
            : <span className={styles.escudoVacio} />
          }
        </div>

        {/* Inputs de resultado */}
        <div className={styles.marcadorCol}>
        <div className={styles.inputGroup}>
          <input
            type="number"
            className={styles.inputGol}
            value={localStr}
            onChange={handleLocalChange}
            disabled={cargarResultadoMut.isPending}
            placeholder="-"
          />
          <span className={styles.golSep}>-</span>
          <input
            type="number"
            className={styles.inputGol}
            value={visitaStr}
            onChange={handleVisitaChange}
            disabled={cargarResultadoMut.isPending}
            placeholder="-"
          />
        </div>
        
        <button 
          className={styles.btnSave} 
          onClick={handleCargarResultado}
          disabled={cargarResultadoMut.isPending || localStr === '' || visitaStr === ''}
        >
          {cargarResultadoMut.isPending ? '...' : 'Cargar Final'}
        </button>

        {partido.estado === 'finalizado' && (
          <span className={styles.finBadge}>Finalizado</span>
        )}

        <button 
          className={styles.btnEventosToggle} 
          onClick={() => setShowEventos(!showEventos)}
        >
          {showEventos ? '▲ Ocultar Goles' : '▼ Cargar Goles (Jugadores)'}
        </button>
      </div>

      {/* Equipo Visita */}
      <div className={`${styles.equipo} ${styles.equipoVisita}`}>
        {partido.visita_escudo 
          ? <img src={partido.visita_escudo} alt="" className={styles.escudo} />
          : <span className={styles.escudoVacio} />
        }
        <span className={styles.equipoNombre}>{partido.visita_nombre}</span>
      </div>

      </div> {/* end mainRow */}

      <div className={styles.liveRow}>
        <Link to={`/admin/partido/${partido.id}`} className={styles.btnLive}>
          Gol a Gol / Transmision en Vivo
        </Link>
      </div>

      {/* Panel Expandible de Eventos */}
      {showEventos && (
        <div className={styles.eventosPanel}>
          <div className={styles.evCol}>
            <span className={styles.evTitle}>Goles {partido.local_nombre}</span>
            <div className={styles.evInputRow}>
              <input 
                type="text" 
                placeholder="Seleccionar o crear jugador" 
                list={`list-loc-${partido.id}`}
                value={nuevoGolLocal}
                onChange={(e) => setNuevoGolLocal(e.target.value)}
                className={styles.evInput}
                disabled={agregarEventoMut.isPending}
              />
              <datalist id={`list-loc-${partido.id}`}>
                {plantelLocal?.map(j => (
                  <option key={j.id} value={`${j.nombre} ${j.apellido}`} />
                ))}
              </datalist>
              <button 
                onClick={() => handleAddGol(true)} 
                className={styles.evBtn}
                disabled={agregarEventoMut.isPending || !nuevoGolLocal.trim()}
              >
                + Gol
              </button>
            </div>
          </div>
          
          <div className={styles.evCol}>
            <span className={styles.evTitle}>Goles {partido.visita_nombre}</span>
            <div className={styles.evInputRow}>
              <input 
                type="text" 
                placeholder="Seleccionar o crear jugador"
                list={`list-vis-${partido.id}`}
                value={nuevoGolVisita}
                onChange={(e) => setNuevoGolVisita(e.target.value)}
                className={styles.evInput}
                disabled={agregarEventoMut.isPending}
              />
              <datalist id={`list-vis-${partido.id}`}>
                {plantelVisita?.map(j => (
                  <option key={j.id} value={`${j.nombre} ${j.apellido}`} />
                ))}
              </datalist>
              <button 
                onClick={() => handleAddGol(false)} 
                className={styles.evBtn}
                disabled={agregarEventoMut.isPending || !nuevoGolVisita.trim()}
              >
                + Gol
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


export default function Admin() {
  const usuario = useAuthStore((s) => s.usuario);
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);
  const [tab, setTab] = useState('resultados');

  // Proteger ruta
  if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'reportero')) {
    return <Navigate to="/" replace />;
  }

  const { data: fechas, isLoading: loadingFechas } = useQuery({
    queryKey: ['fechas', torneoActivo?.id],
    queryFn: () => torneosApi.fechas(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  useEffect(() => {
    if (fechas && fechas.length > 0 && !selectedFecha) {
      // Por defecto la primera que no esté cerrada
      const pending = fechas.find(f => f.estado !== 'cerrada');
      setSelectedFecha(pending || fechas[0]);
    }
  }, [fechas, selectedFecha]);

  const { data: partidos, isLoading: loadingPartidos } = useQuery({
    queryKey: ['partidosAdmin', selectedFecha?.id],
    queryFn: () => partidosApi.porFecha(selectedFecha.id),
    enabled: !!selectedFecha,
    refetchInterval: false, // En panel admin mejor manual o sin refetch locos
  });

  if (!torneoActivo) return <p className={styles.msg}>Seleccioná un torneo</p>;
  if (loadingFechas) return <p className={styles.msg}>Cargando fechas...</p>;

  return (
    <div className={styles.wrap}>
      {/* Tabs de navegación */}
      <div className={styles.adminTabs}>
        <button
          className={`${styles.adminTab} ${tab === 'resultados' ? styles.adminTabActive : ''}`}
          onClick={() => setTab('resultados')}
        >
          Carga de Resultados
        </button>
        <button
          className={`${styles.adminTab} ${tab === 'historico' ? styles.adminTabActive : ''}`}
          onClick={() => setTab('historico')}
        >
          Torneos Historicos
        </button>
      </div>

      {tab === 'historico' && <AdminHistorico />}

      {tab === 'resultados' && (
        <>
          <div className={styles.secHead}>
            <span className={styles.secTitle}>Panel de Control Admin</span>
            <span className={styles.secSub}>Carga de resultados reales de los partidos</span>
          </div>

          <div className={styles.warningBox}>
            <strong>Atencion:</strong> Al "Cargar Final", el partido se marcará como finalizado y se repartirán automáticamente los puntos del Prode a todos los usuarios. ¡Asegurate de que el resultado sea correcto!
          </div>

          {/* Selector de Fechas */}
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
              <p className={styles.msg}>No hay partidos en esta fecha.</p>
            )}

            {!loadingPartidos && partidos?.map(p => (
              <PartidoAdminCard key={p.id} partido={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

