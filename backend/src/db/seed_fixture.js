const db = require('./database');

const rawFixture = `
Fecha 1
Somisa – Regatas.
12 de Octubre – San Martín
Defensores – Matienzo
Fútbol SN – Gral. Rojo
Conesa – Belgrano
Social – Los Andes
La Emilia – Argentino Oeste
Paraná – El Fortín.

Fecha 2
Paraná – Somisa
El Fortín – La Emilia
Argentino Oeste – Social
Los Andes – Conesa
Belgrano – Fútbol SN
Gral. Rojo – Defensores
Matienzo – 12 de Octubre
San Martín – Regatas

Fecha 3
Somisa – San Martín
Regatas – Matienzo
12 de Octubre – Gral. Rojo
Defensores – Belgrano
Fútbol SN – Los Andes
Conesa – Argentino Oeste
Social – El Fortín
La Emilia – Paraná

Fecha 4
La Emilia – Somisa
Paraná – Social
El Fortín – Conesa
Argentino Oeste – Fútbol SN
Los Andes – Defensores
Belgrano – 12 de Octubre
Gral. Rojo – Regatas
Matienzo –San Martín

Fecha 5
Somisa – Matienzo
San Martín – Gral. Rojo
Regatas – Belgrano
12 de Octubre – Los Andes
Defensores – Argentino Oeste
Fútbol SN – El Fortín
Conesa – Paraná
Social – La Emilia

Fecha 6
Social – Somisa
La Emilia – Conesa
Paraná – Fútbol SN
El Fortín – Defensores
Argentino Oeste – 12 de Octubre
Los Andes – Regatas
Belgrano – San Martín
Gral. Rojo – Matienzo

Fecha 7
Somisa – Gral. Rojo
Matienzo – Belgrano
San Martín – Los Andes
Regatas – Argentino Oeste
12 de Octubre – El Fortín
Defensores – Paraná
Fútbol SN – La Emilia
Conesa – Social

Fecha 8
Conesa – Somisa
Social – Fútbol SN
La Emilia – Defensores
Paraná – 12 de Octubre
El Fortín – Regatas
Argentino Oeste – San Martín
Los Andes – Matienzo
Belgrano – Gral. Rojo

Fecha 9
Somisa – Belgrano
Gral. Rojo – Los Andes
Matienzo – Argentino Oeste
San Martín – El Fortín
Regatas – Paraná
12 de Octubre – La Emilia
Defensores – Social
Fútbol SN – Conesa

Fecha 10
Fútbol SN – Somisa
Conesa – Defensores
Social – 12 de Octubre
La Emilia – Regatas
Paraná – San Martín
El Fortín – Matienzo
Argentino Oeste – Gral. Rojo
Los Andes – Belgrano

Fecha 11
Somisa – Los Andes
Belgrano – Argentino Oeste
Gral. Rojo – El Fortín
Matienzo – Paraná
San Martín – La Emilia
Regatas – Social
12 de Octubre – Conesa
Defensores – Fútbol SN

Fecha 12
Defensores – Somisa
Fútbol SN – 12 de Octubre
Conesa – Regatas
Social – San Martín
La Emilia – Matienzo
Paraná – Gral. Rojo
El Fortín – Belgrano
Argentino Oeste – Los Andes

Fecha 13
Somisa – Argentino Oeste
Los Andes – El Fortín
Belgrano – Paraná
Gral. Rojo – La Emilia
Matienzo – Social
San Martín – Conesa
Regatas – Fútbol SN
12 de Octubre – Defensores

Fecha 14
12 de Octubre – Somisa
Defensores – Regatas
Fútbol SN – San Martín
Conesa – Matienzo
Social – Gral. Rojo
La Emilia – Belgrano
Paraná – Los Andes
El Fortín – Argentino Oeste

Fecha 15
Somisa – El Fortín
Argentino Oeste – Paraná
Los Andes – La Emilia
Belgrano – Social
Gral. Rojo – Conesa
Matienzo vs. Fútbol SN
San Martín – Defensores
Regatas – 12 de Octubre
`;

// Helper to map names from text to DB exact names
const alias = {
  'somisa': 'Somisa',
  'regatas': 'Regatas',
  '12 de octubre': '12 de Octubre',
  'san martín': 'San Martín',
  'san martin': 'San Martín',
  'defensores': 'Defensores de Belgrano',
  'matienzo': 'Matienzo',
  'fútbol sn': 'Fútbol San Nicolás',
  'futbol sn': 'Fútbol San Nicolás',
  'gral. rojo': 'General Rojo',
  'gral rojo': 'General Rojo',
  'conesa': 'Conesa',
  'belgrano': 'Belgrano',
  'social': 'Social',
  'los andes': 'Los Andes',
  'la emilia': 'La Emilia',
  'argentino oeste': 'Argentino Oeste',
  'paraná': 'Paraná',
  'parana': 'Paraná',
  'el fortín': 'El Fortín',
  'el fortin': 'El Fortín',
};

function getTeamId(name) {
  const cleanName = name.trim().toLowerCase().replace(/\.$/, '');
  const dbName = alias[cleanName];
  if (!dbName) {
    throw new Error('No alias found for: ' + cleanName);
  }
  const eq = db.prepare("SELECT id FROM equipos WHERE nombre = ?").get(dbName);
  if (!eq) throw new Error('No team in DB found for: ' + dbName);
  return eq.id;
}

try {
  const torneo_id = 2; // Clausura

  // Parse lines
  const lines = rawFixture.split('\n').map(l => l.trim()).filter(l => l);
  let currentFechaId = null;

  for (const line of lines) {
    if (line.toLowerCase().startsWith('fecha ')) {
      const num = parseInt(line.split(' ')[1], 10);
      
      // Insert fecha
      const info = db.prepare(`
        INSERT OR IGNORE INTO fechas (torneo_id, numero, nombre, estado, prode_abierto)
        VALUES (?, ?, ?, ?, ?)
      `).run(torneo_id, num, `Fecha ${num}`, 'pendiente', 1);

      if (info.changes > 0) {
        currentFechaId = info.lastInsertRowid;
      } else {
        const row = db.prepare("SELECT id FROM fechas WHERE torneo_id = ? AND numero = ?").get(torneo_id, num);
        currentFechaId = row.id;
      }
      console.log('--- Generando Fecha', num, '---');
    } else {
      // It's a match
      // format: Team A - Team B or Team A vs. Team B
      let parts = line.split(' – ');
      if (parts.length < 2) parts = line.split(' - ');
      if (parts.length < 2) parts = line.split(' vs. ');
      
      if (parts.length === 2) {
        const t1 = parts[0];
        const t2 = parts[1];
        
        // INVERTIR LOCALÍAS COMO PIDIÓ EL USUARIO
        const local_id = getTeamId(t2);
        const visita_id = getTeamId(t1);

        db.prepare(`
          INSERT INTO partidos (fecha_id, equipo_local_id, equipo_visita_id, estado)
          VALUES (?, ?, ?, 'pendiente')
        `).run(currentFechaId, local_id, visita_id);

        console.log(`✅ Partido: ${t2} (Local) vs ${t1} (Visita)`);
      }
    }
  }
  console.log("¡Fixture generado con éxito e invertido!");
} catch (e) {
  console.error("Error:", e);
}
