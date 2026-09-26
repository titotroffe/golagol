import { useQuery } from "@tanstack/react-query";
import { torneosApi } from "../api";
import { useTorneoStore } from "../store";
import styles from "./Tabla.module.css";
import est from "./Estadisticas.module.css";

export default function Sancionados() {
  const torneoActivo = useTorneoStore((s) => s.torneoActivo);

  const { data: sancionados, isLoading } = useQuery({
    queryKey: ["sancionados", torneoActivo?.id],
    queryFn: () => torneosApi.sancionados(torneoActivo.id),
    enabled: !!torneoActivo,
  });

  if (!torneoActivo) return <p className={styles.msg}>Selecciona un torneo</p>;

  return (
    <div className={est.wrap}>
      <section className={est.section}>
        <div className={est.secHead}>
          <span className={est.secTitle}>Jugadores Sancionados</span>
          <span className={est.secSub}>Jugadores con fechas pendientes de cumplir</span>
        </div>

        {isLoading && <p className={styles.msg}>Cargando...</p>}

        {!isLoading && (!sancionados || sancionados.length === 0) && (
          <p className={styles.msg}>No hay jugadores sancionados actualmente.</p>
        )}

        {!isLoading && sancionados && sancionados.length > 0 && (
          <div className={est.tableOuter}>
            <table className={est.table}>
              <thead>
                <tr>
                  <th className={est.thJugador}>Jugador</th>
                  <th className={est.thEquipo}>Equipo</th>
                  <th className={est.thNum} title="Fechas a cumplir">Total</th>
                  <th className={est.thNum} title="Fechas cumplidas">Cumplidas</th>
                  <th className={est.thNum} title="Fechas restantes">Restan</th>
                  <th className={est.thMotivo}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {sancionados.map((s) => (
                  <tr key={`${s.id}-${s.motivo}`} className={est.row}>
                    <td className={est.tdJugador}>
                      <span className={est.nombreJugador}>{s.nombre} {s.apellido}</span>
                    </td>
                    <td className={est.tdEquipo}>
                      {s.escudo_url && <img src={s.escudo_url} alt="" className={est.escudo} />}
                      <span>{s.equipo_nombre}</span>
                    </td>
                    <td className="text-center">{s.fechas_a_cumplir}</td>
                    <td className="text-center">{s.fechas_cumplidas}</td>
                    <td>
                      <span className={est.rojasBadge}>{s.fechas_restantes}</span>
                    </td>
                    <td className={est.tdMotivo}>{s.motivo || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}