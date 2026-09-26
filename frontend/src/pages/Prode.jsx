import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { torneosApi, partidosApi, prodeApi } from '../api';
import { useTorneoStore } from '../store';
import styles from './Prode.module.css';

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
  
  // Calcular clase del borde según si acertó
  let cardClass = styles.partidoCard;
  if (isClosed && pronostico && pronostico.puntos_obtenidos != null) {
    if (pronostico.puntos_obtenidos === 6) cardClass += ` ${styles.cardExacto}`;
    else if (pronostico.puntos_obtenidos === 3) cardClass += ` ${styles.cardSigno}`;
    else cardClass += ` ${styles.cardFallo}`;
  }

  return (
    <div className={cardClass}>
      
      {/* Equipo Local */}
      <div className={`${styles.equipo} ${styles.equipoLocal}`}>
        <span className={styles.equipoNombre}>{partido.local_nombre}</span>
        {partido.local_escudo 
          ? <img src={partido.local_escudo} alt="" className={styles.escudo} />
          : <span className={styles.escudoVacio} />
        }
      </div>

      {/* Cajas de input / resultado */}
      <div className={styles.marcadorCol}>
        <div className={styles.inputGroup}>
          <input
            type="number"
            className={styles.inputGol}
            value={localStr}
            onChange={handleLocalChange}
            disabled={isClosed || guardarMut.isPending}
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
            disabled={isClosed || guardarMut.isPending}
            placeholder="-"
            min="0"
            max="99"
          />
        </div>
        
        {!isClosed && (localStr !== '' && visitaStr !== '') && (localStr !== pronostico?.goles_local?.toString() || visitaStr !== pronostico?.goles_visita?.toString()) && (
          <button 
            className={styles.btnSave} 
            onClick={handleSave}
            disabled={guardarMut.isPending}
          >
            {guardarMut.isPending ? '...' : 'Guardar'}
          </button>
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

      {/* Equipo Visita */}
      <div className={`${styles.equipo} ${styles.equipoVisita}`}>
        {partido.visita_escudo 
          ? <img src={partido.visita_escudo} alt="" className={styles.escudo} />
          : <span className={styles.escudoVacio} />
        }
        <span className={styles.equipoNombre}>{partido.visita_nombre}</span>
      </div>

    </div>
  );
}

export default function Prode() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);

  const { data: fechas, isLoading: loadingFechas } = useQuery({
    queryKey: ['fechas', torneoActivo?.id],
    queryFn: () => torneosApi.fechas(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  // Automatically select Fecha 8 or the best one
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
    enabled: !!selectedFecha,
    refetchInterval: 30000,
  });

  if (!torneoActivo) return <p className={styles.msg}>Seleccioná un torneo</p>;
  if (loadingFechas) return <p className={styles.msg}>Cargando prode...</p>;

  return (
    <div className={styles.wrap}>


      {/* Selector de Fechas (Pills horizontales) */}
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

      {/* Leyenda */}
      <div className={styles.leyenda}>
        <span className={styles.badgeExacto}>+6 Pleno</span>
        <span className={styles.badgeSigno}>+3 Resultado</span>
      </div>

      {/* Lista de partidos de la fecha para pronosticar */}
      <div className={styles.partidosList}>
        {loadingPartidos && <p className={styles.msg}>Cargando partidos...</p>}
        
        {!loadingPartidos && partidos?.length === 0 && (
          <p className={styles.msg}>No hay partidos cargados en esta fecha.</p>
        )}

        {!loadingPartidos && partidos?.map(p => (
          <PartidoProde key={p.id} partido={p} />
        ))}
      </div>
    </div>
  );
}
