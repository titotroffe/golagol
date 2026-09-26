const db = require('better-sqlite3')('prode.db');

const torneo = db.prepare("SELECT id FROM torneos WHERE estado = 'en_curso'").get();
if (!torneo) { console.log("No hay torneo activo"); process.exit(0); }

const fecha1 = db.prepare("SELECT id FROM fechas WHERE torneo_id = ? AND numero = 1").get(torneo.id);
if (!fecha1) { console.log("No hay fecha 1"); process.exit(0); }

const partidos = db.prepare(`
  SELECT p.id, e1.nombre as local_nombre, e2.nombre as visita_nombre, 
         p.goles_local, p.goles_visita
  FROM partidos p
  JOIN equipos e1 ON p.equipo_local_id = e1.id
  JOIN equipos e2 ON p.equipo_visita_id = e2.id
  WHERE p.fecha_id = ?
`).all(fecha1.id);

console.log("Partidos actuales Fecha 1 (Buscando para invertir goles):");
console.table(partidos);

let updated = 0;

for (const p of partidos) {
  // Check for Defensores (local) vs Matienzo (visita)
  if (p.local_nombre.includes("Defensores") && p.visita_nombre.includes("Matienzo")) {
    console.log(`Invertiendo goles: ${p.local_nombre} (${p.goles_local}) vs ${p.visita_nombre} (${p.goles_visita})`);
    db.prepare(`UPDATE partidos SET goles_local = ?, goles_visita = ? WHERE id = ?`)
      .run(p.goles_visita, p.goles_local, p.id);
    updated++;
  }
  // Check for Futbol San Nicolas (local) vs General Rojo (visita)
  if (p.local_nombre.includes("San Nicol") && p.visita_nombre.includes("General Rojo")) {
    console.log(`Invertiendo goles: ${p.local_nombre} (${p.goles_local}) vs ${p.visita_nombre} (${p.goles_visita})`);
    db.prepare(`UPDATE partidos SET goles_local = ?, goles_visita = ? WHERE id = ?`)
      .run(p.goles_visita, p.goles_local, p.id);
    updated++;
  }
}

console.log(`Se actualizaron ${updated} partidos.`);