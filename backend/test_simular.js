const db = require('better-sqlite3')('prode.db');
const torneo_id = 2; // Asumiendo ID 2 para pruebas

const equipos = db.prepare(`
    SELECT e.id, e.nombre,
           COALESCE(eb.pj, 0) AS base_pj, COALESCE(eb.pg, 0) AS base_pg, 
           COALESCE(eb.pe, 0) AS base_pe, COALESCE(eb.pp, 0) AS base_pp
    FROM equipos e
    JOIN torneo_equipos te ON te.equipo_id = e.id
    LEFT JOIN estadisticas_base eb ON eb.equipo_id = e.id AND eb.torneo_id = te.torneo_id
    WHERE te.torneo_id = ?
`).all(torneo_id);

console.log(equipos);
