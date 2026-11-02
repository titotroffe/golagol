import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { torneosApi, partidosApi } from "../api";
import { useTorneoStore } from "../store";
import styles from "./Tabla.module.css";
import est from "./Estadisticas.module.css";
import prodeStyles from "./Prode.module.css";
import fixStyles from "./Fixture.module.css";

export default function Simular() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);
  const [selectedFecha, setSelectedFecha] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [tablaSimulada, setTablaSimulada] = useState(null);

  const { data: fechas, isLoading: loadingFechas } = useQuery({
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
    queryKey: ["partidos", selectedFecha?.id],
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

  const handleChange = (partido, campo, val) => {
    const num = parseInt(val, 10);
    if (val !== "" && (isNaN(num) || num < 0 || num > 99)) return;
    setOverrides(prev => {
      const current = prev[partido.id] || {};
      const baseLocal = partido.estado === 'finalizado' ? partido.goles_local : "";
      const baseVisita = partido.estado === 'finalizado' ? partido.goles_visita : "";

      return {
        ...prev,
        [partido.id]: {
          local: campo === 'local' ? val : (current.local !== undefined ? current.local : baseLocal),
          visita: campo === 'visita' ? val : (current.visita !== undefined ? current.visita : baseVisita)
        }
      };
    });
  };

  const resetear = () => { setOverrides({}); setTablaSimulada(null); };

  if (!torneoActivo) return <p className={prodeStyles.msg}>Seleccioná un torneo</p>;
  if (loadingFechas) return <p className={prodeStyles.msg}>Cargando fechas...</p>;

  return (
    <div className={prodeStyles.wrap}>
      <section className={prodeStyles.wrap}>

        {/* Selector de Fechas (Pills horizontales) */}
        <div className={prodeStyles.fechasScroll}>
          <div className={prodeStyles.fechasTrack}>
            {fechas?.map(f => (
              <button
                key={f.id}
                className={`${prodeStyles.fechaPill} ${selectedFecha?.id === f.id ? prodeStyles.fechaActive : ''}`}
                onClick={() => setSelectedFecha(f)}
              >
                F{f.numero}
              </button>
            ))}
          </div>
        </div>

        <p className={prodeStyles.secSub} style={{ margin: 0 }}>
          Podés cambiar resultados pasados o futuros. Completá los que quieras y presioná Simular.
        </p>

        {/* Lista de partidos de la fecha */}
        <div className={prodeStyles.partidosGrid}>
          {loadingPartidos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '88px', borderRadius: '12px' }} />
              ))}
            </div>
          )}

          {!loadingPartidos && partidos?.length === 0 && (
            <p className={prodeStyles.msg}>No hay partidos cargados en esta fecha.</p>
          )}

          {!loadingPartidos && partidos?.map(p => {
            const valLocal = overrides[p.id]?.local !== undefined ? overrides[p.id].local : (p.estado === 'finalizado' ? p.goles_local : "");
            const valVisita = overrides[p.id]?.visita !== undefined ? overrides[p.id].visita : (p.estado === 'finalizado' ? p.goles_visita : "");
            const modificado = overrides[p.id] !== undefined;

            const date = p.fecha_hora ? new Date(p.fecha_hora) : null;
            const dia = date ? date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Pronto';
            const hora = date ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'A def.';

            return (
              <div key={p.id} className={prodeStyles.partidoCard}>
                <div className={prodeStyles.equiposContainer}>
                  {/* Equipo Local */}
                  <div className={prodeStyles.equipo}>
                    {p.local_escudo && <img src={p.local_escudo} alt="" className={prodeStyles.escudo} />}
                    <span className={prodeStyles.equipoNombre}>{p.local_nombre}</span>
                  </div>

                  {/* Cajas de input */}
                  <div className={prodeStyles.marcadorWrapper}>
                    <div className={prodeStyles.inputGroup}>
                      <input
                        type="number"
                        className={prodeStyles.inputGol}
                        value={valLocal}
                        onChange={e => handleChange(p, "local", e.target.value)}
                        placeholder="-"
                        min="0"
                        max="99"
                      />
                      <span className={prodeStyles.golSep}>-</span>
                      <input
                        type="number"
                        className={prodeStyles.inputGol}
                        value={valVisita}
                        onChange={e => handleChange(p, "visita", e.target.value)}
                        placeholder="-"
                        min="0"
                        max="99"
                      />
                    </div>
                  </div>

                  {/* Equipo Visita */}
                  <div className={prodeStyles.equipo}>
                    {p.visita_escudo && <img src={p.visita_escudo} alt="" className={prodeStyles.escudo} />}
                    <span className={prodeStyles.equipoNombre}>{p.visita_nombre}</span>
                  </div>
                </div>

                {/* Extras Row */}
                <div className={prodeStyles.partidoFooter}>
                  {p.estado === 'en_curso' && <span className={fixStyles.enVivoBadge}>En vivo</span>}
                  {p.estado === 'finalizado' && (
                    <span className={prodeStyles.resultadoReal}>
                      Real: {p.goles_local} - {p.goles_visita}
                    </span>
                  )}
                  {p.estado === 'pendiente' && <span>{dia} · {hora}</span>}
                  {modificado && <span className={fixStyles.finBadge} style={{ color: '#58a6ff' }}>Simulado</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className={est.btnRow} style={{ marginTop: '16px' }}>
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
            <div className={est.secHead} style={{ marginTop: "8px" }}>
              <span className={est.secTitle}>Resultado de la Simulacion</span>
              <span className={est.secSub}>Tabla hipotetica considerando los resultados ingresados</span>
            </div>
            <div className={styles.tableOuter}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thPos}>#</th>
                    <th className={styles.thEquipo}>Equipo</th>
                    <th className={styles.thPts} title="Puntos">PTS.</th>
                    <th className={styles.thNum} title="Partidos Jugados">PJ</th>
                    <th className={styles.thNum} title="Partidos Ganados">PG</th>
                    <th className={styles.thNum} title="Partidos Empatados">PE</th>
                    <th className={styles.thNum} title="Partidos Perdidos">PP</th>
                    <th className={styles.thNum} title="Goles a Favor">GF</th>
                    <th className={styles.thNum} title="Goles en Contra">GC</th>
                    <th className={styles.thDifCol} title="Diferencia de Gol">DIF</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaSimulada.map((eq, idx) => (
                    <tr key={eq.equipo_id} className={styles.row}>
                      <td className={`${styles.tdPos} ${idx < 8 ? styles.posPlayoff : ""}`}>{eq.posicion}</td>
                      <td className={styles.tdEquipo}>
                        <div className={styles.equipoWrap}>
                          {eq.escudo_url ? <img src={eq.escudo_url} alt="" className={styles.escudo} /> : <span className={styles.escudoVacio} />}
                          <span className={styles.equipoNombre}>{eq.nombre}</span>
                        </div>
                      </td>
                      <td className={styles.tdPts}>{eq.puntos}</td>
                      <td>{eq.pj}</td>
                      <td>{eq.pg}</td>
                      <td>{eq.pe}</td>
                      <td>{eq.pp}</td>
                      <td>{eq.gf}</td>
                      <td>{eq.gc}</td>
                      <td className={`${styles.tdDif} ${eq.dg > 0 ? styles.pos : eq.dg < 0 ? styles.neg : ''}`}>
                        {eq.dg > 0 ? "+" : ""}{eq.dg}
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