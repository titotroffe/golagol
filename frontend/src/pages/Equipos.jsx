import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equiposApi } from '../api';
import { useAuthStore } from '../store';
import styles from './Equipos.module.css';

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
                <li key={j.id} className={styles.jugadorItem}>
                  <span className={styles.jName}>{j.apellido ? `${j.nombre} ${j.apellido}` : j.nombre}</span>
                  {j.dorsal && <span className={styles.jDorsal}>{j.dorsal}</span>}
                </li>
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
      <div className={styles.secHead}>
        <span className={styles.secTitle}>Equipos y Planteles</span>
        <span className={styles.secSub}>Navegá los planteles de cada club</span>
      </div>

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
