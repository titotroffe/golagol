import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { partidosApi, equiposApi } from '../api';
import { useAuthStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import styles from './GolAGol.module.css';

function EquipoPanel({ 
  esLocal, 
  partido, 
  alineaciones, 
  plantel, 
  agregarAlineacionMut, 
  eliminarAlineacionMut,
  registrarEventoMut,
  isAdmin,
  tiempoActual
}) {
  const equipoId = esLocal ? partido.equipo_local_id : partido.equipo_visita_id;
  const nombre = esLocal ? partido.local_nombre : partido.visita_nombre;
  
  const [pendingAction, setPendingAction] = useState(null);
  const [actionForm, setActionForm] = useState({});

  // Filtrar alineaciones de este equipo
  const miAlineacion = alineaciones.filter(a => a.equipo_id === equipoId);
  const titulares = miAlineacion.filter(a => a.tipo === 'titular');
  const suplentes = miAlineacion.filter(a => a.tipo === 'suplente');

  // Eventos de este partido para validaciones
  const eventos = partido.eventos || [];
  
  // Calcular estado del jugador
  const estadoJugador = (jId, esSuplente = false) => {
    let amarillas = 0;
    let rojas = 0;
    let haSalido = false;
    let haEntrado = false;

    eventos.forEach(ev => {
      if (ev.tipo === 'AMARILLA' && ev.jugador_id === jId) amarillas++;
      if (ev.tipo === 'ROJA' && ev.jugador_id === jId) rojas++;
      if (ev.tipo === 'CAMBIO') {
        if (ev.jugador_id === jId) haSalido = true;
        
        // El detalle guarda {"entra_id": ID}
        if (ev.detalle && ev.detalle.startsWith('{')) {
          try {
            const data = JSON.parse(ev.detalle);
            if (data.entra_id === jId) haEntrado = true;
          } catch(e){
            console.warn('Error parseando detalle de evento CAMBIO:', e);
          }
        }
      }
    });

    const expulsado = rojas > 0 || amarillas >= 2;
    // Un jugador no puede jugar si fue expulsado, si ya salió, o si es suplente y aún no entró
    const inhabilitado = expulsado || haSalido || (esSuplente && !haEntrado);

    return { amarillas, rojas, expulsado, haSalido, haEntrado, inhabilitado };
  };

  // Filtrar plantel para los selects (solo los que no están ya alineados)
  const jugadoresDisponibles = plantel?.filter(
    j => !miAlineacion.some(a => a.jugador_id === j.id)
  ) || [];

  const handleSelectAlineacion = (e, tipo) => {
    const jId = e.target.value;
    if (!jId) return;
    // Asignar dorsal básico autoincremental si no tiene
    let dorsalCalc = 1;
    if (tipo === 'titular') dorsalCalc = titulares.length + 1;
    if (tipo === 'suplente') dorsalCalc = 11 + suplentes.length + 1;
    
    agregarAlineacionMut.mutate({
      equipo_id: equipoId,
      jugador_id: parseInt(jId, 10),
      tipo,
      dorsal: dorsalCalc
    });
    e.target.value = '';
  };

  const handleAction = (jugadorId, tipoEvento, detalleObj = null) => {
    registrarEventoMut.mutate({
      tipo: tipoEvento,
      equipo_id: equipoId,
      jugador_id: jugadorId,
      detalle: detalleObj ? JSON.stringify(detalleObj) : '',
      minuto: actionForm.minuto ? parseInt(actionForm.minuto) : (tiempoActual?.mins || 0),
    });
  };

  const handleMatchState = (estado) => {
    registrarEventoMut.mutate({
      tipo: estado,
      equipo_id: null,
      jugador_id: null,
      detalle: '',
      minuto: 0,
    });
  };

  const executeAction = (penalOverride = null) => {
    if (!actionForm.jugadorId) return;

    if (pendingAction === 'CAMBIO') {
      const entraId = parseInt(actionForm.entraId, 10);
      if (!entraId) return;
      const entraSuplente = suplentes.find(s => s.jugador_id === entraId);
      handleAction(actionForm.jugadorId, 'CAMBIO', { 
        entra_id: entraId, 
        entra_nombre: entraSuplente ? `${entraSuplente.nombre} ${entraSuplente.apellido}` : 'Jugador' 
      });
    } else if (pendingAction === 'PATEAR_PENAL') {
      const res = penalOverride || actionForm.resultado; // 1, 2, 3
      if (res === '1') handleAction(actionForm.jugadorId, 'GOL_PENAL');
      else if (res === '2') handleAction(actionForm.jugadorId, 'PENAL_ERRADO');
      else if (res === '3') handleAction(actionForm.jugadorId, 'PENAL_ATAJADO');
    } else {
      // GOL, AMARILLA, ROJA
      handleAction(actionForm.jugadorId, pendingAction);
    }
    
    setPendingAction(null);
    setActionForm({});
  };

  // Jugadores en cancha habilitados para acciones comunes
  const jugadoresEnCancha = miAlineacion.filter(a => {
    const est = estadoJugador(a.jugador_id, a.tipo === 'suplente');
    return !est.inhabilitado;
  });

  const renderActionForm = () => {
    if (!pendingAction) return null;

    return (
      <div className={styles.actionFormBox}>
        <div className={styles.actionFormHeader}>
          <h4>
            {pendingAction === 'GOL' && 'Registrar Gol'}
            {pendingAction === 'AMARILLA' && 'Sacar Amarilla'}
            {pendingAction === 'ROJA' && 'Sacar Roja'}
            {pendingAction === 'CAMBIO' && 'Registrar Cambio'}
            {pendingAction === 'PATEAR_PENAL' && 'Ejecutar Penal'}
          </h4>
          <button onClick={() => setPendingAction(null)} className={styles.btnRemove}>X</button>
        </div>
        
        <div className={styles.actionFormBody}>
          <select 
            value={actionForm.jugadorId || ''} 
            onChange={e => setActionForm({...actionForm, jugadorId: parseInt(e.target.value)})}
            className={styles.selectJ}
          >
            <option value="">-- Seleccionar Jugador --</option>
            {jugadoresEnCancha.map(j => (
              <option key={j.id} value={j.jugador_id}>{j.dorsal} - {j.apellido || j.nombre}</option>
            ))}
          </select>

          <input 
            type="number" 
            placeholder="Minuto (ej: 45)" 
            value={actionForm.minuto || ''} 
            onChange={e => setActionForm({...actionForm, minuto: e.target.value})}
            className={styles.selectJ}
            style={{ marginTop: '8px', marginBottom: '8px' }}
          />

          {pendingAction === 'CAMBIO' && (
            <select 
              value={actionForm.entraId || ''} 
              onChange={e => setActionForm({...actionForm, entraId: parseInt(e.target.value)})}
              className={styles.selectJ}
            >
              <option value="">-- Entra suplente --</option>
              {suplentes.filter(s => {
                const est = estadoJugador(s.jugador_id, true);
                return !est.haEntrado && !est.expulsado;
              }).map(s => (
                <option key={s.id} value={s.jugador_id}>{s.dorsal} - {s.apellido || s.nombre}</option>
              ))}
            </select>
          )}

          {pendingAction === 'PATEAR_PENAL' ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => executeAction('1')} className={styles.btnConfirmAction} disabled={!actionForm.jugadorId} style={{flex: 1}}>GOL</button>
              <button onClick={() => executeAction('2')} className={styles.btnConfirmAction} disabled={!actionForm.jugadorId} style={{flex: 1, backgroundColor: '#da3633'}}>ERRADO</button>
              <button onClick={() => executeAction('3')} className={styles.btnConfirmAction} disabled={!actionForm.jugadorId} style={{flex: 1, backgroundColor: '#bf8700'}}>ATAJADO</button>
            </div>
          ) : (
            <button 
              onClick={() => executeAction()} 
              className={styles.btnConfirmAction}
              disabled={
                !actionForm.jugadorId || 
                (pendingAction === 'CAMBIO' && !actionForm.entraId)
              }
            >
              Confirmar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.equipoCol}>
      <h2 className={styles.eqTitle}>{nombre}</h2>

      {isAdmin && (
        <div className={styles.teamActionsBtnGroup}>
          <button onClick={()=>setPendingAction('GOL')} className={styles.btnTeamAction}>Gol</button>
          <button onClick={() => {
            const currentMin = tiempoActual?.mins || 0;
            registrarEventoMut.mutate({tipo: 'PENAL_A_FAVOR', equipo_id: equipoId, detalle: esLocal ? 'Local' : 'Visita', minuto: currentMin});
            setPendingAction('PATEAR_PENAL');
          }} className={styles.btnTeamAction}>Penal</button>
          <button onClick={()=>setPendingAction('AMARILLA')} className={styles.btnTeamAction}>Amarilla</button>
          <button onClick={()=>setPendingAction('ROJA')} className={styles.btnTeamAction}>Roja</button>
          <button onClick={()=>setPendingAction('CAMBIO')} className={styles.btnTeamAction}>Cambio</button>
        </div>
      )}

      {isAdmin && renderActionForm()}

      <div className={styles.section}>
        <div className={styles.secHeader}>
          <span className={styles.secHeading}>Titulares (1-11)</span>
          <span className={styles.count}>{titulares.length}/11</span>
        </div>
        
        <ul className={styles.lista}>
          {titulares.map(t => {
            const { amarillas, expulsado, haSalido, inhabilitado } = estadoJugador(t.jugador_id, false);
            
            // Suplentes que todavía NO entraron y NO fueron expulsados
            const suplentesDisponiblesParaEntrar = suplentes.filter(s => {
              const est = estadoJugador(s.jugador_id, true);
              return !est.haEntrado && !est.expulsado;
            });

            return (
              <li key={t.id} className={`${styles.jItem} ${inhabilitado ? styles.jInhabilitado : ''}`}>
                <div className={styles.jInfo}>
                  <span className={styles.dorsal}>{t.dorsal}</span>
                  <span className={styles.nombre}>{t.apellido ? `${t.nombre} ${t.apellido}` : t.nombre}</span>
                  {amarillas === 1 && !expulsado && <span className={styles.tagAmarilla}>🟨</span>}
                  {expulsado && <span className={styles.tagRoja}>🟥</span>}
                  {haSalido && <span className={styles.tagSub}>⬇️ Salió</span>}
                </div>
                {isAdmin && (
                  <button title="Quitar de planilla" onClick={() => eliminarAlineacionMut.mutate(t.jugador_id)} className={styles.btnRemoveTiny} disabled={haSalido}>✖</button>
                )}
              </li>
            );
          })}
          {isAdmin && titulares.length < 11 && (
            <li className={styles.jAdd}>
              <select onChange={(e) => handleSelectAlineacion(e, 'titular')} className={styles.selectJ}>
                <option value="">+ Agregar Titular</option>
                {jugadoresDisponibles.map(j => (
                  <option key={j.id} value={j.id}>{j.nombre} {j.apellido}</option>
                ))}
              </select>
            </li>
          )}
        </ul>
      </div>

      <div className={styles.section}>
        <div className={styles.secHeader}>
          <span className={styles.secHeading}>Suplentes (12-18)</span>
          <span className={styles.count}>{suplentes.length}/7</span>
        </div>
        
        <ul className={styles.lista}>
          {suplentes.map(s => {
            const { amarillas, expulsado, haEntrado, inhabilitado } = estadoJugador(s.jugador_id, true);
            return (
              <li key={s.id} className={`${styles.jItem} ${expulsado ? styles.jInhabilitado : ''}`}>
                <div className={styles.jInfo}>
                  <span className={styles.dorsal}>{s.dorsal}</span>
                  <span className={styles.nombre}>{s.apellido ? `${s.nombre} ${s.apellido}` : s.nombre}</span>
                  {amarillas === 1 && !expulsado && <span className={styles.tagAmarilla}>🟨</span>}
                  {expulsado && <span className={styles.tagRoja}>🟥</span>}
                  {haEntrado && <span className={styles.tagSub}>⬆️ Jugando</span>}
                </div>
                {isAdmin && (
                  <button title="Quitar de planilla" onClick={() => eliminarAlineacionMut.mutate(s.jugador_id)} className={styles.btnRemoveTiny} disabled={haEntrado}>✖</button>
                )}
              </li>
            );
          })}
          {isAdmin && suplentes.length < 7 && (
            <li className={styles.jAdd}>
              <select onChange={(e) => handleSelectAlineacion(e, 'suplente')} className={styles.selectJ}>
                <option value="">+ Agregar Suplente</option>
                {jugadoresDisponibles.map(j => (
                  <option key={j.id} value={j.id}>{j.nombre} {j.apellido}</option>
                ))}
              </select>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}


export default function GolAGol() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore(s => s.usuario?.rol === 'admin');

  useWebSocket((msg) => {
    // Cuando entra un evento por websocket, invalidamos las queries para refrescar
    queryClient.invalidateQueries(['partido', id]);
    queryClient.invalidateQueries(['alineaciones', id]);
  });

  // Queries
  const { data: partido, isLoading: loadP } = useQuery({
    queryKey: ['partido', id],
    queryFn: () => partidosApi.detalle(id),
  });

  const { data: alineaciones = [], isLoading: loadA } = useQuery({
    queryKey: ['alineaciones', id],
    queryFn: () => partidosApi.alineaciones(id),
  });

  const { data: plantelLoc } = useQuery({
    queryKey: ['plantel', partido?.equipo_local_id],
    queryFn: () => equiposApi.plantel(partido.equipo_local_id),
    enabled: !!partido,
  });

  const { data: plantelVis } = useQuery({
    queryKey: ['plantel', partido?.equipo_visita_id],
    queryFn: () => equiposApi.plantel(partido.equipo_visita_id),
    enabled: !!partido,
  });

  // Mutations
  const agregarAlin = useMutation({
    mutationFn: (body) => partidosApi.agregarAlineacion(id, body),
    onSuccess: () => queryClient.invalidateQueries(['alineaciones', id])
  });

  const eliminarAlin = useMutation({
    mutationFn: (jId) => partidosApi.eliminarAlineacion(id, jId),
    onSuccess: () => queryClient.invalidateQueries(['alineaciones', id])
  });

  const regEvento = useMutation({
    mutationFn: (body) => partidosApi.registrarEvento(id, body),
    onSuccess: () => queryClient.invalidateQueries(['partido', id])
  });

  const eliminarEventoMut = useMutation({
    mutationFn: (eventoId) => partidosApi.eliminarEvento(id, eventoId),
    onSuccess: () => queryClient.invalidateQueries(['partido', id])
  });

  const cambiarEstadoMut = useMutation({
    mutationFn: ({ estado, motivo }) => partidosApi.cambiarEstado(id, { estado, motivo }),
    onSuccess: () => queryClient.invalidateQueries(['partido', id])
  });

  const [tiempoState, setTiempoState] = useState({ mins: 0, secs: 0, extra: null });
  const [tiempoExtraInput, setTiempoExtraInput] = useState('');
  const [showTiempoExtra, setShowTiempoExtra] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [motivoSuspension, setMotivoSuspension] = useState('');
  const [minutoReanudacion, setMinutoReanudacion] = useState('');

  useEffect(() => {
    if (!partido || !partido.eventos) return;

    const interval = setInterval(() => {
      const evs = partido.eventos;
      const inicio1T   = evs.find(e => e.tipo === 'INICIO_PARTIDO');
      const fin1T      = evs.find(e => e.tipo === 'FIN_1T');
      const inicio2T   = evs.find(e => e.tipo === 'INICIO_2T');
      const finPartido = evs.find(e => e.tipo === 'FIN_PARTIDO');
      let totalSecs = 0;
      let running = false;
      let lastStartTime = null;
      let isHalftime = false;
      let isFinished = false;
      let currentExtraTime = null;
      
      const now = Date.now();

      // Procesar eventos cronológicamente para calcular el tiempo neto
      const evsChronological = [...partido.eventos].sort((a,b) => new Date(a.registrado_en) - new Date(b.registrado_en));
      const fueSuspendido = evsChronological.some(e => e.tipo === 'SUSPENSION');

      evsChronological.forEach(ev => {
        const evTime = new Date(ev.registrado_en + 'Z').getTime();

        if (ev.tipo === 'INICIO_PARTIDO') {
          lastStartTime = evTime;
          running = true;
          isHalftime = false;
          currentExtraTime = null;
        } else if (ev.tipo === 'FIN_1T') {
          if (running) totalSecs += Math.floor((evTime - lastStartTime) / 1000);
          running = false;
          isHalftime = true;
          if (!fueSuspendido) totalSecs = 45 * 60; // Forzar a 45:00 solo en partidos normales
        } else if (ev.tipo === 'INICIO_2T') {
          lastStartTime = evTime;
          running = true;
          isHalftime = false;
          currentExtraTime = null; // La adición del 1T no aplica al 2T
          if (!fueSuspendido) totalSecs = 45 * 60; // Base 45:00 solo en normales
        } else if (ev.tipo === 'FIN_PARTIDO') {
          if (running) totalSecs += Math.floor((evTime - lastStartTime) / 1000);
          running = false;
          isFinished = true;
          if (!fueSuspendido) totalSecs = 90 * 60; // Forzar a 90:00
        } else if (ev.tipo === 'SUSPENSION') {
          if (running) {
            totalSecs += Math.floor((evTime - lastStartTime) / 1000);
            running = false;
          }
        } else if (ev.tipo === 'REANUDACION') {
          // Solo retomar el reloj si se suspendió durante el juego
          if (!isHalftime && !isFinished) {
            lastStartTime = evTime;
            running = true;
            if (ev.detalle && ev.detalle.startsWith('{')) {
              try {
                const d = JSON.parse(ev.detalle);
                if (d.forzar_minuto !== null && d.forzar_minuto !== undefined) {
                  totalSecs = parseInt(d.forzar_minuto, 10) * 60;
                }
              } catch (e) {}
            }
          }
        } else if (ev.tipo === 'TIEMPO_EXTRA') {
          currentExtraTime = ev.detalle;
        }
      });

      if (running) {
        totalSecs += Math.floor((now - lastStartTime) / 1000);
      }

      setTiempoState({
        mins: Math.floor(totalSecs / 60),
        secs: totalSecs % 60,
        extra: currentExtraTime
      });

      if (isFinished || (!evs.some(e => e.tipo === 'INICIO_PARTIDO') && !evs.some(e => e.tipo === 'INICIO_2T'))) clearInterval(interval);

    }, 1000);

    return () => clearInterval(interval);
  }, [partido]);

  if (loadP || loadA) return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '10px' }} />
        ))}
      </div>
    </div>
  );
  if (!partido) return <p className={styles.msg}>Partido no encontrado.</p>;

  return (
    <div className={styles.wrap}>
      
      {/* HEADER MARCADOR EN VIVO */}
      <div className={styles.marcadorTop}>
        <Link to={isAdmin ? "/admin" : "/"} className={styles.btnBack}>← Volver</Link>
        <div className={styles.scoreBoard}>
          <div className={`${styles.scoreTeam} ${styles.scoreLocal}`}>
            {partido.local_escudo && <img src={partido.local_escudo} alt="" className={styles.headerEscudo} />}
            <span className={styles.teamNameText}>{partido.local_nombre}</span>
          </div>
          <div className={styles.scoreCenter}>
            <div className={styles.scoreNumbers}>
              {partido.goles_local ?? 0} - {partido.goles_visita ?? 0}
            </div>
            <div className={styles.timerDisplay}>
              {String(tiempoState.mins).padStart(2, '0')}:{String(tiempoState.secs).padStart(2, '0')}
              {tiempoState.extra && <span className={styles.timerExtra}> +{tiempoState.extra}'</span>}
            </div>
          </div>
          <div className={`${styles.scoreTeam} ${styles.scoreVisita}`}>
            {partido.visita_escudo && <img src={partido.visita_escudo} alt="" className={styles.headerEscudo} />}
            <span className={styles.teamNameText}>{partido.visita_nombre}</span>
          </div>
        </div>
        <div className={styles.estadoIndicator}>
          {partido.estado === 'pendiente' ? 'Esperando inicio' : 
           partido.estado === 'en_curso' ? 'EN VIVO' : 
           partido.estado === 'suspendido' ? 'SUSPENDIDO' : 'FINALIZADO'}
        </div>
      </div>

      <div className={styles.colsWrapper}>
        <EquipoPanel 
          esLocal={true} 
          partido={partido} 
          alineaciones={alineaciones}
          plantel={plantelLoc}
          agregarAlineacionMut={agregarAlin}
          eliminarAlineacionMut={eliminarAlin}
          registrarEventoMut={regEvento}
          isAdmin={isAdmin}
          tiempoActual={tiempoState}
        />
        
        {/* PANEL CENTRAL: EVENTOS RECIENTES Y CONTROLES DE PARTIDO */}
        <div className={styles.feedCol}>
          {isAdmin && (
            <div className={styles.matchControls}>
              <button onClick={() => regEvento.mutate({tipo: 'INICIO_PARTIDO', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Inicio 1T</button>
              <button onClick={() => regEvento.mutate({tipo: 'FIN_1T', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Fin 1T</button>
              <button onClick={() => regEvento.mutate({tipo: 'INICIO_2T', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Inicio 2T</button>
              <button onClick={() => regEvento.mutate({tipo: 'FIN_PARTIDO', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Fin Partido</button>
              
              {partido.estado !== 'suspendido' && partido.estado !== 'finalizado' && (
                <button 
                  onClick={() => setShowSuspendModal(true)} 
                  className={styles.btnMatchState} 
                  style={{ background: '#4c1d1d', borderColor: '#f85149' }}
                >
                  Suspender
                </button>
              )}
              {partido.estado === 'suspendido' && (
                <button 
                  onClick={() => setShowSuspendModal(true)} 
                  className={styles.btnMatchState}
                  style={{ background: '#1b4a24', borderColor: '#238636' }}
                >
                  Reanudar
                </button>
              )}

              {isAdmin && !showTiempoExtra && partido.estado !== 'suspendido' && (
                <button onClick={() => setShowTiempoExtra(true)} className={styles.btnMatchState}>Adicion</button>
              )}
              {isAdmin && showTiempoExtra && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1" max="20"
                    placeholder="min"
                    value={tiempoExtraInput}
                    onChange={e => setTiempoExtraInput(e.target.value)}
                    style={{ width: '60px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #58a6ff', background: '#0d1117', color: 'white', fontSize: '0.9rem' }}
                    autoFocus
                  />
                  <button
                    className={styles.btnMatchState}
                    onClick={() => {
                      if (tiempoExtraInput) {
                        regEvento.mutate({tipo: 'TIEMPO_EXTRA', equipo_id: null, detalle: tiempoExtraInput});
                        setTiempoExtraInput('');
                        setShowTiempoExtra(false);
                      }
                    }}
                  >OK</button>
                  <button
                    className={styles.btnMatchState}
                    style={{ background: 'transparent', border: '1px solid #30363d' }}
                    onClick={() => { setShowTiempoExtra(false); setTiempoExtraInput(''); }}
                  >✕</button>
                </div>
              )}
            </div>
          )}
          <h3 className={styles.feedTitle}>Eventos Registrados</h3>
          <div className={styles.feedScroll}>
            {partido.eventos?.slice().reverse().map(ev => {
              let subText = '';
              if (ev.tipo === 'CAMBIO' && ev.detalle && ev.detalle.startsWith('{')) {
                try {
                  const d = JSON.parse(ev.detalle);
                  subText = `Entró ${d.entra_nombre}`;
                } catch(e) {}
              }
              if ((ev.tipo === 'SUSPENSION' || ev.tipo === 'REANUDACION') && ev.detalle && ev.detalle.startsWith('{')) {
                try {
                  const d = JSON.parse(ev.detalle);
                  subText = d.motivo || '';
                } catch(e) {}
              }

              return (
                <div key={ev.id} className={styles.evCard}>
                  <div className={styles.evCardMain}>
                    <span className={styles.evIcon}>
                      {ev.tipo === 'GOL' || ev.tipo === 'GOL_PENAL' ? '⚽' : 
                       ev.tipo === 'PENAL_A_FAVOR' ? '🎯' : 
                       ev.tipo === 'PENAL_ERRADO' ? '❌' : 
                       ev.tipo === 'PENAL_ATAJADO' ? '🧤' : 
                       ev.tipo === 'AMARILLA' ? '🟨' : 
                       ev.tipo === 'ROJA' ? '🟥' : 
                       ev.tipo === 'CAMBIO' ? '🔄' : 
                       ev.tipo === 'TIEMPO_EXTRA' ? '➕' :
                       ev.tipo.startsWith('INICIO') || ev.tipo.startsWith('FIN') ? '⏱' : '▪️'}
                    </span>
                    <div className={styles.evDetails}>
                      <strong>
                        {ev.tipo === 'CAMBIO' ? `Salió ${ev.jugador_apellido || ev.jugador_nombre}` : 
                         ev.tipo === 'TIEMPO_EXTRA' ? `Adición: +${ev.detalle} min` :
                         ev.tipo === 'PENAL_A_FAVOR' ? `Penal para ${ev.equipo_nombre}` :
                         ev.tipo === 'PENAL_ERRADO' ? `${ev.jugador_apellido || ev.jugador_nombre} (Erró Penal)` :
                         ev.tipo === 'PENAL_ATAJADO' ? `${ev.jugador_apellido || ev.jugador_nombre} (Penal Atajado)` :
                         ev.tipo === 'GOL_PENAL' ? `${ev.jugador_apellido || ev.jugador_nombre} (Gol de Penal)` :
                         ev.tipo.startsWith('INICIO') || ev.tipo.startsWith('FIN') ? ev.tipo.replace('_', ' ') :
                         (ev.jugador_apellido || ev.jugador_nombre)}
                      </strong>
                      {subText && <span className={styles.evSubText}>{subText}</span>}
                      {ev.equipo_nombre && <span className={styles.evTeam}>({ev.equipo_nombre})</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <button 
                      title="Eliminar evento" 
                      onClick={() => setEventoToDelete(ev)}
                      className={styles.btnDeleteEvent}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })}
            {(!partido.eventos || partido.eventos.length === 0) && (
              <p className={styles.msg}>Aún no hay eventos registrados.</p>
            )}
          </div>
        </div>

        <EquipoPanel 
          esLocal={false} 
          partido={partido} 
          alineaciones={alineaciones}
          plantel={plantelVis}
          agregarAlineacionMut={agregarAlin}
          eliminarAlineacionMut={eliminarAlin}
          registrarEventoMut={regEvento}
          isAdmin={isAdmin}
          tiempoActual={tiempoState}
        />
      </div>

      {/* Modal de confirmación para eliminar evento */}
      {eventoToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#161b22', border: '1px solid #f85149', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '380px', textAlign: 'center' }}>
            <p style={{ color: '#e6edf3', margin: '0 0 8px 0', fontWeight: 600, fontSize: '1rem' }}>¿Eliminar este evento?</p>
            <p style={{ color: '#8b949e', margin: '0 0 20px 0', fontSize: '0.85rem' }}>
              <strong>{eventoToDelete.tipo}</strong>
              {eventoToDelete.jugador_apellido || eventoToDelete.jugador_nombre
                ? ` — ${eventoToDelete.jugador_apellido || eventoToDelete.jugador_nombre}`
                : ''}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setEventoToDelete(null)}
                style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', color: '#8b949e', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  eliminarEventoMut.mutate(eventoToDelete.id);
                  setEventoToDelete(null);
                }}
                style={{ flex: 1, padding: '8px', background: '#f85149', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para suspender/reanudar */}
      {showSuspendModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px' }}>
            <p style={{ color: '#e6edf3', margin: '0 0 16px 0', fontWeight: 600, fontSize: '1.1rem' }}>
              {partido.estado === 'suspendido' ? 'Reanudar Partido' : 'Suspender Partido'}
            </p>
            
            <input 
              type="text" 
              placeholder={partido.estado === 'suspendido' ? 'Motivo de reanudación (opcional)' : 'Motivo de suspensión (ej. lluvia, incidentes)'} 
              value={motivoSuspension}
              onChange={e => setMotivoSuspension(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: 'white', marginBottom: partido.estado === 'suspendido' ? '10px' : '20px' }}
              autoFocus
            />

            {partido.estado === 'suspendido' && (
              <input 
                type="number" 
                placeholder="Continuar desde minuto... (ej: 0, 45, o dejar vacío)" 
                value={minutoReanudacion}
                onChange={e => setMinutoReanudacion(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: 'white', marginBottom: '20px' }}
                min="0"
              />
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSuspendModal(false);
                  setMotivoSuspension('');
                }}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', color: '#8b949e', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                disabled={cambiarEstadoMut.isPending}
                onClick={() => {
                  const nuevoEstado = partido.estado === 'suspendido' ? 'en_curso' : 'suspendido';
                  
                  const detalleObj = { motivo: motivoSuspension };
                  if (nuevoEstado === 'en_curso' && minutoReanudacion !== '') {
                    detalleObj.forzar_minuto = parseInt(minutoReanudacion, 10);
                  }

                  cambiarEstadoMut.mutate({ 
                    estado: nuevoEstado, 
                    motivo: JSON.stringify(detalleObj), 
                    minuto: minutoReanudacion !== '' ? parseInt(minutoReanudacion, 10) : tiempoState.mins 
                  });
                  
                  setShowSuspendModal(false);
                  setMotivoSuspension('');
                  setMinutoReanudacion('');
                }}
                style={{ 
                  padding: '8px 16px', 
                  border: 'none', 
                  borderRadius: '6px', 
                  color: 'white', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  background: partido.estado === 'suspendido' ? '#238636' : '#f85149'
                }}
              >
                {partido.estado === 'suspendido' ? 'Reanudar' : 'Suspender'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
