const express = require('express');
const db = require('../db/database');
const { authMiddleware, soloAdmin, adminOReportero } = require('../middleware/auth');

const router = express.Router();

// GET /api/partidos/:id - Detalle de un partido con eventos
router.get('/:id', (req, res) => {
  const partido = db.prepare(`
    SELECT p.*,
           el.nombre AS local_nombre, el.escudo_url AS local_escudo,
           ev.nombre AS visita_nombre, ev.escudo_url AS visita_escudo,
           f.numero AS fecha_numero,
           t.nombre AS torneo_nombre, t.id AS torneo_id
    FROM partidos p
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visita_id
    JOIN fechas f ON f.id = p.fecha_id
    JOIN torneos t ON t.id = f.torneo_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

  const eventos = db.prepare(`
    SELECT ep.*,
           j.nombre AS jugador_nombre, j.apellido AS jugador_apellido,
           e.nombre AS equipo_nombre
    FROM eventos_partido ep
    LEFT JOIN jugadores j ON j.id = ep.jugador_id
    LEFT JOIN equipos e ON e.id = ep.equipo_id
    WHERE ep.partido_id = ?
    ORDER BY ep.minuto ASC
  `).all(req.params.id);

  res.json({ ...partido, eventos });
});

// GET /api/partidos/fecha/:fecha_id - Partidos de una fecha
router.get('/fecha/:fecha_id', (req, res) => {
  const partidos = db.prepare(`
    SELECT p.*,
           el.nombre AS local_nombre, el.escudo_url AS local_escudo,
           ev.nombre AS visita_nombre, ev.escudo_url AS visita_escudo
    FROM partidos p
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visita_id
    WHERE p.fecha_id = ?
    ORDER BY p.fecha_hora ASC
  `).all(req.params.fecha_id);
  res.json(partidos);
});

// ─────────────────────────────────────────
// ALINEACIONES
// ─────────────────────────────────────────

// GET /api/partidos/:id/alineaciones
router.get('/:id/alineaciones', (req, res) => {
  const alineaciones = db.prepare(`
    SELECT a.*, j.nombre, j.apellido, j.posicion as posicion_habitual
    FROM alineaciones a
    JOIN jugadores j ON j.id = a.jugador_id
    WHERE a.partido_id = ?
    ORDER BY a.tipo ASC, a.dorsal ASC, j.apellido ASC
  `).all(req.params.id);
  res.json(alineaciones);
});

// POST /api/partidos/:id/alineaciones
router.post('/:id/alineaciones', authMiddleware, adminOReportero, (req, res) => {
  const { equipo_id, jugador_id, tipo, dorsal } = req.body;
  if (!equipo_id || !jugador_id || !tipo) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const result = db.prepare(`
      INSERT INTO alineaciones (partido_id, equipo_id, jugador_id, tipo, dorsal)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, equipo_id, jugador_id, tipo, dorsal || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'El jugador ya está en la alineación' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/partidos/:id/alineaciones/:jugador_id
router.delete('/:id/alineaciones/:jugador_id', authMiddleware, adminOReportero, (req, res) => {
  db.prepare('DELETE FROM alineaciones WHERE partido_id = ? AND jugador_id = ?')
    .run(req.params.id, req.params.jugador_id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// ADMIN: POST /api/partidos - Crear partido
// ─────────────────────────────────────────
router.post('/', authMiddleware, soloAdmin, (req, res) => {
  const { fecha_id, equipo_local_id, equipo_visita_id, fecha_hora, cancha } = req.body;

  if (!fecha_id || !equipo_local_id || !equipo_visita_id) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const result = db.prepare(`
    INSERT INTO partidos (fecha_id, equipo_local_id, equipo_visita_id, fecha_hora, cancha)
    VALUES (?, ?, ?, ?, ?)
  `).run(fecha_id, equipo_local_id, equipo_visita_id, fecha_hora || null, cancha || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ─────────────────────────────────────────
// REPORTERO: PUT /api/partidos/:id/resultado
// Cargar el resultado final y calcular puntos del Prode automáticamente
// ─────────────────────────────────────────
router.put('/:id/resultado', authMiddleware, adminOReportero, (req, res) => {
  const { goles_local, goles_visita } = req.body;
  const partido_id = req.params.id;

  if (goles_local == null || goles_visita == null) {
    return res.status(400).json({ error: 'Goles local y visita son requeridos' });
  }

  // Actualizar el partido
  db.prepare(`
    UPDATE partidos SET goles_local = ?, goles_visita = ?, estado = 'finalizado' WHERE id = ?
  `).run(goles_local, goles_visita, partido_id);

  // Calcular y actualizar puntos de pronósticos automáticamente
  const pronosticos = db.prepare('SELECT * FROM pronosticos WHERE partido_id = ?').all(partido_id);

  const actualizarPuntos = db.transaction(() => {
    pronosticos.forEach(p => {
      let puntos = 0;

      const acertoExacto = p.goles_local === goles_local && p.goles_visita === goles_visita;
      if (acertoExacto) {
        puntos = 6;
      } else {
        const signoReal     = Math.sign(goles_local - goles_visita);
        const signoPronostico = Math.sign(p.goles_local - p.goles_visita);
        if (signoReal === signoPronostico) puntos = 3;
      }

      db.prepare(`
        UPDATE pronosticos SET puntos_obtenidos = ?, calculado_en = datetime('now')
        WHERE id = ?
      `).run(puntos, p.id);
    });
  });

  actualizarPuntos();

  res.json({
    ok: true,
    mensaje: `Resultado guardado. Se calcularon puntos para ${pronosticos.length} pronósticos.`
  });
});

// ─────────────────────────────────────────
// REPORTERO: POST /api/partidos/:id/evento
// Registrar gol, tarjeta, cambio en tiempo real
// ─────────────────────────────────────────
router.post('/:id/evento', authMiddleware, adminOReportero, (req, res) => {
  const { minuto, tipo, equipo_id, jugador_id, jugador_nombre, detalle } = req.body;
  const partido_id = req.params.id;

  if (!tipo) return res.status(400).json({ error: 'El tipo de evento es requerido' });
  // El equipo_id es opcional para eventos de estado de partido (INICIO, FIN, etc)

  let final_jugador_id = jugador_id;

  // Si mandan nombre en vez de ID, buscar o crear jugador
  if (!final_jugador_id && jugador_nombre) {
    const [nombre, ...apellidoParts] = jugador_nombre.trim().split(' ');
    const apellido = apellidoParts.join(' ') || '';
    
    // Buscar si ya existe
    const existente = db.prepare('SELECT id FROM jugadores WHERE equipo_id = ? AND nombre = ? AND apellido = ? COLLATE NOCASE')
      .get(equipo_id, nombre, apellido);

    if (existente) {
      final_jugador_id = existente.id;
    } else {
      // Crear on the fly
      const r = db.prepare('INSERT INTO jugadores (equipo_id, nombre, apellido) VALUES (?, ?, ?)')
        .run(equipo_id, nombre, apellido);
      final_jugador_id = r.lastInsertRowid;
    }
  }

  // Si es un gol, actualizar el marcador en tiempo real
  if (tipo === 'GOL' || tipo === 'AUTOGOL') {
    const partido = db.prepare('SELECT * FROM partidos WHERE id = ?').get(partido_id);

    if (partido) {
      let nuevoLocal = partido.goles_local || 0;
      let nuevoVisita = partido.goles_visita || 0;

      if (tipo === 'GOL') {
        if (equipo_id == partido.equipo_local_id) nuevoLocal++;
        else nuevoVisita++;
      } else {
        // Autogol: el que lo convierte lo mete en su propio arco
        if (equipo_id == partido.equipo_local_id) nuevoVisita++;
        else nuevoLocal++;
      }

      db.prepare(`
        UPDATE partidos SET goles_local = ?, goles_visita = ?, estado = 'en_curso' WHERE id = ?
      `).run(nuevoLocal, nuevoVisita, partido_id);
    }
  }
  
  // Eventos de estado de partido
  if (['INICIO_PARTIDO', 'INICIO_2T'].includes(tipo)) {
    db.prepare("UPDATE partidos SET estado = 'en_curso' WHERE id = ?").run(partido_id);
  }
  if (tipo === 'FIN_PARTIDO') {
    db.prepare("UPDATE partidos SET estado = 'finalizado' WHERE id = ?").run(partido_id);
  }

  const result = db.prepare(`
    INSERT INTO eventos_partido (partido_id, minuto, tipo, equipo_id, jugador_id, detalle)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(partido_id, minuto || null, tipo, equipo_id, final_jugador_id || null, detalle || null);

  const evento = db.prepare(`
    SELECT ep.*, j.nombre AS jugador_nombre, j.apellido AS jugador_apellido, e.nombre AS equipo_nombre
    FROM eventos_partido ep
    LEFT JOIN jugadores j ON j.id = ep.jugador_id
    LEFT JOIN equipos e ON e.id = ep.equipo_id
    WHERE ep.id = ?
  `).get(result.lastInsertRowid);

  // Emitir por WebSocket a todos los clientes conectados (si el ws está disponible)
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({
      tipo: 'EVENTO_PARTIDO',
      partido_id,
      evento
    });
  }

  res.status(201).json(evento);
});

// ─────────────────────────────────────────
// REPORTERO: DELETE /api/partidos/:id/evento/:evento_id
// Eliminar un evento registrado por error
// ─────────────────────────────────────────
router.delete('/:id/evento/:evento_id', authMiddleware, adminOReportero, (req, res) => {
  const { id: partido_id, evento_id } = req.params;

  // Buscar el evento primero para ver si es un gol y deshacer el puntaje
  const evento = db.prepare('SELECT * FROM eventos_partido WHERE id = ? AND partido_id = ?').get(evento_id, partido_id);
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

  // Si fue un gol o autogol, restar del marcador
  if (evento.tipo === 'GOL' || evento.tipo === 'AUTOGOL') {
    const partido = db.prepare('SELECT * FROM partidos WHERE id = ?').get(partido_id);
    if (partido) {
      let nuevoLocal = partido.goles_local || 0;
      let nuevoVisita = partido.goles_visita || 0;
      
      if (evento.tipo === 'GOL') {
        if (evento.equipo_id == partido.equipo_local_id) nuevoLocal = Math.max(0, nuevoLocal - 1);
        else nuevoVisita = Math.max(0, nuevoVisita - 1);
      } else {
        if (evento.equipo_id == partido.equipo_local_id) nuevoVisita = Math.max(0, nuevoVisita - 1);
        else nuevoLocal = Math.max(0, nuevoLocal - 1);
      }

      db.prepare(`UPDATE partidos SET goles_local = ?, goles_visita = ? WHERE id = ?`).run(nuevoLocal, nuevoVisita, partido_id);
    }
  }

  // Si fue un estado de partido, podríamos intentar revertirlo, pero es complejo saber el estado anterior. 
  // Lo dejamos como finalizado o en curso según corresponda, o no lo tocamos.
  if (evento.tipo === 'FIN_PARTIDO') {
    db.prepare("UPDATE partidos SET estado = 'en_curso' WHERE id = ?").run(partido_id);
  }

  // Eliminar el evento
  db.prepare('DELETE FROM eventos_partido WHERE id = ?').run(evento_id);

  // Emitir por WebSocket para refrescar
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({
      tipo: 'EVENTO_ELIMINADO',
      partido_id,
      evento_id
    });
  }

  res.json({ ok: true });
});

module.exports = router;
