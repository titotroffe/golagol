const db = require('better-sqlite3')('backend/prode.db');
const torneo = db.prepare('SELECT id FROM torneos WHERE estado = "en_curso"').get();
if (!torneo) { console.log('No activo'); process.exit(0); }
console.log('Torneo Activo:', torneo.id);
const fecha4 = db.prepare('SELECT id FROM fechas WHERE torneo_id = ? AND numero = 4').get(torneo.id);
if (!fecha4) { console.log('No fecha 4'); process.exit(0); }
console.log('Fecha 4 ID:', fecha4.id);
const partidos = db.prepare(`
  SELECT p.id, e1.nombre as local, e2.nombre as visita 
  FROM partidos p 
  JOIN equipos e1 ON e1.id = p.equipo_local_id 
  JOIN equipos e2 ON e2.id = p.equipo_visita_id 
  WHERE p.fecha_id = ?`).all(fecha4.id);
console.table(partidos);

const equiposTorneo = db.prepare(`
  SELECT e.id, e.nombre 
  FROM equipos e 
  JOIN torneo_equipos te ON te.equipo_id = e.id 
  WHERE te.torneo_id = ?`).all(torneo.id);

const equiposEnPartidos = new Set();
partidos.forEach(p => { equiposEnPartidos.add(p.local); equiposEnPartidos.add(p.visita); });

console.log('\nEquipos sin partido en fecha 4:');
equiposTorneo.forEach(e => {
  if (!equiposEnPartidos.has(e.nombre)) {
    console.log('-', e.id, e.nombre);
  }
});