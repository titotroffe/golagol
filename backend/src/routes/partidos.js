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
    ORDER BY ep.minuto ASC, ep.id ASC
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

// GET /api/partidos/:id/pulso - Porcentajes de apuestas
router.get('/:id/pulso', (req, res) => {
  const { id } = req.params;
  try {
    const pronosticos = db.prepare('SELECT goles_local, goles_visita FROM pronosticos WHERE partido_id = ?').all(id);
    
    const total = pronosticos.length;
    if (total === 0) {
      return res.json({ total: 0, local: 0, empate: 0, visita: 0 });
    }

    let local = 0, empate = 0, visita = 0;
    pronosticos.forEach(p => {
      if (p.goles_local > p.goles_visita) local++;
      else if (p.goles_local < p.goles_visita) visita++;
      else empate++;
    });

    res.json({
      total,
      local: Math.round((local / total) * 100),
      empate: Math.round((empate / total) * 100),
      visita: Math.round((visita / total) * 100),
    });
  } catch (err) {
    console.error('Error calculando pulso:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
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

// Helper para avanzar las sanciones cuando un partido finaliza
const avanzarSanciones = (partido_id) => {
  const partido = db.prepare(`
    SELECT p.estado, f.torneo_id, p.equipo_local_id, p.equipo_visita_id 
    FROM partidos p 
    JOIN fechas f ON f.id = p.fecha_id 
    WHERE p.id = ?
  `).get(partido_id);

  if (partido && partido.estado !== 'finalizado') {
    db.transaction(() => {
      // 1. Incrementar fechas cumplidas a los jugadores sancionados de los equipos que jugaron
      db.prepare(`
        UPDATE sanciones 
        SET fechas_cumplidas = fechas_cumplidas + 1
        WHERE torneo_id = ? AND activa = 1 AND jugador_id IN (
          SELECT id FROM jugadores WHERE equipo_id IN (?, ?)
        )
      `).run(partido.torneo_id, partido.equipo_local_id, partido.equipo_visita_id);

      // 2. Desactivar sanciones que ya cumplieron todas sus fechas
      db.prepare(`
        UPDATE sanciones
        SET activa = 0
        WHERE activa = 1 AND fechas_cumplidas >= fechas_a_cumplir
      `).run();
    })();
  }
};

// ─────────────────────────────────────────
// REPORTERO: PUT /api/partidos/:id/resultado
// Cargar el resultado final y calcular puntos del Prode automáticamente
// ─────────────────────────────────────────
router.put('/:id/resultado', authMiddleware, adminOReportero, (req, res) => {
  const { goles_local, goles_visita, por_escritorio, ganador_escritorio } = req.body;
  const partido_id = req.params.id;

  if (goles_local == null || goles_visita == null) {
    return res.status(400).json({ error: 'Goles local y visita son requeridos' });
  }

  // Avanzar sanciones (solo si el partido no estaba finalizado previamente)
  avanzarSanciones(partido_id);

  // Actualizar el partido
  db.prepare(`
    UPDATE partidos SET goles_local = ?, goles_visita = ?, estado = 'finalizado', por_escritorio = ?, ganador_escritorio = ? WHERE id = ?
  `).run(goles_local, goles_visita, por_escritorio ? 1 : 0, ganador_escritorio || null, partido_id);

  // Calcular y actualizar puntos de pronósticos automáticamente usando SQLite nativo (Bulk Update)
  db.prepare(`
    UPDATE pronosticos
    SET 
      puntos_obtenidos = CASE
        WHEN goles_local = ? AND goles_visita = ? THEN 6
        WHEN SIGN(goles_local - goles_visita) = SIGN(? - ?) THEN 3
        ELSE 0
      END,
      calculado_en = datetime('now')
    WHERE partido_id = ?
  `).run(goles_local, goles_visita, goles_local, goles_visita, partido_id);

  const pronosticosCount = db.prepare('SELECT count(*) as count FROM pronosticos WHERE partido_id = ?').get(partido_id).count;

  res.json({
    ok: true,
    mensaje: `Resultado guardado. Se calcularon puntos para ${pronosticosCount} pronósticos.`
  });
});

// ─────────────────────────────────────────
// ADMIN: POST /api/partidos/:id/escritorio
// Otorgar puntos en escritorio (local, visita o null para limpiar)
// ─────────────────────────────────────────
router.post('/:id/escritorio', authMiddleware, soloAdmin, (req, res) => {
  const { ganador_escritorio } = req.body;
  if (ganador_escritorio !== 'local' && ganador_escritorio !== 'visita' && ganador_escritorio !== null) {
    return res.status(400).json({ error: 'ganador_escritorio debe ser local, visita o null' });
  }

  db.prepare(`UPDATE partidos SET ganador_escritorio = ? WHERE id = ?`)
    .run(ganador_escritorio, req.params.id);

  res.json({ ok: true, mensaje: 'Ganador de escritorio actualizado' });
});

// ─────────────────────────────────────────
// ADMIN: PUT /api/partidos/:id/horario
// Actualizar horario y cancha de un partido
// ─────────────────────────────────────────
router.put('/:id/horario', authMiddleware, adminOReportero, (req, res) => {
  const { fecha_hora, cancha } = req.body;
  const partido_id = req.params.id;

  db.prepare(`
    UPDATE partidos SET fecha_hora = ?, cancha = ? WHERE id = ?
  `).run(fecha_hora || null, cancha || null, partido_id);

  res.json({ ok: true, mensaje: 'Horario y cancha actualizados' });
});

// ─────────────────────────────────────────
// ADMIN: PUT /api/partidos/:id/estado
// Cambiar el estado de un partido: 'suspendido' | 'en_curso' | 'pendiente'
// Permite suspender un partido en curso y luego reanudarlo
// ─────────────────────────────────────────
router.put('/:id/estado', authMiddleware, soloAdmin, (req, res) => {
  const { estado, motivo, minuto } = req.body;
  const partido_id = req.params.id;

  const estadosPermitidos = ['suspendido', 'en_curso', 'pendiente'];
  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(', ')}` });
  }

  const partido = db.prepare('SELECT * FROM partidos WHERE id = ?').get(partido_id);
  if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });

  // No se puede cambiar el estado de un partido ya finalizado
  if (partido.estado === 'finalizado') {
    return res.status(403).json({ error: 'No se puede cambiar el estado de un partido finalizado' });
  }

  db.prepare('UPDATE partidos SET estado = ? WHERE id = ?').run(estado, partido_id);

  // Si se reanuda, registrar evento de reanudación en el historial
  if (estado === 'en_curso' && partido.estado === 'suspendido') {
    db.prepare(`
      INSERT INTO eventos_partido (partido_id, minuto, tipo, equipo_id, jugador_id, detalle)
      VALUES (?, ?, 'REANUDACION', NULL, NULL, ?)
    `).run(partido_id, minuto || 0, motivo || 'Partido reanudado');
  }

  // Si se suspende, registrar evento en el historial
  if (estado === 'suspendido') {
    db.prepare(`
      INSERT INTO eventos_partido (partido_id, minuto, tipo, equipo_id, jugador_id, detalle)
      VALUES (?, ?, 'SUSPENSION', NULL, NULL, ?)
    `).run(partido_id, minuto || 0, motivo || 'Partido suspendido');
  }

  // Broadcast por WebSocket si está disponible
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({
      tipo: 'ESTADO_PARTIDO',
      partido_id: parseInt(partido_id),
      estado,
      motivo: motivo || null
    });
  }

  res.json({ ok: true, mensaje: `Partido marcado como "${estado}"` });
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
  if (['GOL', 'AUTOGOL', 'GOL_PENAL'].includes(tipo)) {
    const partido = db.prepare('SELECT * FROM partidos WHERE id = ?').get(partido_id);

    if (partido) {
      let nuevoLocal = partido.goles_local || 0;
      let nuevoVisita = partido.goles_visita || 0;

      if (tipo === 'GOL' || tipo === 'GOL_PENAL') {
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
  let puntos_usuarios = [];
  if (tipo === 'FIN_PARTIDO') {
    avanzarSanciones(partido_id);
    db.prepare("UPDATE partidos SET estado = 'finalizado' WHERE id = ?").run(partido_id);

    // Calcular puntos automáticamente
    const partidoFinal = db.prepare('SELECT goles_local, goles_visita FROM partidos WHERE id = ?').get(partido_id);
    const gl = partidoFinal.goles_local || 0;
    const gv = partidoFinal.goles_visita || 0;
    
    const pronosticos = db.prepare('SELECT * FROM pronosticos WHERE partido_id = ?').all(partido_id);
    const actualizarPuntos = db.transaction(() => {
      pronosticos.forEach(p => {
        let puntos = 0;
        if (p.goles_local === gl && p.goles_visita === gv) {
          puntos = 6;
        } else if (Math.sign(gl - gv) === Math.sign(p.goles_local - p.goles_visita)) {
          puntos = 3;
        }
        db.prepare(`UPDATE pronosticos SET puntos_obtenidos = ?, calculado_en = datetime('now') WHERE id = ?`).run(puntos, p.id);
        puntos_usuarios.push({ usuario_id: p.usuario_id, puntos });
      });
    });
    actualizarPuntos();
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

  // Verificar si fue doble amarilla para el broadcast
  let broadcastEvento = { ...evento };
  if (broadcastEvento.tipo === 'AMARILLA' && final_jugador_id) {
    const amarillasCount = db.prepare(`
      SELECT COUNT(*) as count FROM eventos_partido 
      WHERE partido_id = ? AND jugador_id = ? AND tipo = 'AMARILLA'
    `).get(partido_id, final_jugador_id).count;

    if (amarillasCount >= 2) {
      broadcastEvento.tipo = 'DOBLE_AMARILLA';
    }
  }

  // Emitir por WebSocket a todos los clientes conectados (si el ws está disponible)
  if (req.app.locals.broadcast) {
    const partidoActualizado = db.prepare(`
      SELECT p.goles_local, p.goles_visita, l.nombre as local_nombre, v.nombre as visita_nombre
      FROM partidos p
      JOIN equipos l ON p.equipo_local_id = l.id
      JOIN equipos v ON p.equipo_visita_id = v.id
      WHERE p.id = ?
    `).get(partido_id);

    req.app.locals.broadcast({
      tipo: 'EVENTO_PARTIDO',
      partido_id,
      evento: broadcastEvento,
      partido: partidoActualizado,
      puntos_usuarios
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
  if (['GOL', 'AUTOGOL', 'GOL_PENAL'].includes(evento.tipo)) {
    const partido = db.prepare('SELECT * FROM partidos WHERE id = ?').get(partido_id);
    if (partido) {
      let nuevoLocal = partido.goles_local || 0;
      let nuevoVisita = partido.goles_visita || 0;
      
      if (evento.tipo === 'GOL' || evento.tipo === 'GOL_PENAL') {
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

// ─────────────────────────────────────────
// CHAT EN VIVO DEL PARTIDO
// ─────────────────────────────────────────

// GET /api/partidos/:id/chat - Obtener mensajes
router.get('/:id/chat', (req, res) => {
  const mensajes = db.prepare(`
    SELECT c.id, c.mensaje, c.enviado_en, c.color,
           u.nombre, u.apellido, u.usuario, u.avatar_url,
           e.nombre AS equipo_favorito
    FROM partidos_chat c
    JOIN usuarios u ON u.id = c.usuario_id
    LEFT JOIN equipos e ON e.id = u.equipo_id
    WHERE c.partido_id = ?
    ORDER BY c.enviado_en ASC
  `).all(req.params.id);
  res.json(mensajes);
});

// POST /api/partidos/:id/chat - Enviar mensaje
router.post('/:id/chat', authMiddleware, (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'Mensaje vacío' });
  }

  const result = db.prepare(`
    INSERT INTO partidos_chat (partido_id, usuario_id, mensaje, color)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, req.usuario.id, mensaje.trim(), req.body.color || '#58a6ff');

  const nuevoMensaje = db.prepare(`
    SELECT c.id, c.mensaje, c.enviado_en, c.color,
           u.nombre, u.apellido, u.usuario, u.avatar_url,
           e.nombre AS equipo_favorito
    FROM partidos_chat c
    JOIN usuarios u ON u.id = c.usuario_id
    LEFT JOIN equipos e ON e.id = u.equipo_id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  // Broadcast WebSocket
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({
      tipo: 'CHAT_PARTIDO',
      partido_id: parseInt(req.params.id),
      mensaje: nuevoMensaje
    });
  }

  res.status(201).json(nuevoMensaje);
});

module.exports = router;
