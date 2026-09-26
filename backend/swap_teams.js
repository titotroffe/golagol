const db = require('better-sqlite3')('prode.db');

const torneo = db.prepare("SELECT id FROM torneos WHERE estado = 'en_curso'").get();
if (!torneo) { console.log("No hay torneo activo"); process.exit(0); }

const fecha1 = db.prepare("SELECT id FROM fechas WHERE torneo_id = ? AND numero = 1").get(torneo.id);
if (!fecha1) { console.log("No hay fecha 1"); process.exit(0); }

const partidos = db.prepare(`
  SELECT p.id, e1.nombre as local_nombre, e2.nombre as visita_nombre, 
         p.equipo_local_id, p.equipo_visita_id
  FROM partidos p
  JOIN equipos e1 ON p.equipo_local_id = e1.id
  JOIN equipos e2 ON p.equipo_visita_id = e2.id
  WHERE p.fecha_id = ?
`).all(fecha1.id);

console.log("Partidos actuales Fecha 1:");
console.table(partidos);

let updated = 0;

for (const p of partidos) {
  // Check for Matienzo (local) vs Defensores (visita)
  if (p.local_nombre.includes("Matienzo") && p.visita_nombre.includes("Defensores")) {
    console.log(`Cambiando: ${p.local_nombre} vs ${p.visita_nombre}`);
    db.prepare(`UPDATE partidos SET equipo_local_id = ?, equipo_visita_id = ? WHERE id = ?`)
      .run(p.equipo_visita_id, p.equipo_local_id, p.id);
    updated++;
  }
  // Check for General Rojo (local) vs Futbol San Nicolas (visita)
  if (p.local_nombre.includes("General Rojo") && p.visita_nombre.includes("San Nicol")) {
    console.log(`Cambiando: ${p.local_nombre} vs ${p.visita_nombre}`);
    db.prepare(`UPDATE partidos SET equipo_local_id = ?, equipo_visita_id = ? WHERE id = ?`)
      .run(p.equipo_visita_id, p.equipo_local_id, p.id);
    updated++;
  }
}

console.log(`Se actualizaron ${updated} partidos.`);