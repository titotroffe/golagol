const db = require('better-sqlite3')('prode.db');
const finalizados = db.prepare(`SELECT count(*) as c FROM partidos WHERE estado = 'finalizado'`).get();
console.log('Finalizados:', finalizados.c);