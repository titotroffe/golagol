import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { torneosApi, partidosApi, prodeApi } from '../api';
import { useTorneoStore, useAuthStore } from '../store';
import styles from './Prode.module.css';
import tablaStyles from './Tabla.module.css';

function PartidoProde({ partido }) {
  const queryClient = useQueryClient();
  const { data: pronostico, isLoading } = useQuery({
    queryKey: ['pronostico', partido.id],
    queryFn: () => prodeApi.miPronostico(partido.id),
    staleTime: 5 * 60 * 1000,
  });

  const [localStr, setLocalStr] = useState('');
  const [visitaStr, setVisitaStr] = useState('');

  // Sincronizar estado local con DB
  useEffect(() => {
    if (pronostico && pronostico.goles_local != null) {
      setLocalStr(pronostico.goles_local.toString());
      setVisitaStr(pronostico.goles_visita.toString());
    }
  }, [pronostico]);

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

  const guardarMut = useMutation({
    mutationFn: (body) => prodeApi.guardarPronostico(partido.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['pronostico', partido.id]);
    },
  });

  const handleSave = () => {
    if (localStr === '' || visitaStr === '') return;
    guardarMut.mutate({
      goles_local: parseInt(localStr, 10),
      goles_visita: parseInt(visitaStr, 10)
    });
  };

  const isClosed = partido.estado !== 'pendiente';
  
  const matchTime = partido.fecha_hora ? new Date(partido.fecha_hora) : null;
  const isTooLate = matchTime ? (matchTime - new Date()) <= 10 * 60000 : false;
  const isLocked = isClosed || isTooLate;
  
  // Calcular clase del borde según si acertó
  let cardClass = styles.partidoCard;
  if (isClosed && pronostico && pronostico.puntos_obtenidos != null) {
    if (pronostico.puntos_obtenidos === 6) cardClass += ` ${styles.cardExacto}`;
    else if (pronostico.puntos_obtenidos === 3) cardClass += ` ${styles.cardSigno}`;
    else cardClass += ` ${styles.cardFallo}`;
  }

  return (
    <div className={cardClass}>
      <div className={styles.mainRow}>
        {/* Equipo Local */}
        <div className={`${styles.equipo} ${styles.equipoLocal}`}>
          <span className={styles.equipoNombre}>{partido.local_nombre}</span>
          {partido.local_escudo 
            ? <img src={partido.local_escudo} alt="" className={styles.escudo} />
            : <span className={styles.escudoVacio} />
          }
        </div>

        {/* Cajas de input */}
        <div className={styles.marcadorCol} style={{ gap: 0 }}>
          <div className={styles.inputGroup}>
            <input
              type="number"
              className={styles.inputGol}
              value={localStr}
              onChange={handleLocalChange}
              disabled={isLocked || guardarMut.isPending}
              placeholder="-"
              min="0"
              max="99"
            />
            <span className={styles.golSep}>-</span>
            <input
              type="number"
              className={styles.inputGol}
              value={visitaStr}
              onChange={handleVisitaChange}
              disabled={isLocked || guardarMut.isPending}
              placeholder="-"
              min="0"
              max="99"
            />
          </div>
        </div>

        {/* Equipo Visita */}
        <div className={`${styles.equipo} ${styles.equipoVisita}`}>
          {partido.visita_escudo 
            ? <img src={partido.visita_escudo} alt="" className={styles.escudo} />
            : <span className={styles.escudoVacio} />
          }
          <span className={styles.equipoNombre}>{partido.visita_nombre}</span>
        </div>
      </div>

      {/* Acciones y resultados extra */}
      <div className={styles.extrasRow}>
        {!isLocked && (localStr !== '' && visitaStr !== '') && (localStr !== pronostico?.goles_local?.toString() || visitaStr !== pronostico?.goles_visita?.toString()) && (
          <button 
            className={styles.btnSave} 
            onClick={handleSave}
            disabled={guardarMut.isPending}
          >
            {guardarMut.isPending ? '...' : 'Guardar'}
          </button>
        )}

        {isTooLate && !isClosed && (
          <div style={{ color: '#8b949e', fontSize: '0.85rem', fontWeight: 600 }}>
            Prode cerrado (arranca pronto)
          </div>
        )}

        {isClosed && (
          <div className={styles.resultadoReal}>
            Real: {partido.goles_local} - {partido.goles_visita}
          </div>
        )}
        
        {isClosed && pronostico?.puntos_obtenidos != null && (
          <div className={styles.puntosObtenidos}>
            +{pronostico.puntos_obtenidos} pts
          </div>
        )}
      </div>
    </div>
  );
}

