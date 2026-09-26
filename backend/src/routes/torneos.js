const express = require('express');
const db = require('../db/database');
const { authMiddleware, soloAdmin } = require('../middleware/auth');

const router = express.Router();

function ordenarTabla(equipos, partidos) {
  const porPuntos = {};
  equipos.forEach(eq => {
    if (!porPuntos[eq.puntos]) porPuntos[eq.puntos] = [];
    porPuntos[eq.puntos].push(eq);
  });

  const puntajesUnicos = Object.keys(porPuntos).map(Number).sort((a, b) => b - a);
  let tablaOrdenada = [];

  for (const pts of puntajesUnicos) {
    const grupo = porPuntos[pts];
    if (grupo.length === 1) {
      tablaOrdenada.push(grupo[0]);
    } else {
      const idsGrupo = grupo.map(e => e.equipo_id);
      const miniTablaPts = {};
      idsGrupo.forEach(id => miniTablaPts[id] = 0);

      partidos.forEach(p => {
        if (idsGrupo.includes(p.equipo_local_id) && idsGrupo.includes(p.equipo_visita_id)) {
          if (p.ganador_escritorio === 'local') {
            miniTablaPts[p.equipo_local_id] += 3;
          } else if (p.ganador_escritorio === 'visita') {
            miniTablaPts[p.equipo_visita_id] += 3;
          } else {
            const gl = p.goles_local;
            const gv = p.goles_visita;
            if (gl > gv) {
              miniTablaPts[p.equipo_local_id] += 3;
            } else if (gl < gv) {
              miniTablaPts[p.equipo_visita_id] += 3;
            } else if (gl === gv) {
              miniTablaPts[p.equipo_local_id] += 1;
              miniTablaPts[p.equipo_visita_id] += 1;
            }
          }
        }
      });

      grupo.sort((a, b) => {
        const ptsA = miniTablaPts[a.equipo_id];
        const ptsB = miniTablaPts[b.equipo_id];
        if (ptsA !== ptsB) return ptsB - ptsA; // Criterio 2: Puntos en partidos entre sí
        if (a.dg !== b.dg) return b.dg - a.dg; // Criterio 3: Diferencia de goles
        if (a.gf !== b.gf) return b.gf - a.gf; // Criterio 4: Goles a favor
        return a.nombre.localeCompare(b.nombre);
      });

      tablaOrdenada.push(...grupo);
    }
  }

  tablaOrdenada.forEach((eq, idx) => eq.posicion = idx + 1);
  return tablaOrdenada;
}

// GET /api/torneos - Listar torneos
router.get('/', (req, res) => {
  const torneos = db.prepare('SELECT * FROM torneos ORDER BY temporada DESC, id ASC').all();
  res.json(torneos);
});

// GET /api/torneos/:id - Detalle de un torneo
router.get('/:id', (req, res) => {
  const torneo = db.prepare('SELECT * FROM torneos WHERE id = ?').get(req.params.id);
  if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });
  res.json(torneo);
});

