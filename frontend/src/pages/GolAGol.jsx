import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { partidosApi, equiposApi } from '../api';
import styles from './GolAGol.module.css';

function EquipoPanel({ 
  esLocal, 
  partido, 
  alineaciones, 
  plantel, 
  agregarAlineacionMut, 
  eliminarAlineacionMut,
  registrarEventoMut
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
          } catch(e){}
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
      minuto: 0,
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

      <div className={styles.teamActionsBtnGroup}>
        <button onClick={()=>setPendingAction('GOL')} className={styles.btnTeamAction}>Gol</button>
        <button onClick={() => {
          registrarEventoMut.mutate({tipo: 'PENAL_A_FAVOR', equipo_id: equipoId, detalle: esLocal ? 'Local' : 'Visita', minuto: 0});
          setPendingAction('PATEAR_PENAL');
        }} className={styles.btnTeamAction}>Penal</button>
        <button onClick={()=>setPendingAction('AMARILLA')} className={styles.btnTeamAction}>Amarilla</button>
        <button onClick={()=>setPendingAction('ROJA')} className={styles.btnTeamAction}>Roja</button>
        <button onClick={()=>setPendingAction('CAMBIO')} className={styles.btnTeamAction}>Cambio</button>
      </div>

      {renderActionForm()}

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
                <button title="Quitar de planilla" onClick={() => eliminarAlineacionMut.mutate(t.jugador_id)} className={styles.btnRemoveTiny} disabled={haSalido}>✖</button>
              </li>
            );
          })}
          {titulares.length < 11 && (
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
                <button title="Quitar de planilla" onClick={() => eliminarAlineacionMut.mutate(s.jugador_id)} className={styles.btnRemoveTiny} disabled={haEntrado}>✖</button>
              </li>
            );
          })}
          {suplentes.length < 7 && (
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

  const [tiempoState, setTiempoState] = useState({ mins: 0, secs: 0, extra: null });

  useEffect(() => {
    if (!partido || !partido.eventos) return;

    const interval = setInterval(() => {
      const evs = partido.eventos;
      const inicio1T = evs.find(e => e.tipo === 'INICIO_PARTIDO');
      const fin1T = evs.find(e => e.tipo === 'FIN_1T');
      const inicio2T = evs.find(e => e.tipo === 'INICIO_2T');
      const finPartido = evs.find(e => e.tipo === 'FIN_PARTIDO');
      const extraTime = evs.filter(e => e.tipo === 'TIEMPO_EXTRA').pop(); // el último

      let totalSecs = 0;
      let running = false;
      const now = Date.now();

      if (inicio1T && !fin1T) {
        const t1 = new Date(inicio1T.registrado_en + 'Z').getTime();
        totalSecs = Math.floor((now - t1) / 1000);
        running = true;
      } else if (fin1T && !inicio2T) {
        totalSecs = 45 * 60; // Pausado en 45:00
      } else if (inicio2T && !finPartido) {
        const t2 = new Date(inicio2T.registrado_en + 'Z').getTime();
        totalSecs = (45 * 60) + Math.floor((now - t2) / 1000);
        running = true;
      } else if (finPartido) {
        totalSecs = 90 * 60; // Clavado en 90:00
      }

      setTiempoState({
        mins: Math.floor(totalSecs / 60),
        secs: totalSecs % 60,
        extra: extraTime ? extraTime.detalle : null
      });

      if (!running && (finPartido || (!inicio1T && !inicio2T))) clearInterval(interval);

    }, 1000);

    return () => clearInterval(interval);
  }, [partido]);

  if (loadP || loadA) return <p className={styles.msg}>Cargando entorno en vivo...</p>;
  if (!partido) return <p className={styles.msg}>Partido no encontrado.</p>;

  return (
    <div className={styles.wrap}>
      
      {/* HEADER MARCADOR EN VIVO */}
      <div className={styles.marcadorTop}>
        <Link to="/admin" className={styles.btnBack}>← Volver</Link>
        <div className={styles.scoreBoard}>
          <div className={styles.scoreTeam}>{partido.local_nombre}</div>
          <div className={styles.scoreCenter}>
            <div className={styles.scoreNumbers}>
              {partido.goles_local || 0} - {partido.goles_visita || 0}
            </div>
            <div className={styles.timerDisplay}>
              {String(tiempoState.mins).padStart(2, '0')}:{String(tiempoState.secs).padStart(2, '0')}
              {tiempoState.extra && <span className={styles.timerExtra}> +{tiempoState.extra}'</span>}
            </div>
          </div>
          <div className={styles.scoreTeam}>{partido.visita_nombre}</div>
        </div>
        <div className={styles.estadoIndicator}>
          {partido.estado === 'pendiente' ? 'Esperando inicio' : (partido.estado === 'en_curso' ? 'EN VIVO' : 'FINALIZADO')}
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
        />
        
        {/* PANEL CENTRAL: EVENTOS RECIENTES Y CONTROLES DE PARTIDO */}
        <div className={styles.feedCol}>
          <div className={styles.matchControls}>
            <button onClick={() => regEvento.mutate({tipo: 'INICIO_PARTIDO', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Inicio 1T</button>
            <button onClick={() => regEvento.mutate({tipo: 'FIN_1T', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Fin 1T</button>
            <button onClick={() => regEvento.mutate({tipo: 'INICIO_2T', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Inicio 2T</button>
            <button onClick={() => regEvento.mutate({tipo: 'FIN_PARTIDO', equipo_id: null, detalle: ''})} className={styles.btnMatchState}>Fin Partido</button>
            <button onClick={() => {
              const min = prompt("Cuantos minutos agrega el arbitro?");
              if (min) regEvento.mutate({tipo: 'TIEMPO_EXTRA', equipo_id: null, detalle: min});
            }} className={styles.btnMatchState}>Adicion</button>
          </div>
          <h3 className={styles.feedTitle}>Eventos Registrados</h3>
          <div className={styles.feedScroll}>
            {partido.eventos?.slice().reverse().map(ev => {
              let subText = '';
              if (ev.tipo === 'CAMBIO' && ev.detalle && ev.detalle.startsWith('{')) {
                try {
                  const d = JSON.parse(ev.detalle);
                  subText = `Entró ${d.entra_nombre}`;
                } catch(e){}
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
                  <button 
                    title="Eliminar evento" 
                    onClick={() => {
                      if (window.confirm("¿Seguro que querés eliminar este evento?")) {
                        eliminarEventoMut.mutate(ev.id);
                      }
                    }} 
                    className={styles.btnDeleteEvent}
                  >
                    🗑️
                  </button>
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
        />
      </div>

    </div>
  );
}
