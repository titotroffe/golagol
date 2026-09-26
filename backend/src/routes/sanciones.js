const express = require('express');
const db = require('../db/database');
const { authMiddleware, soloAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/sanciones/torneo/:id
// Obtener todas las sanciones de un torneo
router.get('/torneo/:id', (req, res) => {
  const sanciones = db.prepare(`
    SELECT s.*, j.nombre, j.apellido, e.nombre as equipo_nombre
    FROM sanciones s
    JOIN jugadores j ON j.id = s.jugador_id
    JOIN equipos e ON e.id = j.equipo_id
    WHERE s.torneo_id = ?
    ORDER BY s.activa DESC, s.creado_en DESC
  `).all(req.params.id);
  res.json(sanciones);
});

// POST /api/sanciones
// Crear nueva sanción
router.post('/', authMiddleware, soloAdmin, (req, res) => {
  const { jugador_id, jugador_nombre, equipo_id, torneo_id, fechas_a_cumplir, motivo } = req.body;
  
  if (!torneo_id || !fechas_a_cumplir) {
    return res.status(400).json({ error: 'Faltan datos requeridos (torneo_id, fechas_a_cumplir)' });
  }

  let final_jugador_id = jugador_id;

  // Crear o buscar jugador por nombre si no viene el ID
  if (!final_jugador_id && jugador_nombre && equipo_id) {
    const [nombre, ...apellidoParts] = jugador_nombre.trim().split(' ');
    const apellido = apellidoParts.join(' ') || '';
    
    const existente = db.prepare('SELECT id FROM jugadores WHERE equipo_id = ? AND nombre = ? AND apellido = ? COLLATE NOCASE')
      .get(equipo_id, nombre, apellido);

    if (existente) {
      final_jugador_id = existente.id;
    } else {
      const r = db.prepare('INSERT INTO jugadores (equipo_id, nombre, apellido) VALUES (?, ?, ?)')
        .run(equipo_id, nombre, apellido);
      final_jugador_id = r.lastInsertRowid;
    }
  }

  if (!final_jugador_id) {
    return res.status(400).json({ error: 'Falta jugador_id o jugador_nombre y equipo_id' });
  }

  const result = db.prepare(`
    INSERT INTO sanciones (jugador_id, torneo_id, fechas_a_cumplir, fechas_cumplidas, motivo, activa)
    VALUES (?, ?, ?, 0, ?, 1)
  `).run(final_jugador_id, torneo_id, fechas_a_cumplir, motivo || null);

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Sanción cargada correctamente' });
});

// PUT /api/sanciones/:id
// Editar sanción existente
router.put('/:id', authMiddleware, soloAdmin, (req, res) => {
  const { fechas_a_cumplir, fechas_cumplidas, motivo, activa } = req.body;
  
  const sancion = db.prepare('SELECT * FROM sanciones WHERE id = ?').get(req.params.id);
  if (!sancion) return res.status(404).json({error: 'Sanción no encontrada'});

  const newFechasCumplir = fechas_a_cumplir !== undefined ? fechas_a_cumplir : sancion.fechas_a_cumplir;
  const newFechasCumplidas = fechas_cumplidas !== undefined ? fechas_cumplidas : sancion.fechas_cumplidas;
  const newMotivo = motivo !== undefined ? motivo : sancion.motivo;
  const newActiva = activa !== undefined ? activa : sancion.activa;

  db.prepare(`
    UPDATE sanciones 
    SET fechas_a_cumplir = ?, fechas_cumplidas = ?, motivo = ?, activa = ?
    WHERE id = ?
  `).run(newFechasCumplir, newFechasCumplidas, newMotivo, newActiva, req.params.id);

  res.json({ ok: true, mensaje: 'Sanción actualizada' });
});

// DELETE /api/sanciones/:id
// Eliminar sanción
router.delete('/:id', authMiddleware, soloAdmin, (req, res) => {
  db.prepare('DELETE FROM sanciones WHERE id = ?').run(req.params.id);
  res.json({ ok: true, mensaje: 'Sanción eliminada' });
});

module.exports = router;
