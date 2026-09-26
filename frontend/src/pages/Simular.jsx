import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { torneosApi, partidosApi } from "../api";
import { useTorneoStore } from "../store";
import styles from "./Tabla.module.css";
import est from "./Estadisticas.module.css";
import fix from "./Fixture.module.css";

export default function Simular() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [tablaSimulada, setTablaSimulada] = useState(null);

  const { data: fechas } = useQuery({
    queryKey: ["fechas", torneoActivo?.id],
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
    queryKey: ["partidos-simular", selectedFecha?.id],
    queryFn: () => partidosApi.porFecha(selectedFecha.id),
    enabled: !!selectedFecha,
  });

  const simularMut = useMutation({
    mutationFn: () => {
      const resultados = Object.entries(overrides)
        .filter(([, v]) => v.local !== undefined && v.local !== "" && v.visita !== undefined && v.visita !== "")
        .map(([id, v]) => ({
          partido_id: parseInt(id),
          goles_local: parseInt(v.local),
          goles_visita: parseInt(v.visita),
        }));
      return torneosApi.simularTabla(torneoActivo.id, resultados);
    },
    onSuccess: (data) => setTablaSimulada(data),
  });

  const handleChange = (id, campo, val) => {
    const num = parseInt(val, 10);
    if (val !== "" && (isNaN(num) || num < 0 || num > 99)) return;
    setOverrides(prev => ({
      ...prev,
      [id]: { ...prev[id], [campo]: val }
    }));
  };

  const resetear = () => { setOverrides({}); setTablaSimulada(null); };

  if (!torneoActivo) return <p className={styles.msg}>Selecciona un torneo</p>;

  return (
    <div className={est.wrap}>
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Simulador de Tabla</span>
          <span className={est.secSub}>Ingresa o modifica resultados hipoteticos para ver como quedaria la tabla</span>
        </div>

        <div className={fix.fechasScroll} style={{ marginTop: '10px' }}>
          <div className={fix.fechasTrack}>
            {fechas?.map(f => (
              <button
                key={f.id}
                className={`${fix.fechaPill} ${selectedFecha?.id === f.id ? fix.fechaActive : ''}`}
                onClick={() => setSelectedFecha(f)}
              >
                F{f.numero}
              </button>
            ))}
          </div>
        </div>

        <p className={est.simInfo} style={{ marginTop: '8px' }}>
          Podes cambiar resultados pasados o futuros. Completa los que quieras y presiona Simular.
        </p>

        {loadingPartidos && <p className={styles.msg}>Cargando partidos...</p>}

        {!loadingPartidos && (!partidos || partidos.length === 0) && (
          <p className={styles.msg}>No hay partidos para esta fecha.</p>
        )}

        {!loadingPartidos && partidos && partidos.length > 0 && (
          <div className={est.simuladorGrid}>
            {partidos.map(p => {
              const valLocal = overrides[p.id]?.local !== undefined ? overrides[p.id].local : (p.estado === 'finalizado' ? p.goles_local : "");
              const valVisita = overrides[p.id]?.visita !== undefined ? overrides[p.id].visita : (p.estado === 'finalizado' ? p.goles_visita : "");
              return (
                <div key={p.id} className={est.simPartidoRow}>
                  <span className={`${est.simEquipo} ${est.simEquipoLocal}`}>{p.local_nombre}</span>
                  <input
                    type="number"
                    min="0" max="99"
                    className={est.simInput}
                    value={valLocal}
                    onChange={e => handleChange(p.id, "local", e.target.value)}
                    placeholder="-"
                  />
                  <span className={est.simSep}>-</span>
                  <input
                    type="number"
                    min="0" max="99"
                    className={est.simInput}
                    value={valVisita}
                    onChange={e => handleChange(p.id, "visita", e.target.value)}
                    placeholder="-"
                  />
                  <span className={est.simEquipo}>{p.visita_nombre}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className={est.btnRow}>
          <button
            className={est.btnSimular}
            onClick={() => simularMut.mutate()}
            disabled={simularMut.isPending}
          >
            {simularMut.isPending ? "Calculando..." : "Simular tabla"}
          </button>
          {tablaSimulada && (
            <button className={est.btnReset} onClick={resetear}>
              Limpiar simulacion
            </button>
          )}
        </div>

        {tablaSimulada && (
          <div className={est.simResultados}>
            <div className={est.secHead} style={{marginTop: "8px"}}>
              <span className={est.secTitle}>Resultado de la Simulacion</span>
              <span className={est.secSub}>Tabla hipotetica considerando los resultados ingresados</span>
            </div>
            <div className={est.simTablaWrap}>
              <table className={est.table} style={{width:"100%", borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th className={est.thPos}>#</th>
                    <th className={est.thJugador}>Equipo</th>
                    <th className={est.thNum}>PTS</th>
                    <th className={est.thNum}>PJ</th>
                    <th className={est.thNum}>PG</th>
                    <th className={est.thNum}>PE</th>
                    <th className={est.thNum}>PP</th>
                    <th className={est.thNum}>GF</th>
                    <th className={est.thNum}>GC</th>
                    <th className={est.thNum}>DG</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaSimulada.map((eq, idx) => (
                    <tr key={eq.equipo_id} className={est.row}>
                      <td className={`${est.tdPos} ${idx < 8 ? styles.posPlayoff : ""}`}>{eq.posicion}</td>
                      <td style={{fontWeight:600, padding:"9px 10px"}}>{eq.nombre}</td>
                      <td style={{textAlign:"center", fontWeight:800, color:"#d29922"}}>{eq.puntos}</td>
                      <td style={{textAlign:"center"}}>{eq.pj}</td>
                      <td style={{textAlign:"center"}}>{eq.pg}</td>
                      <td style={{textAlign:"center"}}>{eq.pe}</td>
                      <td style={{textAlign:"center"}}>{eq.pp}</td>
                      <td style={{textAlign:"center"}}>{eq.gf}</td>
                      <td style={{textAlign:"center"}}>{eq.gc}</td>
                      <td style={{textAlign:"center", color: eq.dg >= 0 ? "#3fb950" : "#f85149", fontWeight:700}}>
                        {eq.dg >= 0 ? "+" : ""}{eq.dg}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}