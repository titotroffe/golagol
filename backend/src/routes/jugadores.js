const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/jugadores/cumpleaneros
// Devuelve los jugadores que cumplen años hoy
router.get('/cumpleaneros', (req, res) => {
  // SQLite strftime('%m-%d', 'now') da el mes-día actual
  // fecha_nacimiento se asume en formato YYYY-MM-DD
  const cumpleaneros = db.prepare(`
    SELECT j.*, e.nombre as equipo_nombre, e.escudo_url
    FROM jugadores j
    JOIN equipos e ON e.id = j.equipo_id
    WHERE j.activo = 1 
      AND j.fecha_nacimiento IS NOT NULL
      AND strftime('%m-%d', j.fecha_nacimiento) = strftime('%m-%d', 'now', 'localtime')
  `).all();
  
  res.json(cumpleaneros);
});

// PUT /api/jugadores/:id
// Editar jugador (dni, fecha_nacimiento, etc.)
router.put('/:id', (req, res) => {
  const { dni, fecha_nacimiento, nombre, apellido } = req.body;
  
  db.prepare(`
    UPDATE jugadores
    SET dni = COALESCE(?, dni),
        fecha_nacimiento = COALESCE(?, fecha_nacimiento),
        nombre = COALESCE(?, nombre),
        apellido = COALESCE(?, apellido)
    WHERE id = ?
  `).run(
    dni !== undefined ? dni : null,
    fecha_nacimiento !== undefined ? fecha_nacimiento : null,
    nombre !== undefined ? nombre : null,
    apellido !== undefined ? apellido : null,
    req.params.id
  );

  res.json({ ok: true });
});

module.exports = router;
