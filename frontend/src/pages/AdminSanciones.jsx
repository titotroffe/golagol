import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sancionesApi, equiposApi } from '../api';
import { useTorneoStore } from '../store';
import styles from './AdminSanciones.module.css';

export default function AdminSanciones() {
  const { torneoActivo } = useTorneoStore();
  const queryClient = useQueryClient();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ fechas_a_cumplir: 1, fechas_cumplidas: 0, motivo: '' });

  const [formData, setFormData] = useState({
    jugador_nombre: '',
    fechas_a_cumplir: 1,
    motivo: ''
  });

  const { data: sanciones = [], isLoading: cargandoSanciones } = useQuery({
    queryKey: ['adminSanciones', torneoActivo?.id],
    queryFn: () => sancionesApi.listarPorTorneo(torneoActivo.id),
    enabled: !!torneoActivo
  });

  const { data: equipos = [] } = useQuery({
    queryKey: ['equipos'],
    queryFn: equiposApi.listar
  });

  const { data: jugadores = [] } = useQuery({
    queryKey: ['plantel', equipoSeleccionado],
    queryFn: () => equiposApi.plantel(equipoSeleccionado),
    enabled: !!equipoSeleccionado
  });

  const crearMut = useMutation({
    mutationFn: (body) => sancionesApi.crear({ ...body, torneo_id: torneoActivo.id, equipo_id: equipoSeleccionado }),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminSanciones', torneoActivo.id]);
      queryClient.invalidateQueries(['inicio', torneoActivo.id]);
      setMostrarForm(false);
      setFormData({ jugador_nombre: '', fechas_a_cumplir: 1, motivo: '' });
      setEquipoSeleccionado('');
    }
  });

  const toggleSancionMut = useMutation({
    mutationFn: ({ id, activa }) => sancionesApi.editar(id, { activa: activa ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminSanciones', torneoActivo.id]);
      queryClient.invalidateQueries(['inicio', torneoActivo.id]);
    }
  });

  const eliminarMut = useMutation({
    mutationFn: (id) => sancionesApi.eliminar(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminSanciones', torneoActivo.id]);
      queryClient.invalidateQueries(['inicio', torneoActivo.id]);
    }
  });

  const editarMut = useMutation({
    mutationFn: (body) => sancionesApi.editar(body.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminSanciones', torneoActivo.id]);
      queryClient.invalidateQueries(['inicio', torneoActivo.id]);
      setEditingId(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.jugador_nombre || !equipoSeleccionado) return alert('Seleccioná un equipo y escribí/seleccioná un jugador');
    crearMut.mutate(formData);
  };

  if (!torneoActivo) return <div className={styles.msg}>Seleccioná un torneo.</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Control de Sanciones</h1>
        <button 
          className={styles.btnPrimary} 
          onClick={() => setMostrarForm(!mostrarForm)}
        >
          {mostrarForm ? 'Cancelar' : 'Cargar Sanción'}
        </button>
      </div>

      {mostrarForm && (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <h3>Nueva Sanción</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Equipo</label>
              <select 
                value={equipoSeleccionado}
                onChange={(e) => setEquipoSeleccionado(e.target.value)}
                required
              >
                <option value="">Seleccionar Equipo</option>
                {equipos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Jugador (Seleccionar o tipear nombre)</label>
              <input 
                type="text"
                list="jugadores-list"
                placeholder="Nombre del jugador"
                value={formData.jugador_nombre}
                onChange={(e) => setFormData({ ...formData, jugador_nombre: e.target.value })}
                required
                disabled={!equipoSeleccionado}
                autoComplete="off"
              />
              <datalist id="jugadores-list">
                {jugadores.map(j => (
                  <option key={j.id} value={`${j.nombre} ${j.apellido}`.trim()} />
                ))}
              </datalist>
            </div>

            <div className={styles.formGroup}>
              <label>Fechas de Suspensión</label>
              <input 
                type="number" 
                min="1"
                value={formData.fechas_a_cumplir}
                onChange={(e) => setFormData({ ...formData, fechas_a_cumplir: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label>Motivo (opcional)</label>
              <input 
                type="text" 
                placeholder="Ej: Roja directa, exceso verbal..."
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              />
            </div>
          </div>
          
          <button type="submit" className={styles.btnSubmit} disabled={crearMut.isPending}>
            {crearMut.isPending ? 'Guardando...' : 'Guardar Sanción'}
          </button>
        </form>
      )}

      {cargandoSanciones ? (
        <p className={styles.msg}>Cargando...</p>
      ) : sanciones.length === 0 ? (
        <p className={styles.msg}>No hay jugadores sancionados en este torneo.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th>Fechas</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sanciones.map(s => (
                <tr key={s.id} className={s.activa ? styles.rowActive : styles.rowInactive}>
                  <td>
                    {s.activa ? (
                      <span className={styles.badgeActiva}>ACTIVA</span>
                    ) : (
                      <span className={styles.badgeCumplida}>CUMPLIDA</span>
                    )}
                  </td>
                  <td><strong>{s.nombre} {s.apellido}</strong></td>
                  <td>{s.equipo_nombre}</td>
                  <td>
                    {editingId === s.id ? (
                      <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
                        <input type="number" value={editData.fechas_cumplidas} onChange={e => setEditData({...editData, fechas_cumplidas: parseInt(e.target.value) || 0})} style={{width: '45px', background: '#0d1117', color: 'white', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 4px', textAlign: 'center'}} />
                        /
                        <input type="number" value={editData.fechas_a_cumplir} onChange={e => setEditData({...editData, fechas_a_cumplir: parseInt(e.target.value) || 0})} style={{width: '45px', background: '#0d1117', color: 'white', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 4px', textAlign: 'center'}} />
                      </div>
                    ) : (
                      <>{s.fechas_cumplidas} / {s.fechas_a_cumplir}</>
                    )}
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <input type="text" value={editData.motivo} onChange={e => setEditData({...editData, motivo: e.target.value})} style={{width: '100%', background: '#0d1117', color: 'white', border: '1px solid #30363d', borderRadius: '4px', padding: '4px'}} />
                    ) : (
                      s.motivo || '-'
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {editingId === s.id ? (
                        <>
                          <button 
                            className={styles.btnPrimary} 
                            style={{padding: '4px 8px', fontSize: '0.8rem'}}
                            onClick={() => editarMut.mutate({ id: s.id, ...editData })}
                          >
                            Guardar
                          </button>
                          <button 
                            className={styles.btnToggle} 
                            style={{padding: '4px 8px', fontSize: '0.8rem'}}
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            className={styles.btnPrimary}
                            style={{padding: '4px 8px', fontSize: '0.8rem', background: '#1f6feb', borderColor: '#1f6feb'}}
                            onClick={() => {
                              setEditingId(s.id);
                              setEditData({ fechas_a_cumplir: s.fechas_a_cumplir, fechas_cumplidas: s.fechas_cumplidas, motivo: s.motivo || '' });
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button 
                            className={styles.btnToggle}
                            onClick={() => toggleSancionMut.mutate({ id: s.id, activa: !s.activa })}
                          >
                            {s.activa ? 'Marcar Cumplida' : 'Reactivar'}
                          </button>
                          <button 
                            className={styles.btnDelete}
                            onClick={() => {
                              if(confirm('¿Eliminar esta sanción permanentemente?')) {
                                eliminarMut.mutate(s.id);
                              }
                            }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
