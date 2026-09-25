const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'prode.db');

const db = new Database(DB_PATH);

// Habilitar WAL mode para mejor performance concurrente
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// ESQUEMA COMPLETO DE LA BASE DE DATOS
// ============================================================
db.exec(`

  -- ─────────────────────────────────────────────────────────
  -- EQUIPOS
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS equipos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL UNIQUE,
    escudo_url  TEXT,
    color_local TEXT DEFAULT '#cccccc',
    color_visita TEXT DEFAULT '#ffffff',
    estadio     TEXT,
    creado_en   TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- USUARIOS
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS usuarios (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre           TEXT NOT NULL,
    apellido         TEXT NOT NULL,
    email            TEXT NOT NULL UNIQUE,
    usuario          TEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,
    fecha_nacimiento TEXT NOT NULL,
    equipo_id        INTEGER REFERENCES equipos(id),
    rol              TEXT NOT NULL DEFAULT 'usuario', -- 'usuario' | 'admin' | 'reportero'
    activo           INTEGER NOT NULL DEFAULT 1,
    creado_en        TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- TORNEOS (Apertura / Clausura / Copa Nicoleña)
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS torneos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,           -- 'Apertura 2025', 'Copa Nicoleña 2025'
    tipo        TEXT NOT NULL,           -- 'todos_contra_todos' | 'grupos_eliminacion'
    temporada   TEXT NOT NULL,           -- '2025'
    estado      TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'en_curso' | 'finalizado'
    creado_en   TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- INSCRIPCIONES Y ESTADÍSTICAS BASE
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS torneo_equipos (
    torneo_id   INTEGER NOT NULL REFERENCES torneos(id),
    equipo_id   INTEGER NOT NULL REFERENCES equipos(id),
    grupo       TEXT,   -- Para torneos con grupos (A, B, etc.)
    PRIMARY KEY (torneo_id, equipo_id)
  );

  CREATE TABLE IF NOT EXISTS estadisticas_base (
    torneo_id INTEGER NOT NULL REFERENCES torneos(id),
    equipo_id INTEGER NOT NULL REFERENCES equipos(id),
    pj INTEGER DEFAULT 0,
    pg INTEGER DEFAULT 0,
    pe INTEGER DEFAULT 0,
    pp INTEGER DEFAULT 0,
    gf INTEGER DEFAULT 0,
    gc INTEGER DEFAULT 0,
    PRIMARY KEY (torneo_id, equipo_id)
  );

  -- ─────────────────────────────────────────────────────────
  -- FECHAS del torneo
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS fechas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    torneo_id   INTEGER NOT NULL REFERENCES torneos(id),
    numero      INTEGER NOT NULL,           -- Fecha 1, Fecha 2...
    nombre      TEXT,                       -- Ej: 'Fecha 1 - Apertura'
    estado      TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'en_curso' | 'cerrada'
    prode_abierto INTEGER NOT NULL DEFAULT 1, -- 1: se puede pronosticar, 0: cerrado
    creado_en   TEXT DEFAULT (datetime('now')),
    UNIQUE(torneo_id, numero)
  );

  -- ─────────────────────────────────────────────────────────
  -- PARTIDOS
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS partidos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_id        INTEGER NOT NULL REFERENCES fechas(id),
    equipo_local_id INTEGER NOT NULL REFERENCES equipos(id),
    equipo_visita_id INTEGER NOT NULL REFERENCES equipos(id),
    fecha_hora      TEXT,                  -- '2025-09-28 15:30'
    cancha          TEXT,
    estado          TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'en_curso' | 'finalizado' | 'suspendido'
    goles_local     INTEGER,               -- NULL hasta que termine
    goles_visita    INTEGER,               -- NULL hasta que termine
    creado_en       TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- EVENTOS DEL PARTIDO (Goles, Tarjetas, Cambios)
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS eventos_partido (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    partido_id  INTEGER NOT NULL REFERENCES partidos(id),
    minuto      INTEGER,
    tipo        TEXT NOT NULL, -- 'GOL' | 'AMARILLA' | 'ROJA' | 'CAMBIO' | 'PENAL' | 'AUTOGOL'
    equipo_id   INTEGER REFERENCES equipos(id),
    jugador_id  INTEGER REFERENCES jugadores(id),
    detalle     TEXT,
    registrado_en TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- ALINEACIONES (Titulares y Suplentes)
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS alineaciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    partido_id  INTEGER NOT NULL REFERENCES partidos(id),
    equipo_id   INTEGER NOT NULL REFERENCES equipos(id),
    jugador_id  INTEGER NOT NULL REFERENCES jugadores(id),
    tipo        TEXT NOT NULL CHECK(tipo IN ('titular', 'suplente')),
    dorsal      INTEGER,
    creado_en   TEXT DEFAULT (datetime('now')),
    UNIQUE(partido_id, jugador_id)
  );

  -- ─────────────────────────────────────────────────────────
  -- JUGADORES
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS jugadores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id   INTEGER NOT NULL REFERENCES equipos(id),
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    numero_camiseta INTEGER,
    posicion    TEXT,  -- 'Arquero' | 'Defensor' | 'Mediocampista' | 'Delantero'
    activo      INTEGER NOT NULL DEFAULT 1,
    creado_en   TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- ESTADÍSTICAS DE JUGADORES POR TORNEO
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS estadisticas_jugador (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    jugador_id      INTEGER NOT NULL REFERENCES jugadores(id),
    torneo_id       INTEGER NOT NULL REFERENCES torneos(id),
    partidos_jugados INTEGER DEFAULT 0,
    goles           INTEGER DEFAULT 0,
    amarillas       INTEGER DEFAULT 0,
    rojas           INTEGER DEFAULT 0,
    UNIQUE(jugador_id, torneo_id)
  );

  -- ─────────────────────────────────────────────────────────
  -- SANCIONES (Fechas suspendido)
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS sanciones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    jugador_id      INTEGER NOT NULL REFERENCES jugadores(id),
    torneo_id       INTEGER NOT NULL REFERENCES torneos(id),
    fechas_a_cumplir INTEGER NOT NULL DEFAULT 1,
    fechas_cumplidas INTEGER NOT NULL DEFAULT 0,
    motivo          TEXT,
    activa          INTEGER NOT NULL DEFAULT 1,
    creado_en       TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- PRONÓSTICOS del Prode
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS pronosticos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id),
    partido_id       INTEGER NOT NULL REFERENCES partidos(id),
    goles_local      INTEGER NOT NULL,
    goles_visita     INTEGER NOT NULL,
    puntos_obtenidos INTEGER,              -- NULL hasta que cierre el partido
    calculado_en     TEXT,
    UNIQUE(usuario_id, partido_id)
  );

  -- ─────────────────────────────────────────────────────────
  -- TORNEOS PRIVADOS (Prode entre amigos)
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS prode_grupos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    codigo      TEXT NOT NULL UNIQUE,      -- Código de 6 chars para invitar
    torneo_id   INTEGER NOT NULL REFERENCES torneos(id),
    creador_id  INTEGER NOT NULL REFERENCES usuarios(id),
    creado_en   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prode_grupos_miembros (
    grupo_id    INTEGER NOT NULL REFERENCES prode_grupos(id),
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
    unido_en    TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (grupo_id, usuario_id)
  );

`);

console.log('✅ Base de datos inicializada correctamente en:', DB_PATH);

module.exports = db;
