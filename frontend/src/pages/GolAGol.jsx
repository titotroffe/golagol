import { useState } from 'react';
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
  
  const [cambiandoId, setCambiandoId] = useState(null);

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

  const confirmarCambio = (saleId, e) => {
    const entraId = parseInt(e.target.value, 10);
    if (!entraId) {
      setCambiandoId(null);
      return;
    }
    const entraSuplente = suplentes.find(s => s.jugador_id === entraId);
    
    handleAction(saleId, 'CAMBIO', { 
      entra_id: entraId, 
      entra_nombre: entraSuplente ? `${entraSuplente.nombre} ${entraSuplente.apellido}` : 'Jugador' 
    });
    setCambiandoId(null);
  };

  return (
    <div className={styles.equipoCol}>
      <h2 className={styles.eqTitle}>{nombre}</h2>

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

                {cambiandoId === t.jugador_id ? (
                  <div className={styles.cambioSelector}>
                    <select onChange={(e) => confirmarCambio(t.jugador_id, e)} autoFocus>
                      <option value="">Seleccionar suplente que entra...</option>
                      {suplentesDisponiblesParaEntrar.map(s => (
                        <option key={s.id} value={s.jugador_id}>{s.apellido ? `${s.nombre} ${s.apellido}` : s.nombre}</option>
                      ))}
                    </select>
                    <button onClick={() => setCambiandoId(null)} className={styles.btnRemove}>Cancelar</button>
                  </div>
                ) : (
                  <div className={styles.acciones}>
                    <button title="Gol" onClick={() => handleAction(t.jugador_id, 'GOL')} className={styles.btnAction} disabled={inhabilitado}>⚽</button>
                    <button title="Penal" onClick={() => handleAction(t.jugador_id, 'PENAL')} className={styles.btnAction} disabled={inhabilitado}>🎯</button>
                    <button title="Amarilla" onClick={() => handleAction(t.jugador_id, 'AMARILLA')} className={styles.btnAction} disabled={inhabilitado}>🟨</button>
                    <button title="Roja" onClick={() => handleAction(t.jugador_id, 'ROJA')} className={styles.btnAction} disabled={inhabilitado}>🟥</button>
                    <button title="Cambio (Sale)" onClick={() => setCambiandoId(t.jugador_id)} className={styles.btnAction} disabled={inhabilitado}>🔄</button>
                    <button title="Quitar de planilla" onClick={() => eliminarAlineacionMut.mutate(t.jugador_id)} className={styles.btnRemove} disabled={haSalido}>×</button>
                  </div>
                )}
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
                <div className={styles.acciones}>
                  {/* Los suplentes solo pueden accionar si entraron a la cancha */}
                  <button title="Gol" onClick={() => handleAction(s.jugador_id, 'GOL')} className={styles.btnAction} disabled={inhabilitado}>⚽</button>
                  <button title="Penal" onClick={() => handleAction(s.jugador_id, 'PENAL')} className={styles.btnAction} disabled={inhabilitado}>🎯</button>
                  <button title="Amarilla" onClick={() => handleAction(s.jugador_id, 'AMARILLA')} className={styles.btnAction} disabled={inhabilitado}>🟨</button>
                  <button title="Roja" onClick={() => handleAction(s.jugador_id, 'ROJA')} className={styles.btnAction} disabled={inhabilitado}>🟥</button>
                  <button title="Quitar de planilla" onClick={() => eliminarAlineacionMut.mutate(s.jugador_id)} className={styles.btnRemove} disabled={haEntrado}>×</button>
                </div>
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

  if (loadP || loadA) return <p className={styles.msg}>Cargando entorno en vivo...</p>;
  if (!partido) return <p className={styles.msg}>Partido no encontrado.</p>;

  return (
    <div className={styles.wrap}>
      
      {/* HEADER MARCADOR EN VIVO */}
      <div className={styles.marcadorTop}>
        <Link to="/admin" className={styles.btnBack}>← Volver</Link>
        <div className={styles.scoreBoard}>
          <div className={styles.scoreTeam}>{partido.local_nombre}</div>
          <div className={styles.scoreNumbers}>
            {partido.goles_local || 0} - {partido.goles_visita || 0}
          </div>
          <div className={styles.scoreTeam}>{partido.visita_nombre}</div>
        </div>
        <div className={styles.estadoIndicator}>
          {partido.estado === 'pendiente' ? 'Esperando inicio' : (partido.estado === 'en_curso' ? '🔴 EN VIVO' : 'FINALIZADO')}
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
            <button onClick={() => handleMatchState('INICIO_PARTIDO')} className={styles.btnMatchState}>⏱ Inicio 1T</button>
            <button onClick={() => handleMatchState('FIN_1T')} className={styles.btnMatchState}>🛑 Fin 1T</button>
            <button onClick={() => handleMatchState('INICIO_2T')} className={styles.btnMatchState}>⏱ Inicio 2T</button>
            <button onClick={() => handleMatchState('FIN_PARTIDO')} className={styles.btnMatchState}>🏁 Fin Partido</button>
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
                      {ev.tipo === 'GOL' ? '⚽' : 
                       ev.tipo === 'PENAL' ? '🎯' : 
                       ev.tipo === 'AMARILLA' ? '🟨' : 
                       ev.tipo === 'ROJA' ? '🟥' : 
                       ev.tipo === 'CAMBIO' ? '🔄' : 
                       ev.tipo.startsWith('INICIO') || ev.tipo.startsWith('FIN') ? '⏱' : '▪️'}
                    </span>
                    <div className={styles.evDetails}>
                      <strong>
                        {ev.tipo === 'CAMBIO' ? `Salió ${ev.jugador_apellido || ev.jugador_nombre}` : 
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
