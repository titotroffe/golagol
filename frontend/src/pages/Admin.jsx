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
  const [porEscritorio, setPorEscritorio] = useState(partido.por_escritorio === 1 || partido.ganador_escritorio != null);
  const [ganadorEscritorio, setGanadorEscritorio] = useState(partido.ganador_escritorio || 'local');

  // Sincronizar estado local
  useEffect(() => {
    if (partido.goles_local != null) setLocalStr(partido.goles_local.toString());
    if (partido.goles_visita != null) setVisitaStr(partido.goles_visita.toString());
    setPorEscritorio(partido.por_escritorio === 1 || partido.ganador_escritorio != null);
    setGanadorEscritorio(partido.ganador_escritorio || 'local');
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

  const { data: detalle } = useQuery({
    queryKey: ['partidoDetalle', partido.id],
    queryFn: () => partidosApi.detalle(partido.id),
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
      queryClient.invalidateQueries(['partidoDetalle', partido.id]);
      setNuevoGolLocal('');
      setNuevoGolVisita('');
    },
    onError: (err) => alert('Error al agregar gol: ' + err.message)
  });

  const eliminarEventoMut = useMutation({
    mutationFn: (eventoId) => partidosApi.eliminarEvento(partido.id, eventoId),
    onSuccess: () => {
      queryClient.invalidateQueries(['partidosAdmin', partido.fecha_id]);
      queryClient.invalidateQueries(['partidoDetalle', partido.id]);
    },
    onError: (err) => alert('Error al eliminar evento: ' + err.message)
  });

  const handleAddEvento = (isLocal, tipo) => {
    const nombre = isLocal ? nuevoGolLocal : nuevoGolVisita;
    if (!nombre.trim()) return;

    agregarEventoMut.mutate({
      tipo,
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
        goles_visita: parseInt(visitaStr, 10),
        por_escritorio: porEscritorio,
        ganador_escritorio: porEscritorio ? ganadorEscritorio : null
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

        <div style={{marginTop: '10px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
          <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
            <input 
              type="checkbox" 
              id={`escritorio_${partido.id}`}
              checked={porEscritorio}
              onChange={(e) => setPorEscritorio(e.target.checked)}
              disabled={cargarResultadoMut.isPending}
            />
            <label htmlFor={`escritorio_${partido.id}`} style={{cursor: 'pointer'}}>Fallo por escritorio</label>
          </div>
          {porEscritorio && (
            <select
              value={ganadorEscritorio}
              onChange={(e) => setGanadorEscritorio(e.target.value)}
              disabled={cargarResultadoMut.isPending}
              style={{padding: '4px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555', width: '100%', maxWidth: '200px'}}
            >
              <option value="local">Puntos para Local</option>
              <option value="visita">Puntos para Visita</option>
            </select>
          )}
        </div>

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
            <span className={styles.evTitle}>Eventos {partido.local_nombre}</span>
            <ul style={{listStyle: 'none', padding: 0, margin: '0 0 10px 0', fontSize: '0.85rem'}}>
              {detalle?.eventos?.filter(ev => ev.equipo_id === partido.equipo_local_id && (ev.tipo.includes('GOL') || ev.tipo === 'ROJA')).map(ev => (
                <li key={ev.id} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                  <span>{ev.jugador_nombre} {ev.jugador_apellido} {ev.tipo === 'AUTOGOL' ? '(E.C.)' : ev.tipo === 'ROJA' ? '(🔴)' : ''}</span>
                  <button 
                    onClick={() => eliminarEventoMut.mutate(ev.id)}
                    style={{background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0 4px'}}
                    disabled={eliminarEventoMut.isPending}
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              <input 
                type="text" 
                placeholder="Seleccionar o crear jugador" 
                list={`list-loc-${partido.id}`}
                value={nuevoGolLocal}
                onChange={(e) => setNuevoGolLocal(e.target.value)}
                className={styles.evInput}
                disabled={agregarEventoMut.isPending}
                style={{width: '100%', boxSizing: 'border-box'}}
              />
              <datalist id={`list-loc-${partido.id}`}>
                {plantelLocal?.map(j => (
                  <option key={j.id} value={`${j.nombre} ${j.apellido}`} />
                ))}
              </datalist>
              <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                <button 
                  onClick={() => handleAddEvento(true, 'GOL')} 
                  className={styles.evBtn}
                  disabled={agregarEventoMut.isPending || !nuevoGolLocal.trim()}
                >
                  + Gol
                </button>
                <button 
                  onClick={() => handleAddEvento(true, 'AUTOGOL')} 
                  className={styles.evBtn}
                  style={{background: '#d29922', color: '#000'}}
                  disabled={agregarEventoMut.isPending || !nuevoGolLocal.trim()}
                >
                  + E.C.
                </button>
                <button 
                  onClick={() => handleAddEvento(true, 'ROJA')} 
                  className={styles.evBtn}
                  style={{background: '#ff4444', borderColor: '#ff4444'}}
                  disabled={agregarEventoMut.isPending || !nuevoGolLocal.trim()}
                >
                  + Roja
                </button>
              </div>
            </div>
          </div>
          
          <div className={styles.evCol}>
            <span className={styles.evTitle}>Eventos {partido.visita_nombre}</span>
            <ul style={{listStyle: 'none', padding: 0, margin: '0 0 10px 0', fontSize: '0.85rem'}}>
              {detalle?.eventos?.filter(ev => ev.equipo_id === partido.equipo_visita_id && (ev.tipo.includes('GOL') || ev.tipo === 'ROJA')).map(ev => (
                <li key={ev.id} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                  <span>{ev.jugador_nombre} {ev.jugador_apellido} {ev.tipo === 'AUTOGOL' ? '(E.C.)' : ev.tipo === 'ROJA' ? '(🔴)' : ''}</span>
                  <button 
                    onClick={() => eliminarEventoMut.mutate(ev.id)}
                    style={{background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0 4px'}}
                    disabled={eliminarEventoMut.isPending}
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              <input 
                type="text" 
                placeholder="Seleccionar o crear jugador"
                list={`list-vis-${partido.id}`}
                value={nuevoGolVisita}
                onChange={(e) => setNuevoGolVisita(e.target.value)}
                className={styles.evInput}
                disabled={agregarEventoMut.isPending}
                style={{width: '100%', boxSizing: 'border-box'}}
              />
              <datalist id={`list-vis-${partido.id}`}>
                {plantelVisita?.map(j => (
                  <option key={j.id} value={`${j.nombre} ${j.apellido}`} />
                ))}
              </datalist>
              <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                <button 
                  onClick={() => handleAddEvento(false, 'GOL')} 
                  className={styles.evBtn}
                  disabled={agregarEventoMut.isPending || !nuevoGolVisita.trim()}
                >
                  + Gol
                </button>
                <button 
                  onClick={() => handleAddEvento(false, 'AUTOGOL')} 
                  className={styles.evBtn}
                  style={{background: '#d29922', color: '#000'}}
                  disabled={agregarEventoMut.isPending || !nuevoGolVisita.trim()}
                >
                  + E.C.
                </button>
                <button 
                  onClick={() => handleAddEvento(false, 'ROJA')} 
                  className={styles.evBtn}
                  style={{background: '#ff4444', borderColor: '#ff4444'}}
                  disabled={agregarEventoMut.isPending || !nuevoGolVisita.trim()}
                >
                  + Roja
                </button>
              </div>
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

