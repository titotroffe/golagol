import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { torneosApi, partidosApi } from '../api';
import { useTorneoStore } from '../store';
import styles from './Admin.module.css';

function PartidoHorarioCard({ partido }) {
  const queryClient = useQueryClient();
  const formatFechaParaInput = (fh) => {
    if (!fh) return '';
    // Si viene con espacio (ej: "2025-05-15 14:30:00"), cambiar espacio por 'T' y cortar segundos
    return fh.replace(' ', 'T').slice(0, 16);
  };

  const [fechaHora, setFechaHora] = useState(formatFechaParaInput(partido.fecha_hora));
  const [cancha, setCancha] = useState(partido.cancha || '');

  useEffect(() => {
    setFechaHora(formatFechaParaInput(partido.fecha_hora));
    setCancha(partido.cancha || '');
  }, [partido]);

  const actualizarHorarioMut = useMutation({
    mutationFn: (body) => partidosApi.actualizarHorario(partido.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['partidosAdmin', partido.fecha_id]);
      alert('Horario y cancha actualizados correctamente.');
    },
    onError: (err) => {
      alert('Error al actualizar horario: ' + err.message);
    }
  });

  return (
    <div className={styles.partidoCard} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className={styles.mainRow} style={{ justifyContent: 'center', gap: '15px', borderBottom: 'none', paddingBottom: '0' }}>
        <div className={`${styles.equipo} ${styles.equipoLocal}`} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <span className={styles.equipoNombre}>{partido.local_nombre}</span>
          {partido.local_escudo ? <img src={partido.local_escudo} alt="" className={styles.escudo} /> : <span className={styles.escudoVacio} />}
        </div>
        <div style={{ fontWeight: 'bold', color: '#888' }}>VS</div>
        <div className={`${styles.equipo} ${styles.equipoVisita}`} style={{ flex: 1, justifyContent: 'flex-start' }}>
          {partido.visita_escudo ? <img src={partido.visita_escudo} alt="" className={styles.escudo} /> : <span className={styles.escudoVacio} />}
          <span className={styles.equipoNombre}>{partido.visita_nombre}</span>
        </div>
      </div>
      
      <div className={styles.horarioRow}>
        <input 
          type="datetime-local" 
          value={fechaHora} 
          onChange={(e) => setFechaHora(e.target.value)}
          disabled={actualizarHorarioMut.isPending}
          className={`${styles.evInput} ${styles.horarioInput}`}
        />
        <input 
          type="text" 
          placeholder="Cancha" 
          value={cancha} 
          onChange={(e) => setCancha(e.target.value)}
          disabled={actualizarHorarioMut.isPending}
          className={`${styles.evInput} ${styles.horarioInput}`}
        />
        <button 
          className={`${styles.btnSave} ${styles.horarioBtn}`} 
          onClick={() => actualizarHorarioMut.mutate({ fecha_hora: fechaHora, cancha })}
          disabled={actualizarHorarioMut.isPending}
        >
          {actualizarHorarioMut.isPending ? 'Guardando...' : 'Guardar Horario'}
        </button>
      </div>
    </div>
  );
}

export default function AdminHorarios() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);

  const { data: fechas, isLoading: loadingFechas } = useQuery({
    queryKey: ['fechas', torneoActivo?.id],
    queryFn: () => torneosApi.fechas(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  useEffect(() => {
    if (fechas && fechas.length > 0 && !selectedFecha) {
      const pending = fechas.find(f => f.estado !== 'cerrada');
      setSelectedFecha(pending || fechas[0]);
    }
  }, [fechas, selectedFecha]);

  const { data: partidos, isLoading: loadingPartidos } = useQuery({
    queryKey: ['partidosAdmin', selectedFecha?.id],
    queryFn: () => partidosApi.porFecha(selectedFecha.id),
    enabled: !!selectedFecha,
    refetchInterval: false,
  });

  if (!torneoActivo) return <div className={styles.msg}>Seleccioná un torneo.</div>;
  if (loadingFechas) return <p className={styles.msg}>Cargando fechas...</p>;

  return (
    <>
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

      <div className={styles.partidosList}>
        {loadingPartidos && <p className={styles.msg}>Cargando partidos...</p>}
        {!loadingPartidos && partidos?.length === 0 && (
          <p className={styles.msg}>No hay partidos en esta fecha.</p>
        )}
        {!loadingPartidos && partidos?.map(p => (
          <PartidoHorarioCard key={p.id} partido={p} />
        ))}
      </div>
    </>
  );
}
