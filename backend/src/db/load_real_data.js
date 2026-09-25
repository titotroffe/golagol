const db = require('./database');

// Mapping real db names
const stats = [
  { nombre: 'Belgrano', pj: 7, pg: 5, pe: 2, pp: 0, gf: 18, gc: 5 },
  { nombre: 'Paraná', pj: 7, pg: 5, pe: 2, pp: 0, gf: 14, gc: 4 },
  { nombre: 'La Emilia', pj: 7, pg: 5, pe: 1, pp: 1, gf: 17, gc: 6 },
  { nombre: 'Los Andes', pj: 7, pg: 4, pe: 1, pp: 2, gf: 20, gc: 10 },
  { nombre: 'Somisa', pj: 7, pg: 4, pe: 1, pp: 2, gf: 8, gc: 7 },
  { nombre: 'Defensores de Belgrano', pj: 7, pg: 4, pe: 0, pp: 3, gf: 21, gc: 11 },
  { nombre: 'General Rojo', pj: 7, pg: 4, pe: 0, pp: 3, gf: 14, gc: 8 },
  { nombre: 'Regatas', pj: 7, pg: 3, pe: 3, pp: 1, gf: 6, gc: 3 },
  { nombre: '12 de Octubre', pj: 7, pg: 3, pe: 3, pp: 1, gf: 11, gc: 11 },
  { nombre: 'Conesa', pj: 7, pg: 3, pe: 1, pp: 3, gf: 7, gc: 10 },
  { nombre: 'San Martín', pj: 7, pg: 2, pe: 2, pp: 3, gf: 5, gc: 9 },
  { nombre: 'Argentino Oeste', pj: 7, pg: 2, pe: 1, pp: 4, gf: 7, gc: 9 },
  { nombre: 'El Fortín', pj: 7, pg: 2, pe: 1, pp: 4, gf: 5, gc: 22 },
  { nombre: 'Social', pj: 7, pg: 1, pe: 1, pp: 5, gf: 6, gc: 13 },
  { nombre: 'Matienzo', pj: 7, pg: 0, pe: 0, pp: 7, gf: 3, gc: 15 },
  { nombre: 'Fútbol San Nicolás', pj: 7, pg: 0, pe: 0, pp: 7, gf: 2, gc: 20 }
];

try {
  // Limpiar toda la tabla base antes de re-insertar
  db.prepare("DELETE FROM estadisticas_base").run();

  const torneo = db.prepare("SELECT id FROM torneos WHERE nombre LIKE '%Clausura%' LIMIT 1").get();
  if (!torneo) throw new Error("No se encontró el torneo Clausura");
  const torneo_id = torneo.id;

  const insertStmt = db.prepare(`
    INSERT INTO estadisticas_base (torneo_id, equipo_id, pj, pg, pe, pp, gf, gc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const stat of stats) {
    const eq = db.prepare("SELECT id, nombre FROM equipos WHERE nombre = ?").get(stat.nombre);

    if (eq) {
      insertStmt.run(torneo_id, eq.id, stat.pj, stat.pg, stat.pe, stat.pp, stat.gf, stat.gc);
      console.log(`✅ Cargado: ${eq.nombre} (${stat.pg}G ${stat.pe}E ${stat.pp}P)`);
      count++;
    } else {
      console.log(`❌ No se encontró el equipo: ${stat.nombre}`);
    }
  }
  console.log(`\n¡Listo! Se actualizaron las estadísticas base de ${count} equipos.`);
} catch (error) {
  console.error("Error:", error.message);
}
