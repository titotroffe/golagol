const db = require('./database');

const map = {
  '12 de Octubre': '/escudos/12deoct.png',
  'Argentino Oeste': '/escudos/ArgOeste.png',
  'Belgrano': '/escudos/Belgrano.png',
  'Conesa': '/escudos/Conesa.png',
  'Defensores de Belgrano': '/escudos/Defe.png',
  'El Fortín': '/escudos/elfortin.png',
  'Fútbol San Nicolás': '/escudos/FSN.png',
  'General Rojo': '/escudos/generalrojo.png',
  'La Emilia': '/escudos/LaEmilia.png',
  'Los Andes': '/escudos/losandes.png',
  'Matienzo': '/escudos/Matienzo.png',
  'Paraná': '/escudos/parana.png',
  'Regatas': '/escudos/regatas.png',
  'San Martín': '/escudos/sanmartin.png',
  'Social': '/escudos/SOCIAL.png',
  'SOMISA': '/escudos/Somisa.png',
};

const updateStmt = db.prepare('UPDATE equipos SET escudo_url = ? WHERE nombre = ?');

let updated = 0;
for (const [nombre, url] of Object.entries(map)) {
  const result = updateStmt.run(url, nombre);
  if (result.changes > 0) updated++;
}

console.log(`Se actualizaron ${updated} escudos.`);
