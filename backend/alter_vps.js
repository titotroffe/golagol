const db = require('better-sqlite3')('prode.db');
try { db.exec('ALTER TABLE jugadores ADD COLUMN fecha_nacimiento TEXT;'); console.log('fecha_nacimiento added'); } catch(e) { console.log(e.message); }
try { db.exec('ALTER TABLE jugadores ADD COLUMN dni TEXT;'); console.log('dni added'); } catch(e) { console.log(e.message); }
