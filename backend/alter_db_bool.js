const db = require('better-sqlite3')('prode.db');
try {
  db.prepare("ALTER TABLE partidos ADD COLUMN por_escritorio BOOLEAN DEFAULT 0").run();
  console.log("Columna por_escritorio agregada");
} catch (e) {
  console.log(e.message);
}