// ─────────────────────────────────────────
// GET /api/torneos/:id/inicio
// ─────────────────────────────────────────
router.get('/:id/inicio', (req, res) => {
  const torneo_id = req.params.id;
  
  // Partidos en vivo
  const enVivo = db.prepare(`
    SELECT p.*,
           el.nombre AS local_nombre, el.escudo_url AS local_escudo,
           ev.nombre AS visita_nombre, ev.escudo_url AS visita_escudo,
           f.numero AS fecha_numero
    FROM partidos p
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visita_id
    JOIN fechas f ON f.id = p.fecha_id
    WHERE f.torneo_id = ? AND p.estado = 'en_curso'
  `).all(torneo_id);

  // Próximos partidos: encontrar la fecha (jornada) más próxima que tenga partidos pendientes
  const proximaFechaQuery = db.prepare(`
    SELECT f.id as fecha_id
    FROM partidos p
    JOIN fechas f ON f.id = p.fecha_id
    WHERE f.torneo_id = ? AND p.estado = 'pendiente'
    ORDER BY f.numero ASC, p.fecha_hora ASC
    LIMIT 1
  `).get(torneo_id);

  let proximos = [];
  if (proximaFechaQuery) {
    proximos = db.prepare(`
      SELECT p.*,
             el.nombre AS local_nombre, el.escudo_url AS local_escudo,
             ev.nombre AS visita_nombre, ev.escudo_url AS visita_escudo,
             f.numero AS fecha_numero
      FROM partidos p
      JOIN equipos el ON el.id = p.equipo_local_id
      JOIN equipos ev ON ev.id = p.equipo_visita_id
      JOIN fechas f ON f.id = p.fecha_id
      WHERE f.id = ?
      ORDER BY p.fecha_hora ASC
    `).all(proximaFechaQuery.fecha_id);
  }

  // Jugadores sancionados que se pierden la próxima fecha
  const sancionados = db.prepare(`
    SELECT s.*, j.nombre, j.apellido, e.nombre as equipo_nombre, e.escudo_url as equipo_escudo,
           (s.fechas_a_cumplir - s.fechas_cumplidas) as fechas_restantes
    FROM sanciones s
    JOIN jugadores j ON j.id = s.jugador_id
    JOIN equipos e ON e.id = j.equipo_id
    WHERE s.torneo_id = ? AND s.activa = 1
    ORDER BY fechas_restantes ASC, e.nombre ASC
  `).all(torneo_id);

  res.json({ enVivo, proximos, sancionados });
});

// ─────────────────────────────────────────
// GET /api/torneos/:id/tabla
// Tabla de posiciones con desempate completo:
// 1. Puntos  2. Puntos entre sí  3. Dif. goles  4. Goles a favor
// ─────────────────────────────────────────
router.get('/:id/tabla', (req, res) => {
  const torneo_id = req.params.id;

  // Calcular stats de todos los equipos del torneo
  const rows = db.prepare(`
    SELECT
      e.id AS equipo_id,
      e.nombre,
      e.escudo_url,
      COUNT(p.id) + MAX(COALESCE(eb.pj, 0)) AS pj,
      COALESCE(SUM(CASE
        WHEN p.ganador_escritorio = 'local' AND p.equipo_local_id = e.id THEN 1
        WHEN p.ganador_escritorio = 'visita' AND p.equipo_visita_id = e.id THEN 1
        WHEN p.ganador_escritorio IS NULL AND ((p.equipo_local_id = e.id AND p.goles_local > p.goles_visita) OR
             (p.equipo_visita_id = e.id AND p.goles_visita > p.goles_local)) THEN 1 ELSE 0
      END), 0) + MAX(COALESCE(eb.pg, 0)) AS pg,
      COALESCE(SUM(CASE WHEN p.ganador_escritorio IS NULL AND p.goles_local = p.goles_visita THEN 1 ELSE 0 END), 0) + MAX(COALESCE(eb.pe, 0)) AS pe,
      COALESCE(SUM(CASE
        WHEN p.ganador_escritorio = 'local' AND p.equipo_visita_id = e.id THEN 1
        WHEN p.ganador_escritorio = 'visita' AND p.equipo_local_id = e.id THEN 1
        WHEN p.ganador_escritorio IS NULL AND ((p.equipo_local_id = e.id AND p.goles_local < p.goles_visita) OR
             (p.equipo_visita_id = e.id AND p.goles_visita < p.goles_local)) THEN 1 ELSE 0
      END), 0) + MAX(COALESCE(eb.pp, 0)) AS pp,
      COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id THEN p.goles_local ELSE p.goles_visita END), 0) + MAX(COALESCE(eb.gf, 0)) AS gf,
      COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id THEN p.goles_visita ELSE p.goles_local END), 0) + MAX(COALESCE(eb.gc, 0)) AS gc
    FROM equipos e
    JOIN torneo_equipos te ON te.equipo_id = e.id AND te.torneo_id = ?
    LEFT JOIN estadisticas_base eb ON eb.equipo_id = e.id AND eb.torneo_id = ?
    LEFT JOIN partidos p ON (p.equipo_local_id = e.id OR p.equipo_visita_id = e.id)
      AND p.estado = 'finalizado'
      AND p.fecha_id IN (SELECT id FROM fechas WHERE torneo_id = ?)
    GROUP BY e.id
  `).all(torneo_id, torneo_id, torneo_id);

  // Calcular puntos y diferencia de goles
  const tabla = rows.map(r => ({
    ...r,
    puntos: (r.pg * 3) + r.pe,
    dg: r.gf - r.gc
  }));

  // Traer los partidos del torneo para desempate (partidos entre sí)
  const partidos = db.prepare(`
    SELECT p.equipo_local_id, p.equipo_visita_id, p.goles_local, p.goles_visita, p.ganador_escritorio
    FROM partidos p
    JOIN fechas f ON f.id = p.fecha_id
    WHERE f.torneo_id = ? AND p.estado = 'finalizado'
  `).all(torneo_id);

  const tablaOrdenada = ordenarTabla(tabla, partidos);
  res.json(tablaOrdenada);
});

