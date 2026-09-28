const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/prode/faltantes/:fecha_id - Cuántos partidos faltan pronosticar
router.get('/faltantes/:fecha_id', authMiddleware, (req, res) => {
  const result = db.prepare(`
    SELECT COUNT(*) AS faltantes
    FROM partidos p
    LEFT JOIN pronosticos pr ON pr.partido_id = p.id AND pr.usuario_id = ?
    WHERE p.fecha_id = ? AND p.estado = 'pendiente' AND pr.id IS NULL
  `).get(req.usuario.id, req.params.fecha_id);
  res.json({ faltantes: result.faltantes });
});

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
    SELECT p.estado, p.fecha_hora, f.prode_abierto
    FROM partidos p
    JOIN fechas f ON f.id = p.fecha_id
    WHERE p.id = ?
  `).get(partido_id);

  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  if (!partido.prode_abierto) return res.status(403).json({ error: 'El prode para esta fecha está cerrado' });
  if (partido.estado !== 'pendiente') return res.status(403).json({ error: 'El partido ya comenzó o finalizó' });

  if (partido.fecha_hora) {
    const matchTime = new Date(partido.fecha_hora);
    const now = new Date();
    const diffMs = matchTime - now;
    if (diffMs <= 10 * 60000) {
      return res.status(403).json({ error: 'No se puede cargar el pronóstico a menos de 10 minutos del inicio del partido' });
    }
  }

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
  const torneo_id = req.params.torneo_id;
  const ranking = db.prepare(`
    SELECT 
      u.id, u.nombre, u.apellido, u.usuario,
      e.nombre AS equipo_favorito,
      COALESCE(SUM(pr.puntos_obtenidos), 0) AS puntos,
      COUNT(CASE WHEN pr.puntos_obtenidos IS NOT NULL THEN 1 END) AS pronosticos_jugados,
      COUNT(CASE WHEN pr.puntos_obtenidos = 6 THEN 1 END) AS exactos
    FROM usuarios u
    LEFT JOIN equipos e ON e.id = u.equipo_id
    LEFT JOIN (
      SELECT pr2.*
      FROM pronosticos pr2
      JOIN partidos p2 ON p2.id = pr2.partido_id
      JOIN fechas f2 ON f2.id = p2.fecha_id
      WHERE f2.torneo_id = ?
    ) pr ON pr.usuario_id = u.id
    WHERE u.activo = 1
    GROUP BY u.id
    HAVING pronosticos_jugados > 0
    ORDER BY puntos DESC, exactos DESC, u.apellido ASC
  `).all(torneo_id);

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

  // Generar código único complejo de 12 caracteres
  const codigo = crypto.randomBytes(6).toString('hex').toUpperCase();

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

// GET /api/prode/partido/:partido_id/predicciones-grupos - Predicciones de mis grupos
router.get('/partido/:partido_id/predicciones-grupos', authMiddleware, (req, res) => {
  const partido_id = req.params.partido_id;
  const usuario_id = req.usuario.id;

  const partido = db.prepare('SELECT estado, fecha_hora FROM partidos WHERE id = ?').get(partido_id);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
  
  const matchTime = partido.fecha_hora ? new Date(partido.fecha_hora) : null;
  const isTooLate = matchTime ? (matchTime - new Date()) <= 10 * 60000 : false;
  const isClosed = partido.estado !== 'pendiente';
  const isLocked = isClosed || isTooLate;

  if (!isLocked) {
    return res.status(403).json({ error: 'El partido aún no comenzó. No se pueden ver las predicciones.' });
  }

  const predicciones = db.prepare(`
    SELECT DISTINCT
      u.id, u.nombre, u.apellido,
      pr.goles_local, pr.goles_visita, pr.puntos_obtenidos,
      g.nombre AS grupo_nombre
    FROM prode_grupos_miembros gm_yo
    JOIN prode_grupos g ON g.id = gm_yo.grupo_id
    JOIN prode_grupos_miembros gm_otros ON gm_otros.grupo_id = g.id
    JOIN usuarios u ON u.id = gm_otros.usuario_id
    LEFT JOIN pronosticos pr ON pr.usuario_id = u.id AND pr.partido_id = ?
    WHERE gm_yo.usuario_id = ?
    ORDER BY g.nombre, pr.puntos_obtenidos DESC, u.nombre
  `).all(partido_id, usuario_id);

  res.json(predicciones);
});

// GET /api/prode/usuario/:usuario_id/torneo/:torneo_id/predicciones-completadas
router.get('/usuario/:usuario_id/torneo/:torneo_id/predicciones-completadas', authMiddleware, (req, res) => {
  const { usuario_id, torneo_id } = req.params;
  const solicitante_id = req.usuario.id;

  // Permitir ver las propias predicciones sin restricción
  if (String(solicitante_id) !== String(usuario_id)) {
    // Verificar que el solicitante comparte al menos un grupo privado con el usuario_id consultado
    const grupoCompartido = db.prepare(`
      SELECT 1
      FROM prode_grupos_miembros gm1
      JOIN prode_grupos_miembros gm2 ON gm2.grupo_id = gm1.grupo_id
      JOIN prode_grupos g ON g.id = gm1.grupo_id
      WHERE gm1.usuario_id = ? AND gm2.usuario_id = ? AND g.torneo_id = ?
      LIMIT 1
    `).get(solicitante_id, usuario_id, torneo_id);

    if (!grupoCompartido) {
      return res.status(403).json({ error: 'No tenés permiso para ver las predicciones de este usuario.' });
    }
  }

  const predicciones = db.prepare(`
    SELECT 
      pr.goles_local AS pronostico_local,
      pr.goles_visita AS pronostico_visita,
      pr.puntos_obtenidos,
      p.id AS partido_id,
      p.goles_local AS resultado_local,
      p.goles_visita AS resultado_visita,
      el.nombre AS local_nombre, 
      ev.nombre AS visita_nombre,
      f.numero AS fecha_numero
    FROM pronosticos pr
    JOIN partidos p ON p.id = pr.partido_id
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visita_id
    JOIN fechas f ON f.id = p.fecha_id
    WHERE pr.usuario_id = ? AND f.torneo_id = ? AND p.estado != 'pendiente'
    ORDER BY f.numero DESC, p.id DESC
  `).all(usuario_id, torneo_id);

  res.json(predicciones);
});

module.exports = router;
