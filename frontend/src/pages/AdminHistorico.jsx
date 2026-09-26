import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { torneosApi } from '../api';
import styles from './Admin.module.css';

const PARTIDO_VACIO = { local: '', visita: '', goles_local: '', goles_visita: '' };

export default function AdminHistorico() {
  const [nombre, setNombre] = useState('');
  const [temporada, setTemporada] = useState('');
  const [tipo, setTipo] = useState('liga');
  const [partidos, setPartidos] = useState([{ ...PARTIDO_VACIO }]);
  const [exito, setExito] = useState(null);

  const mutation = useMutation({
    mutationFn: torneosApi.cargarHistorico,
    onSuccess: (data) => {
      setExito('ok:' + data.equipos + ' equipos y ' + data.partidos + ' partidos insertados.');
      setNombre(''); setTemporada(''); setTipo('liga');
      setPartidos([{ ...PARTIDO_VACIO }]);
    },
    onError: (err) => setExito('err:' + err.message),
  });

  const updatePartido = (idx, field, value) =>
    setPartidos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));

  const agregarFila = () => setPartidos(prev => [...prev, { ...PARTIDO_VACIO }]);
  const eliminarFila = (idx) => setPartidos(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e) => {
    e.preventDefault();
    setExito(null);
    if (!nombre.trim() || !temporada.trim()) { alert('Nombre y temporada son obligatorios.'); return; }
    const filasValidas = partidos.filter(p => p.local.trim() && p.visita.trim());
    if (filasValidas.length === 0) { alert('Agrega al menos un partido completo.'); return; }
    mutation.mutate({ nombre, temporada, tipo, partidos: filasValidas });
  };

  return (
    <div className={styles.historicoSection}>
      <div className={styles.secHead}>
        <span className={styles.secTitle}>Cargar Torneo Historico</span>
        <span className={styles.secSub}>Carga resultados de torneos anteriores para armar la tabla de posiciones</span>
      </div>
      <form onSubmit={handleSubmit} className={styles.historicoForm}>
        <div className={styles.historicoMeta}>
          <div className={styles.historicoField}>
            <label>Nombre del torneo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Apertura 2022" required />
          </div>
          <div className={styles.historicoField}>
            <label>Anio / Temporada</label>
            <input value={temporada} onChange={e => setTemporada(e.target.value)} placeholder="2022" required />
          </div>
          <div className={styles.historicoField}>
            <label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="liga">Liga</option>
              <option value="copa">Copa</option>
              <option value="clausura">Clausura</option>
              <option value="apertura">Apertura</option>
            </select>
          </div>
        </div>
        <div className={styles.partidosHistTable}>
          <div className={styles.partidosHistHeader}>
            <span>Local</span><span>G</span><span>Visitante</span><span>G</span><span></span>
          </div>
          {partidos.map((p, idx) => (
            <div key={idx} className={styles.partidoHistRow}>
              <input value={p.local} onChange={e => updatePartido(idx, 'local', e.target.value)} placeholder="Equipo local" />
              <input type="number" min="0" max="99" value={p.goles_local} onChange={e => updatePartido(idx, 'goles_local', e.target.value)} placeholder="0" className={styles.golInput} />
              <input value={p.visita} onChange={e => updatePartido(idx, 'visita', e.target.value)} placeholder="Equipo visitante" />
              <input type="number" min="0" max="99" value={p.goles_visita} onChange={e => updatePartido(idx, 'goles_visita', e.target.value)} placeholder="0" className={styles.golInput} />
              <button type="button" onClick={() => eliminarFila(idx)} className={styles.btnEliminarFila} disabled={partidos.length === 1}>X</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarFila} className={styles.btnAgregarFila}>+ Agregar partido</button>
        {exito && (
          <div className={exito.startsWith('ok') ? styles.successBox : styles.errorBox}>
            {exito.startsWith('ok') ? 'Torneo guardado: ' + exito.replace('ok:', '') : 'Error: ' + exito.replace('err:', '')}
          </div>
        )}
        <button type="submit" className={styles.btnPrimaryHist} disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar Torneo Historico'}
        </button>
      </form>
    </div>
  );
}