// ─────────────────────────────────────────
// GET /api/torneos/:id/goleadores
// ─────────────────────────────────────────
router.get('/:id/goleadores', (req, res) => {
  const goleadores = db.prepare(`
    SELECT 
      j.id, j.nombre, j.apellido, j.numero_camiseta,
      e.nombre AS equipo_nombre, e.escudo_url,
      COUNT(ep.id) AS goles
    FROM eventos_partido ep
    JOIN jugadores j ON j.id = ep.jugador_id
    JOIN equipos e ON e.id = j.equipo_id
    JOIN partidos p ON p.id = ep.partido_id
    JOIN fechas f ON f.id = p.fecha_id
    WHERE f.torneo_id = ? AND ep.tipo IN ('GOL', 'GOL_PENAL')
    GROUP BY j.id
    ORDER BY goles DESC, j.apellido ASC
    LIMIT 30
  `).all(req.params.id);
  res.json(goleadores);
});

// ─────────────────────────────────────────
// GET /api/torneos/:id/expulsados
// Jugadores con tarjeta roja en el torneo
// ─────────────────────────────────────────
router.get('/:id/expulsados', (req, res) => {
  const expulsados = db.prepare(`
    SELECT 
      j.id, j.nombre, j.apellido,
      e.nombre AS equipo_nombre, e.escudo_url,
      COUNT(*) AS cantidad_rojas,
      GROUP_CONCAT(p.fecha_hora) AS en_partidos
    FROM eventos_partido ep
    JOIN jugadores j ON j.id = ep.jugador_id
    JOIN equipos e ON e.id = j.equipo_id
    JOIN partidos p ON p.id = ep.partido_id
    JOIN fechas f ON f.id = p.fecha_id
    WHERE f.torneo_id = ? AND ep.tipo = 'ROJA'
    GROUP BY j.id
    ORDER BY cantidad_rojas DESC
  `).all(req.params.id);
  res.json(expulsados);
});

// ─────────────────────────────────────────
// GET /api/torneos/:id/sancionados
// Jugadores con fechas pendientes de cumplir
// ─────────────────────────────────────────
router.get('/:id/sancionados', (req, res) => {
  const sancionados = db.prepare(`
    SELECT 
      j.id, j.nombre, j.apellido,
      e.nombre AS equipo_nombre, e.escudo_url,
      s.fechas_a_cumplir,
      s.fechas_cumplidas,
      (s.fechas_a_cumplir - s.fechas_cumplidas) AS fechas_restantes,
      s.motivo
    FROM sanciones s
    JOIN jugadores j ON j.id = s.jugador_id
    JOIN equipos e ON e.id = j.equipo_id
    WHERE s.torneo_id = ? AND s.activa = 1
    ORDER BY fechas_restantes DESC, j.apellido ASC
  `).all(req.params.id);
  res.json(sancionados);
});

// ─────────────────────────────────────────
// GET /api/torneos/:id/fechas
// Listado de fechas del torneo
// ─────────────────────────────────────────
router.get('/:id/fechas', (req, res) => {
  const fechas = db.prepare(`
    SELECT f.*, COUNT(p.id) AS cantidad_partidos
    FROM fechas f
    LEFT JOIN partidos p ON p.fecha_id = f.id
    WHERE f.torneo_id = ?
    GROUP BY f.id
    ORDER BY f.numero ASC
  `).all(req.params.id);
  res.json(fechas);
});

