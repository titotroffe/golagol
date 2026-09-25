const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/prode/partido/:partido_id - Ver mi pronóstico para un partido
router.get('/partido/:partido_id', authMiddleware, (req, res) => {
  const pronostico = db.prepare(`
    SELECT pr.*, 
           p.goles_local AS resultado_local,
           p.goles_visita AS resultado_visita,
           p.estado AS partido_estado
    FROM pronosticos pr
    JOIN partidos p ON p.id = pr.partido_id
    WHERE pr.usuario_id = ? AND pr.partido_id = ?
  `).get(req.usuario.id, req.params.partido_id);

  res.json(pronostico || null);
});

// POST /api/prode/partido/:partido_id - Crear/actualizar pronóstico
router.post('/partido/:partido_id', authMiddleware, (req, res) => {
  const { goles_local, goles_visita } = req.body;
  const usuario_id = req.usuario.id;
  const partido_id = req.params.partido_id;

  if (goles_local == null || goles_visita == null) {
    return res.status(400).json({ error: 'Ingresá ambos resultados' });
  }
  if (goles_local < 0 || goles_visita < 0) {
    return res.status(400).json({ error: 'No se permiten goles negativos' });
  }

  // Verificar que el prode está abierto
  const partido = db.prepare(`
    SELECT p.estado, f.prode_abierto
    FROM partidos p
    JOIN fechas f ON f.id = p.fecha_id
    WHERE p.id = ?
  `).get(partido_id);

  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  if (!partido.prode_abierto) return res.status(403).json({ error: 'El prode para esta fecha está cerrado' });
  if (partido.estado !== 'pendiente') return res.status(403).json({ error: 'El partido ya comenzó o finalizó' });

  db.prepare(`
    INSERT INTO pronosticos (usuario_id, partido_id, goles_local, goles_visita)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(usuario_id, partido_id)
    DO UPDATE SET goles_local = excluded.goles_local, goles_visita = excluded.goles_visita, puntos_obtenidos = NULL
  `).run(usuario_id, partido_id, goles_local, goles_visita);

  res.json({ ok: true, mensaje: 'Pronóstico guardado' });
});

// GET /api/prode/mis-puntos/:torneo_id - Mis puntos acumulados en el torneo
router.get('/mis-puntos/:torneo_id', authMiddleware, (req, res) => {
  const result = db.prepare(`
    SELECT 
      COUNT(pr.id) AS pronosticos_totales,
      SUM(CASE WHEN pr.puntos_obtenidos = 6 THEN 1 ELSE 0 END) AS exactos,
      SUM(CASE WHEN pr.puntos_obtenidos = 3 THEN 1 ELSE 0 END) AS resultado_correcto,
      SUM(CASE WHEN pr.puntos_obtenidos = 0 THEN 1 ELSE 0 END) AS fallados,
      COALESCE(SUM(pr.puntos_obtenidos), 0) AS puntos_total
    FROM pronosticos pr
    JOIN partidos p ON p.id = pr.partido_id
    JOIN fechas f ON f.id = p.fecha_id
    WHERE pr.usuario_id = ? AND f.torneo_id = ? AND pr.puntos_obtenidos IS NOT NULL
  `).get(req.usuario.id, req.params.torneo_id);
  res.json(result);
});

// GET /api/prode/ranking/:torneo_id - Ranking global de jugadores
router.get('/ranking/:torneo_id', (req, res) => {
  const ranking = db.prepare(`
    SELECT 
      u.id, u.nombre, u.apellido, u.usuario,
      e.nombre AS equipo_favorito,
      COALESCE(SUM(pr.puntos_obtenidos), 0) AS puntos,
      COUNT(CASE WHEN pr.puntos_obtenidos IS NOT NULL THEN 1 END) AS pronosticos_jugados,
      COUNT(CASE WHEN pr.puntos_obtenidos = 6 THEN 1 END) AS exactos
    FROM usuarios u
    LEFT JOIN equipos e ON e.id = u.equipo_id
    LEFT JOIN pronosticos pr ON pr.usuario_id = u.id
    LEFT JOIN partidos p ON p.id = pr.partido_id
    LEFT JOIN fechas f ON f.id = p.fecha_id AND f.torneo_id = ?
    WHERE u.activo = 1
    GROUP BY u.id
    ORDER BY puntos DESC, exactos DESC, u.apellido ASC
  `).all(req.params.torneo_id);

  ranking.forEach((u, idx) => u.posicion = idx + 1);
  res.json(ranking);
});

