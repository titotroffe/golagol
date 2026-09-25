const express = require('express');
const db = require('../db/database');
const { authMiddleware, soloAdmin, adminOReportero } = require('../middleware/auth');

const router = express.Router();

// GET /api/equipos - Listar todos los equipos
router.get('/', (req, res) => {
  const equipos = db.prepare('SELECT * FROM equipos ORDER BY nombre').all();
  res.json(equipos);
});

// GET /api/equipos/:id - Detalle del equipo
router.get('/:id', (req, res) => {
  const equipo = db.prepare('SELECT * FROM equipos WHERE id = ?').get(req.params.id);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
  res.json(equipo);
});

// GET /api/equipos/:id/plantel - Plantel completo
router.get('/:id/plantel', (req, res) => {
  const plantel = db.prepare(`
    SELECT j.*, e.nombre AS equipo_nombre
    FROM jugadores j
    JOIN equipos e ON e.id = j.equipo_id
    WHERE j.equipo_id = ? AND j.activo = 1
    ORDER BY j.posicion, j.apellido
  `).all(req.params.id);
  res.json(plantel);
});

// ADMIN: POST /api/equipos/:id/jugadores - Agregar jugador al plantel
router.post('/:id/jugadores', authMiddleware, adminOReportero, (req, res) => {
  const { nombre, apellido, dorsal, posicion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare(`
    INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, nombre, apellido || '', dorsal || null, posicion || null);

  res.status(201).json({ id: result.lastInsertRowid, nombre, apellido });
});

// GET /api/equipos/:id/estadisticas/:torneo_id - Stats del equipo en un torneo
router.get('/:id/estadisticas/:torneo_id', (req, res) => {
  const { id, torneo_id } = req.params;

  // Calcular stats desde los partidos
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS partidos_jugados,
      SUM(CASE
        WHEN (equipo_local_id = ? AND goles_local > goles_visita) OR
             (equipo_visita_id = ? AND goles_visita > goles_local) THEN 1 ELSE 0
      END) AS ganados,
      SUM(CASE
        WHEN goles_local = goles_visita THEN 1 ELSE 0
      END) AS empatados,
      SUM(CASE
        WHEN (equipo_local_id = ? AND goles_local < goles_visita) OR
             (equipo_visita_id = ? AND goles_visita < goles_local) THEN 1 ELSE 0
      END) AS perdidos,
      SUM(CASE WHEN equipo_local_id = ? THEN goles_local ELSE goles_visita END) AS goles_favor,
      SUM(CASE WHEN equipo_local_id = ? THEN goles_visita ELSE goles_local END) AS goles_contra
    FROM partidos p
    JOIN fechas f ON f.id = p.fecha_id
    WHERE (equipo_local_id = ? OR equipo_visita_id = ?)
      AND f.torneo_id = ?
      AND p.estado = 'finalizado'
  `).get(id, id, id, id, id, id, id, id, torneo_id);

  if (stats) {
    stats.puntos = (stats.ganados * 3) + stats.empatados;
    stats.diferencia_goles = stats.goles_favor - stats.goles_contra;
  }

  res.json(stats || {});
});

// GET /api/equipos/:id/proximos-partidos - Próximos 5 partidos
router.get('/:id/proximos-partidos', (req, res) => {
  const partidos = db.prepare(`
    SELECT p.*, 
           el.nombre AS local_nombre,
           ev.nombre AS visita_nombre,
           f.numero AS fecha_numero,
           t.nombre AS torneo_nombre
    FROM partidos p
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visita_id
    JOIN fechas f ON f.id = p.fecha_id
    JOIN torneos t ON t.id = f.torneo_id
    WHERE (p.equipo_local_id = ? OR p.equipo_visita_id = ?)
      AND p.estado = 'pendiente'
    ORDER BY p.fecha_hora ASC
    LIMIT 5
  `).all(req.params.id, req.params.id);
  res.json(partidos);
});

// GET /api/equipos/:id/ultimos-partidos - Últimos 5 resultados
router.get('/:id/ultimos-partidos', (req, res) => {
  const partidos = db.prepare(`
    SELECT p.*, 
           el.nombre AS local_nombre,
           ev.nombre AS visita_nombre,
           f.numero AS fecha_numero,
           t.nombre AS torneo_nombre
    FROM partidos p
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visita_id
    JOIN fechas f ON f.id = p.fecha_id
    JOIN torneos t ON t.id = f.torneo_id
    WHERE (p.equipo_local_id = ? OR p.equipo_visita_id = ?)
      AND p.estado = 'finalizado'
    ORDER BY p.fecha_hora DESC
    LIMIT 5
  `).all(req.params.id, req.params.id);
  res.json(partidos);
});

// ADMIN: POST /api/equipos - Crear equipo
router.post('/', authMiddleware, soloAdmin, (req, res) => {
  const { nombre, escudo_url, color_local, color_visita, estadio } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare(`
    INSERT INTO equipos (nombre, escudo_url, color_local, color_visita, estadio)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre, escudo_url || null, color_local || '#cccccc', color_visita || '#ffffff', estadio || null);

  res.status(201).json({ id: result.lastInsertRowid, nombre });
});

// ADMIN: PUT /api/equipos/:id - Editar equipo
router.put('/:id', authMiddleware, soloAdmin, (req, res) => {
  const { nombre, escudo_url, color_local, color_visita, estadio } = req.body;
  db.prepare(`
    UPDATE equipos SET nombre = ?, escudo_url = ?, color_local = ?, color_visita = ?, estadio = ?
    WHERE id = ?
  `).run(nombre, escudo_url, color_local, color_visita, estadio, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
