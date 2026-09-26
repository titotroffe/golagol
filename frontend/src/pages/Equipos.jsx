import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equiposApi, jugadoresApi } from '../api';
import { useAuthStore } from '../store';
import styles from './Equipos.module.css';

function JugadorRow({ j, esAdmin, equipoId }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nombre: j.nombre,
    apellido: j.apellido || '',
    dni: j.dni || '',
    fecha_nacimiento: j.fecha_nacimiento || ''
  });

  const editarMut = useMutation({
    mutationFn: (body) => jugadoresApi.editar(body.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['plantel', equipoId]);
      setIsEditing(false);
    }
  });

  if (isEditing) {
    return (
      <li className={styles.jugadorItem} style={{ flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Nombre" style={{flex: 1, background: '#0d1117', color: 'white', border: '1px solid #30363d', padding: '6px', borderRadius: '4px'}} />
          <input value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} placeholder="Apellido" style={{flex: 1, background: '#0d1117', color: 'white', border: '1px solid #30363d', padding: '6px', borderRadius: '4px'}} />
        </div>
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} placeholder="DNI" style={{flex: 1, background: '#0d1117', color: 'white', border: '1px solid #30363d', padding: '6px', borderRadius: '4px'}} />
          <input type="date" value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} style={{flex: 1, background: '#0d1117', color: 'white', border: '1px solid #30363d', padding: '6px', borderRadius: '4px'}} />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%', marginTop: '4px' }}>
          <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => editarMut.mutate({ id: j.id, ...formData })} disabled={editarMut.isPending} style={{ background: '#1f6feb', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>
            {editarMut.isPending ? '...' : 'Guardar'}
          </button>
        </div>
      </li>
    );
  }

  // Parsear fecha para mostrar sin desfase horario
  let fechaFormat = '';
  if (j.fecha_nacimiento) {
    const [y, m, d] = j.fecha_nacimiento.split('-');
    fechaFormat = `${d}/${m}/${y}`;
  }

  return (
    <li className={styles.jugadorItem}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className={styles.jName}>{j.apellido ? `${j.nombre} ${j.apellido}` : j.nombre}</span>
        {(j.dni || j.fecha_nacimiento) && (
          <span style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: '2px' }}>
            {j.dni ? `DNI: ${j.dni}` : ''}
            {j.dni && j.fecha_nacimiento ? ' | ' : ''}
            {j.fecha_nacimiento ? `Nac: ${fechaFormat}` : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {j.dorsal && <span className={styles.jDorsal}>{j.dorsal}</span>}
        {esAdmin && (
          <button onClick={() => setIsEditing(true)} title="Editar Jugador" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', opacity: 0.7 }}>✏️</button>
        )}
      </div>
    </li>
  );
}

function PlantelTeam({ equipo }) {
  const queryClient = useQueryClient();
  const usuario = useAuthStore(s => s.usuario);
  const esAdmin = usuario?.rol === 'admin' || usuario?.rol === 'reportero';
  
  const [bulkText, setBulkText] = useState('');

  const { data: plantel, isLoading } = useQuery({
    queryKey: ['plantel', equipo.id],
    queryFn: () => equiposApi.plantel(equipo.id),
  });

  const agregarJugadorMut = useMutation({
    mutationFn: (body) => equiposApi.agregarJugador(equipo.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['plantel', equipo.id]);
    }
  });

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l);
    
    let successCount = 0;
    let errorCount = 0;

    for (const line of lines) {
      // Separar por espacios o tabs (para copiar/pegar desde excel/pdf)
      const parts = line.split(/\s+/);
      const nombre = parts[0];
      const apellido = parts.slice(1).join(' ');
      
      try {
        await agregarJugadorMut.mutateAsync({ nombre, apellido });
        successCount++;
      } catch (err) {
        console.error('Error cargando jugador', line, err);
        errorCount++;
      }
    }
    setBulkText('');
    
    if (errorCount > 0) {
      alert(`Se cargaron ${successCount} jugadores. Hubo ${errorCount} errores (revisar consola o formato).`);
    } else {
      alert(`✅ Se cargaron los ${successCount} jugadores correctamente.`);
    }
  };

  return (
    <div className={styles.plantelWrapper}>
      <div className={styles.teamHeader}>
        {equipo.escudo_url 
          ? <img src={equipo.escudo_url} alt="" className={styles.escudoBig} />
          : <span className={styles.escudoVacioBig} />
        }
        <h2 className={styles.teamName}>{equipo.nombre}</h2>
      </div>

      <div className={styles.rosterContainer}>
        <div className={styles.rosterCol}>
          <h3 className={styles.subTitle}>Jugadores ({plantel?.length || 0})</h3>
          
          {isLoading ? (
            <p className={styles.msg}>Cargando plantel...</p>
          ) : (
            <ul className={styles.jugadoresList}>
              {plantel?.length === 0 && <p className={styles.msg}>No hay jugadores cargados.</p>}
              {plantel?.map(j => (
                <JugadorRow key={j.id} j={j} esAdmin={esAdmin} equipoId={equipo.id} />
              ))}
            </ul>
          )}
        </div>

        {esAdmin && (
          <div className={styles.adminCol}>
            <h3 className={styles.subTitle}>Carga Rápida (Admin)</h3>
            <p className={styles.helpText}>Escribí o pegá una lista de jugadores (uno por línea). El primer texto será el nombre y el resto el apellido.</p>
            <textarea
              className={styles.bulkInput}
              rows={10}
              placeholder="Ej:\nLionel Messi\nEmiliano Martinez\nAngel Di Maria"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              disabled={agregarJugadorMut.isPending}
            />
            <button 
              className={styles.btnBulk} 
              onClick={handleBulkAdd}
              disabled={agregarJugadorMut.isPending || !bulkText.trim()}
            >
              {agregarJugadorMut.isPending ? 'Cargando...' : 'Cargar Jugadores'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


export default function Equipos() {
  const [selectedEquipoId, setSelectedEquipoId] = useState(null);

  const { data: equipos, isLoading } = useQuery({
    queryKey: ['equipos'],
    queryFn: () => equiposApi.listar(),
  });

  const selectedEquipo = equipos?.find(e => e.id === selectedEquipoId);

  return (
    <div className={styles.wrap}>


      {isLoading ? (
        <p className={styles.msg}>Cargando equipos...</p>
      ) : (
        <div className={styles.equiposScroll}>
          <div className={styles.equiposTrack}>
            {equipos?.map(eq => (
              <button
                key={eq.id}
                className={`${styles.equipoPill} ${selectedEquipoId === eq.id ? styles.equipoActive : ''}`}
                onClick={() => setSelectedEquipoId(eq.id)}
              >
                {eq.escudo_url 
                  ? <img src={eq.escudo_url} alt="" className={styles.escudoSmall} />
                  : <span className={styles.escudoVacioSmall} />
                }
                <span>{eq.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedEquipo ? (
        <PlantelTeam equipo={selectedEquipo} />
      ) : (
        !isLoading && <p className={styles.msg}>Seleccioná un equipo para ver su plantel.</p>
      )}

    </div>
  );
}
