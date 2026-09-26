const db = require('better-sqlite3')('prode.db');
try {
  db.prepare("ALTER TABLE partidos ADD COLUMN ganador_escritorio TEXT DEFAULT NULL").run();
  console.log("Columna ganador_escritorio agregada");
} catch (e) {
  console.log(e.message);
}