// ─────────────────────────────────────────
// POST /api/torneos/:id/simular-tabla
// Recibe una lista de resultados modificados y calcula la tabla sin guardar en DB
// Body: { resultados: [{ partido_id, goles_local, goles_visita }, ...] }
// ─────────────────────────────────────────
router.post('/:id/simular-tabla', (req, res) => {
  const torneo_id = req.params.id;
  const { resultados = [] } = req.body;

  // Cargar todos los partidos finalizados + pendientes del torneo
  const partidos = db.prepare(`
    SELECT p.*, f.torneo_id
    FROM partidos p
    JOIN fechas f ON f.id = p.fecha_id
    WHERE f.torneo_id = ?
  `).all(torneo_id);

  // Obtener equipos del torneo y sus estadisticas base
  const equipos = db.prepare(`
    SELECT e.id, e.nombre, e.escudo_url,
           COALESCE(eb.pj, 0) AS base_pj, COALESCE(eb.pg, 0) AS base_pg, 
           COALESCE(eb.pe, 0) AS base_pe, COALESCE(eb.pp, 0) AS base_pp,
           COALESCE(eb.gf, 0) AS base_gf, COALESCE(eb.gc, 0) AS base_gc
    FROM equipos e
    JOIN torneo_equipos te ON te.equipo_id = e.id
    LEFT JOIN estadisticas_base eb ON eb.equipo_id = e.id AND eb.torneo_id = te.torneo_id
    WHERE te.torneo_id = ?
  `).all(torneo_id);

  // Inicializar stats
  const stats = {};
  equipos.forEach(e => {
    stats[e.id] = {
      equipo_id: e.id, nombre: e.nombre, escudo_url: e.escudo_url,
      pj: e.base_pj, pg: e.base_pg, pe: e.base_pe, pp: e.base_pp, 
      gf: e.base_gf, gc: e.base_gc, puntos: 0, dg: 0
    };
  });

  // Aplicar resultados: usar los simulados si existen, sino el resultado real
  const overrides = {};
  resultados.forEach(r => {
    overrides[r.partido_id] = { gl: r.goles_local, gv: r.goles_visita };
  });

  const partidosResueltos = [];

  partidos.forEach(p => {
    let gl, gv;
    if (overrides[p.id]) {
      gl = overrides[p.id].gl;
      gv = overrides[p.id].gv;
    } else if (p.estado === 'finalizado') {
      gl = p.goles_local;
      gv = p.goles_visita;
    } else {
      return; // Partido sin resultado y sin simulación: no contar
    }

    const isOverride = !!overrides[p.id];

    partidosResueltos.push({
      equipo_local_id: p.equipo_local_id,
      equipo_visita_id: p.equipo_visita_id,
      goles_local: gl,
      goles_visita: gv,
      ganador_escritorio: isOverride ? null : p.ganador_escritorio
    });

    const local = stats[p.equipo_local_id];
    const visita = stats[p.equipo_visita_id];
    if (!local || !visita) return;

    local.pj++; visita.pj++;
    local.gf += gl; local.gc += gv;
    visita.gf += gv; visita.gc += gl;

    const win_escritorio = isOverride ? null : p.ganador_escritorio;
    if (win_escritorio === 'local') {
      local.pg++; visita.pp++;
    } else if (win_escritorio === 'visita') {
      visita.pg++; local.pp++;
    } else {
      if (gl > gv) { local.pg++; visita.pp++; }
      else if (gl < gv) { visita.pg++; local.pp++; }
      else { local.pe++; visita.pe++; }
    }
  });

  // Calcular puntos
  const tabla = Object.values(stats).map(e => ({
    ...e,
    puntos: (e.pg * 3) + e.pe,
    dg: e.gf - e.gc
  }));

  const tablaOrdenada = ordenarTabla(tabla, partidosResueltos);
  res.json(tablaOrdenada);
});