function ProdeRanking({ torneoId }) {
  const { usuario } = useAuthStore();
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['prode-ranking', torneoId],
    queryFn: () => prodeApi.ranking(torneoId),
  });

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: '42px', borderRadius: '8px', opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
  if (!ranking || ranking.length === 0) return <p className={styles.msg}>No hay puntos en este torneo.</p>;

  // Find user position
  const myRank = ranking.find(r => r.id === usuario?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {myRank && (
        <div className={styles.warningBox} style={{ borderColor: '#58a6ff', color: '#58a6ff', background: 'rgba(88, 166, 255, 0.1)' }}>
          Te encontrás en la posición <strong>#{myRank.posicion}</strong> con <strong>{myRank.puntos}</strong> puntos.
        </div>
      )}
      <div className={tablaStyles.tableOuter}>
        <table className={tablaStyles.table}>
          <thead>
            <tr>
              <th className={tablaStyles.thPos}>#</th>
              <th className={tablaStyles.thEquipo}>Usuario</th>
              <th className={tablaStyles.thPts}>PTS</th>
              <th className={tablaStyles.thExactos}>Exactos</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.id} className={`${tablaStyles.row} ${r.id === usuario?.id ? styles.userMe : ''}`}>
                <td className={tablaStyles.tdPos}>{r.posicion}</td>
                <td className={tablaStyles.tdEquipo} style={{ fontWeight: 600 }}>{r.nombre} {r.apellido}</td>
                <td className={tablaStyles.tdPts}>{r.puntos}</td>
                <td>{r.exactos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProdeGrupos({ torneoId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const joinCodigo = searchParams.get('joinGrupo');

  const [codigo, setCodigo] = useState(joinCodigo || '');
  const [nombre, setNombre] = useState('');
  const queryClient = useQueryClient();

  const { data: grupos, isLoading } = useQuery({
    queryKey: ['prode-grupos', torneoId],
    queryFn: () => prodeApi.misGrupos(),
  });

  const crearMut = useMutation({
    mutationFn: () => prodeApi.crearGrupo({ nombre, torneo_id: torneoId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['prode-grupos', torneoId]);
      setNombre('');
    }
  });

  const unirseMut = useMutation({
    mutationFn: (codigoUnirse) => prodeApi.unirseGrupo(codigoUnirse || codigo),
    onSuccess: () => {
      queryClient.invalidateQueries(['prode-grupos', torneoId]);
      setCodigo('');
      if (joinCodigo) {
        searchParams.delete('joinGrupo');
        setSearchParams(searchParams);
      }
      alert('Te uniste al grupo exitosamente');
    },
    onError: (err) => {
      alert(err.message);
      if (joinCodigo) {
        searchParams.delete('joinGrupo');
        setSearchParams(searchParams);
      }
    }
  });

  useEffect(() => {
    if (joinCodigo && !unirseMut.isPending && !unirseMut.isSuccess && !unirseMut.isError) {
      unirseMut.mutate(joinCodigo);
    }
  }, [joinCodigo]);

  if (isLoading) return <p className={styles.msg}>Cargando torneos privados...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#c9d1d9' }}>Crear Grupo</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Nombre del grupo" value={nombre} onChange={e => setNombre(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #30363d', background: '#0d1117', color: 'white' }} />
            <button onClick={() => crearMut.mutate()} disabled={!nombre || crearMut.isPending} style={{ padding: '8px 16px', background: '#238636', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Crear</button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '250px', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#c9d1d9' }}>Unirse con Código</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Código (ej. A1B2C3)" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #30363d', background: '#0d1117', color: 'white' }} />
            <button onClick={() => unirseMut.mutate()} disabled={!codigo || unirseMut.isPending} style={{ padding: '8px 16px', background: '#1f6feb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Unirse</button>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ borderBottom: '1px solid #30363d', paddingBottom: '8px', marginBottom: '16px' }}>Mis Grupos</h3>
        {!grupos || grupos.length === 0 ? (
          <p className={styles.msg}>No perteneces a ningún grupo privado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {grupos.map(g => (
              <div key={g.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#58a6ff' }}>{g.nombre}</h4>
                    <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Miembros: {g.miembros}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#0d1117', padding: '4px 8px', borderRadius: '4px', border: '1px dashed #58a6ff', color: '#58a6ff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      CÓDIGO: {g.codigo}
                    </div>
                    <button 
                      onClick={() => {
                        const link = `${window.location.origin}/prode?joinGrupo=${g.codigo}`;
                        navigator.clipboard.writeText(link);
                        alert('¡Link copiado al portapapeles!');
                      }}
                      style={{ padding: '4px 8px', background: '#238636', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                      title="Copiar link de invitación"
                    >
                      Copiar Link
                    </button>
                  </div>
                </div>
                <div style={{ padding: '16px' }}>
                  <ProdeGrupoRanking grupoId={g.id} torneoId={torneoId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProdeGrupoRanking({ grupoId, torneoId }) {
  const { usuario } = useAuthStore();
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: ranking, isLoading } = useQuery({
    queryKey: ['prode-grupo-ranking', grupoId],
    queryFn: () => prodeApi.rankingGrupo(grupoId),
  });

  const { data: predicciones, isLoading: loadingPreds } = useQuery({
    queryKey: ['predicciones-completadas', selectedUser?.id, torneoId],
    queryFn: () => prodeApi.prediccionesCompletadas(selectedUser.id, torneoId),
    enabled: !!selectedUser,
  });

  if (isLoading) return <p className={styles.msg}>Cargando ranking del grupo...</p>;
  if (!ranking || ranking.length === 0) return <p className={styles.msg}>No hay datos para este grupo.</p>;

  return (
    <>
      <table className={tablaStyles.table}>
        <thead>
          <tr>
            <th className={tablaStyles.thPos}>#</th>
            <th className={tablaStyles.thEquipo}>Usuario</th>
            <th className={tablaStyles.thPts}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r) => (
            <tr key={r.id} className={`${tablaStyles.row} ${r.id === usuario?.id ? styles.userMe : ''}`}>
              <td className={tablaStyles.tdPos}>{r.posicion}</td>
              <td 
                className={tablaStyles.tdEquipo} 
                style={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', color: '#58a6ff' }}
                onClick={() => setSelectedUser(r)}
              >
                {r.nombre} {r.apellido}
              </td>
              <td className={tablaStyles.tdPts}>{r.puntos}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#e6edf3' }}>Predicciones de {selectedUser.nombre}</h3>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {loadingPreds ? (
                <p className={styles.msg}>Cargando predicciones...</p>
              ) : !predicciones || predicciones.length === 0 ? (
                <p className={styles.msg}>No hay predicciones en partidos finalizados.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {predicciones.map((p) => (
                    <div key={p.partido_id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#8b949e', borderBottom: '1px solid #30363d', paddingBottom: '4px' }}>
                        <span>Fecha {p.fecha_numero}</span>
                        {p.puntos_obtenidos != null && (
                          <span style={{ color: p.puntos_obtenidos === 6 ? '#3fb950' : p.puntos_obtenidos === 3 ? '#d29922' : '#f85149', fontWeight: 'bold' }}>
                            +{p.puntos_obtenidos} pts
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: '#c9d1d9' }}>{p.local_nombre}</span>
                        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#e6edf3' }}>
                            {p.pronostico_local} - {p.pronostico_visita}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>
                            Real: {p.resultado_local} - {p.resultado_visita}
                          </span>
                        </div>
                        <span style={{ flex: 1, fontWeight: 600, color: '#c9d1d9' }}>{p.visita_nombre}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Prode() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);
  const [tab, setTab] = useState('pronosticos');

  const { data: fechas, isLoading: loadingFechas } = useQuery({
    queryKey: ['fechas', torneoActivo?.id],
    queryFn: () => torneosApi.fechas(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  useEffect(() => {
    if (fechas && fechas.length > 0 && !selectedFecha) {
      const validFechas = fechas.filter(f => f.numero >= 8);
      const fecha8 = validFechas.find(f => f.numero === 8);
      const pending = validFechas.find(f => f.estado !== 'cerrada');
      setSelectedFecha(fecha8 || pending || validFechas[0]);
    }
  }, [fechas, selectedFecha]);

  const { data: partidos, isLoading: loadingPartidos } = useQuery({
    queryKey: ['partidos', selectedFecha?.id],
    queryFn: () => partidosApi.porFecha(selectedFecha.id),
    enabled: !!selectedFecha && tab === 'pronosticos',
    refetchInterval: 30000,
  });

  const { data: faltantesData } = useQuery({
    queryKey: ['prode-faltantes', selectedFecha?.id],
    queryFn: () => prodeApi.faltantes(selectedFecha.id),
    enabled: !!selectedFecha,
    refetchInterval: 60000,
  });

  if (!torneoActivo) return <p className={styles.msg}>Seleccioná un torneo</p>;
  if (loadingFechas) return <p className={styles.msg}>Cargando prode...</p>;

  return (
    <div className={styles.wrap}>
      
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'pronosticos' ? styles.tabActive : ''}`} onClick={() => setTab('pronosticos')}>
          Pronósticos
        </button>
        <button className={`${styles.tab} ${tab === 'ranking' ? styles.tabActive : ''}`} onClick={() => setTab('ranking')}>
          Ranking Global
        </button>
        <button className={`${styles.tab} ${tab === 'grupos' ? styles.tabActive : ''}`} onClick={() => setTab('grupos')}>
          Torneos Privados
        </button>
      </div>

      {tab === 'ranking' && <ProdeRanking torneoId={torneoActivo.id} />}
      {tab === 'grupos' && <ProdeGrupos torneoId={torneoActivo.id} />}

      {tab === 'pronosticos' && (
        <>
          {faltantesData && faltantesData.faltantes > 0 && (
            <div className={styles.warningBox}>
              ⚠️ Tenés <strong>{faltantesData.faltantes}</strong> partidos pendientes de pronosticar para la fecha seleccionada. ¡No te olvides de cargarlos!
            </div>
          )}

          <div className={styles.fechasScroll}>
            <div className={styles.fechasTrack}>
              {fechas?.filter(f => f.numero >= 8).map(f => (
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

          <div className={styles.leyenda}>
            <span className={styles.badgeExacto}>+6 Pleno</span>
            <span className={styles.badgeSigno}>+3 Resultado</span>
          </div>

          <div className={styles.partidosList}>
            {loadingPartidos && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: '88px', borderRadius: '12px' }} />
                ))}
              </div>
            )}
            
            {!loadingPartidos && partidos?.length === 0 && (
              <p className={styles.msg}>No hay partidos cargados en esta fecha.</p>
            )}

            {!loadingPartidos && partidos?.map(p => (
              <PartidoProde key={p.id} partido={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