// ─────────────────────────────────────────
// TORNEOS PRIVADOS (Grupos entre amigos)
// ─────────────────────────────────────────

// POST /api/prode/grupos - Crear grupo
router.post('/grupos', authMiddleware, (req, res) => {
  const { nombre, torneo_id } = req.body;
  if (!nombre || !torneo_id) return res.status(400).json({ error: 'Nombre y torneo_id son requeridos' });

  // Generar código único de 6 caracteres
  const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

  const result = db.prepare(`
    INSERT INTO prode_grupos (nombre, codigo, torneo_id, creador_id) VALUES (?, ?, ?, ?)
  `).run(nombre, codigo, torneo_id, req.usuario.id);

  // El creador se une automáticamente
  db.prepare(
    'INSERT OR IGNORE INTO prode_grupos_miembros (grupo_id, usuario_id) VALUES (?, ?)'
  ).run(result.lastInsertRowid, req.usuario.id);

  res.status(201).json({ id: result.lastInsertRowid, nombre, codigo });
});

// POST /api/prode/grupos/unirse - Unirse con código
router.post('/grupos/unirse', authMiddleware, (req, res) => {
  const { codigo } = req.body;
  const grupo = db.prepare('SELECT * FROM prode_grupos WHERE codigo = ?').get(codigo?.toUpperCase());

  if (!grupo) return res.status(404).json({ error: 'Código de grupo inválido' });

  db.prepare(
    'INSERT OR IGNORE INTO prode_grupos_miembros (grupo_id, usuario_id) VALUES (?, ?)'
  ).run(grupo.id, req.usuario.id);

  res.json({ ok: true, grupo: { id: grupo.id, nombre: grupo.nombre } });
});

// GET /api/prode/grupos/mis-grupos - Mis grupos
router.get('/grupos/mis-grupos', authMiddleware, (req, res) => {
  const grupos = db.prepare(`
    SELECT g.*, t.nombre AS torneo_nombre,
           COUNT(gm2.usuario_id) AS miembros
    FROM prode_grupos g
    JOIN prode_grupos_miembros gm ON gm.grupo_id = g.id AND gm.usuario_id = ?
    JOIN torneos t ON t.id = g.torneo_id
    LEFT JOIN prode_grupos_miembros gm2 ON gm2.grupo_id = g.id
    GROUP BY g.id
    ORDER BY g.creado_en DESC
  `).all(req.usuario.id);
  res.json(grupos);
});

// GET /api/prode/grupos/:id/ranking - Ranking dentro del grupo
router.get('/grupos/:id/ranking', authMiddleware, (req, res) => {
  const grupo = db.prepare('SELECT * FROM prode_grupos WHERE id = ?').get(req.params.id);
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

  const ranking = db.prepare(`
    SELECT 
      u.id, u.nombre, u.apellido, u.usuario,
      COALESCE(SUM(pr.puntos_obtenidos), 0) AS puntos,
      COUNT(CASE WHEN pr.puntos_obtenidos = 6 THEN 1 END) AS exactos
    FROM prode_grupos_miembros gm
    JOIN usuarios u ON u.id = gm.usuario_id
    LEFT JOIN pronosticos pr ON pr.usuario_id = u.id
    LEFT JOIN partidos p ON p.id = pr.partido_id
    LEFT JOIN fechas f ON f.id = p.fecha_id AND f.torneo_id = ?
    WHERE gm.grupo_id = ?
    GROUP BY u.id
    ORDER BY puntos DESC, exactos DESC
  `).all(grupo.torneo_id, req.params.id);

  ranking.forEach((u, idx) => u.posicion = idx + 1);
  res.json(ranking);
});

module.exports = router;
