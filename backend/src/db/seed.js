const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('🌱 Iniciando seed de datos base...');

// ─────────────────────────────────────────
// 1. EQUIPOS (los 16 de la Liga Nicoleña)
// ─────────────────────────────────────────
const equipos = [
  { nombre: '12 de Octubre',         estadio: 'Estadio 12 de Octubre' },
  { nombre: 'Argentino Oeste',       estadio: 'Estadio Argentino Oeste' },
  { nombre: 'Belgrano',              estadio: 'Estadio Belgrano' },
  { nombre: 'Los Andes',             estadio: 'Estadio Los Andes' },
  { nombre: 'Regatas',               estadio: 'Estadio Regatas' },
  { nombre: 'San Martín',            estadio: 'Estadio San Martín' },
  { nombre: 'SOMISA',                estadio: 'Estadio SOMISA' },
  { nombre: 'General Rojo',          estadio: 'Estadio General Rojo' },
  { nombre: 'Fútbol San Nicolás',    estadio: 'Estadio FSN' },
  { nombre: 'La Emilia',             estadio: 'Estadio La Emilia' },
  { nombre: 'Social',                estadio: 'Estadio Social' },
  { nombre: 'Defensores de Belgrano',estadio: 'Estadio Defensores' },
  { nombre: 'El Fortín',             estadio: 'Estadio El Fortín' },
  { nombre: 'Conesa',                estadio: 'Estadio Conesa' },
  { nombre: 'Matienzo',              estadio: 'Estadio Matienzo' },
  { nombre: 'Paraná',                estadio: 'Estadio Paraná' },
];

const insertEquipo = db.prepare(`
  INSERT OR IGNORE INTO equipos (nombre, estadio) VALUES (@nombre, @estadio)
`);

const insertarEquipos = db.transaction(() => {
  equipos.forEach(e => insertEquipo.run(e));
});
insertarEquipos();
console.log(`✅ ${equipos.length} equipos insertados`);

// ─────────────────────────────────────────
// 2. TORNEOS base de la temporada 2025
// ─────────────────────────────────────────
const torneos = [
  { nombre: 'Apertura 2025',       tipo: 'todos_contra_todos', temporada: '2025' },
  { nombre: 'Clausura 2025',       tipo: 'todos_contra_todos', temporada: '2025' },
  { nombre: 'Copa Nicoleña 2025',  tipo: 'grupos_eliminacion', temporada: '2025' },
];

const insertTorneo = db.prepare(`
  INSERT OR IGNORE INTO torneos (nombre, tipo, temporada) VALUES (@nombre, @tipo, @temporada)
`);

const insertarTorneos = db.transaction(() => {
  torneos.forEach(t => insertTorneo.run(t));
});
insertarTorneos();
console.log('✅ 3 torneos creados: Apertura, Clausura y Copa Nicoleña 2025');

// ─────────────────────────────────────────
// 3. USUARIO ADMINISTRADOR por defecto
// ─────────────────────────────────────────
const adminExiste = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('admin');

if (!adminExiste) {
  const hash = bcrypt.hashSync('admin1234', 10);
  db.prepare(`
    INSERT INTO usuarios (nombre, apellido, email, usuario, password_hash, fecha_nacimiento, rol)
    VALUES ('Admin', 'Sistema', 'admin@prode.local', 'admin', ?, '1990-01-01', 'admin')
  `).run(hash);
  console.log('✅ Usuario admin creado → usuario: admin | contraseña: admin1234');
}

console.log('');
console.log('🎉 Seed completado. La base de datos está lista.');
console.log('   Podés iniciar el servidor con: npm run dev');
