const db = require('better-sqlite3')('prode.db');
const fecha4_id = 5; // From previous script
const local_id = 6;  // San Martín
const visita_id = 15; // Matienzo

const exists = db.prepare('SELECT id FROM partidos WHERE fecha_id = ? AND ((equipo_local_id = ? AND equipo_visita_id = ?) OR (equipo_local_id = ? AND equipo_visita_id = ?))').get(fecha4_id, local_id, visita_id, visita_id, local_id);

if (!exists) {
  db.prepare(`
    INSERT INTO partidos (fecha_id, equipo_local_id, equipo_visita_id, estado)
    VALUES (?, ?, ?, 'pendiente')
  `).run(fecha4_id, local_id, visita_id);
  console.log('Partido agregado correctamente');
} else {
  console.log('El partido ya existia');
}