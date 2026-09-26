const db = require('better-sqlite3')('prode.db');
const bases = db.prepare(`SELECT * FROM estadisticas_base`).all();
console.table(bases);