// ADMIN: POST /api/torneos - Crear torneo
router.post('/', authMiddleware, soloAdmin, (req, res) => {
  const { nombre, tipo, temporada } = req.body;
  if (!nombre || !tipo || !temporada) return res.status(400).json({ error: 'Datos incompletos' });

  const result = db.prepare(
    'INSERT INTO torneos (nombre, tipo, temporada) VALUES (?, ?, ?)'
  ).run(nombre, tipo, temporada);

  res.status(201).json({ id: result.lastInsertRowid, nombre, tipo, temporada });
});

// ADMIN: POST /api/torneos/:id/equipos - Inscribir equipo al torneo
router.post('/:id/equipos', authMiddleware, soloAdmin, (req, res) => {
  const { equipo_id, grupo } = req.body;
  db.prepare(
    'INSERT OR IGNORE INTO torneo_equipos (torneo_id, equipo_id, grupo) VALUES (?, ?, ?)'
  ).run(req.params.id, equipo_id, grupo || null);
  res.status(201).json({ ok: true });
});

// ─────────────────────────────────────────
// ADMIN: POST /api/torneos/historico
// Carga un torneo histórico completo con equipos y partidos
// Body: { nombre, temporada, tipo, partidos: [{ local, visita, goles_local, goles_visita }] }
// ─────────────────────────────────────────
router.post('/historico', authMiddleware, soloAdmin, (req, res) => {
  const { nombre, temporada, tipo = 'liga', partidos = [] } = req.body;
  if (!nombre || !temporada) return res.status(400).json({ error: 'Nombre y temporada son requeridos' });

  const insertTodo = db.transaction(() => {
    // 1. Crear el torneo
    const torneoResult = db.prepare(
      'INSERT INTO torneos (nombre, tipo, temporada) VALUES (?, ?, ?)'
    ).run(nombre, tipo, temporada);
    const torneo_id = torneoResult.lastInsertRowid;

    // 2. Crear una sola fecha para el torneo histórico
    const fechaResult = db.prepare(
      'INSERT INTO fechas (torneo_id, numero, estado) VALUES (?, 1, ?)'
    ).run(torneo_id, 'cerrada');
    const fecha_id = fechaResult.lastInsertRowid;

    // 3. Procesar equipos únicos del listado de partidos
    const equiposNombres = new Set();
    partidos.forEach(p => {
      if (p.local?.trim()) equiposNombres.add(p.local.trim());
      if (p.visita?.trim()) equiposNombres.add(p.visita.trim());
    });

    const equipoIdPorNombre = {};
    for (const nombre_eq of equiposNombres) {
      // Buscar si ya existe el equipo
      let equipo = db.prepare('SELECT id FROM equipos WHERE nombre = ?').get(nombre_eq);
      if (!equipo) {
        const r = db.prepare('INSERT INTO equipos (nombre) VALUES (?)').run(nombre_eq);
        equipo = { id: r.lastInsertRowid };
      }
      equipoIdPorNombre[nombre_eq] = equipo.id;
      // Inscribir en el torneo
      db.prepare('INSERT OR IGNORE INTO torneo_equipos (torneo_id, equipo_id) VALUES (?, ?)')
        .run(torneo_id, equipo.id);
    }

    // 4. Insertar los partidos como finalizados
    let insertados = 0;
    for (const p of partidos) {
      if (!p.local?.trim() || !p.visita?.trim()) continue;
      const gl = parseInt(p.goles_local, 10);
      const gv = parseInt(p.goles_visita, 10);
      if (isNaN(gl) || isNaN(gv)) continue;

      db.prepare(`
        INSERT INTO partidos (fecha_id, equipo_local_id, equipo_visita_id, goles_local, goles_visita, estado)
        VALUES (?, ?, ?, ?, ?, 'finalizado')
      `).run(fecha_id, equipoIdPorNombre[p.local.trim()], equipoIdPorNombre[p.visita.trim()], gl, gv);
      insertados++;
    }

    return { torneo_id, equipos: equiposNombres.size, partidos: insertados };
  });

  try {
    const result = insertTodo();
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
