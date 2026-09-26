const db = require('better-sqlite3')('prode.db');
const fetch = require('node:http');

// Let's just write a test script that directly calls the logic of simular-tabla
const torneo_id = 2; // the active one

const equipos = db.prepare(`
SELECT e.id, e.nombre, e.escudo_url,
       COALESCE(eb.pj, 0) AS eb_pj, COALESCE(eb.pg, 0) AS eb_pg,
       COALESCE(eb.pe, 0) AS eb_pe, COALESCE(eb.pp, 0) AS eb_pp,
       COALESCE(eb.gf, 0) AS eb_gf, COALESCE(eb.gc, 0) AS eb_gc
FROM equipos e
JOIN torneo_equipos te ON te.equipo_id = e.id
LEFT JOIN estadisticas_base eb ON eb.equipo_id = e.id AND eb.torneo_id = te.torneo_id
WHERE te.torneo_id = ?
`).all(torneo_id);

const partidos = db.prepare(`
SELECT p.*, f.torneo_id
FROM partidos p
JOIN fechas f ON f.id = p.fecha_id
WHERE f.torneo_id = ?
`).all(torneo_id);

const stats = {};
equipos.forEach(e => {
stats[e.id] = {
  equipo_id: e.id, nombre: e.nombre, escudo_url: e.escudo_url,
  pj: e.eb_pj, pg: e.eb_pg, pe: e.eb_pe, pp: e.eb_pp, gf: e.eb_gf, gc: e.eb_gc, puntos: 0, dg: 0
};
});

const overrides = {};
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
  return;
}

partidosResueltos.push({
  equipo_local_id: p.equipo_local_id,
  equipo_visita_id: p.equipo_visita_id,
  goles_local: gl,
  goles_visita: gv
});

const local = stats[p.equipo_local_id];
const visita = stats[p.equipo_visita_id];
if (!local || !visita) return;

local.pj++; visita.pj++;
local.gf += gl; local.gc += gv;
visita.gf += gv; visita.gc += gl;

if (gl > gv) { local.pg++; visita.pp++; }
else if (gl < gv) { visita.pg++; local.pp++; }
else { local.pe++; visita.pe++; }
});

const tabla = Object.values(stats).map(e => ({
...e,
puntos: (e.pg * 3) + e.pe,
dg: e.gf - e.gc
}));

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
      const gl = p.goles_local;
      const gv = p.goles_visita;
      if (gl > gv) miniTablaPts[p.equipo_local_id] += 3;
      else if (gl < gv) miniTablaPts[p.equipo_visita_id] += 3;
      else { miniTablaPts[p.equipo_local_id] += 1; miniTablaPts[p.equipo_visita_id] += 1; }
    }
  });
  grupo.sort((a, b) => {
    const ptsA = miniTablaPts[a.equipo_id];
    const ptsB = miniTablaPts[b.equipo_id];
    if (ptsA !== ptsB) return ptsB - ptsA;
    if (a.dg !== b.dg) return b.dg - a.dg;
    if (a.gf !== b.gf) return b.gf - a.gf;
    return a.nombre.localeCompare(b.nombre);
  });
  tablaOrdenada.push(...grupo);
}
}
tablaOrdenada.forEach((eq, idx) => eq.posicion = idx + 1);
return tablaOrdenada;
}

const res = ordenarTabla(tabla, partidosResueltos);
console.table(res.map(r => ({ pos: r.posicion, equipo: r.nombre, pts: r.puntos })));

// Let's do the exact same logic but via the GET /tabla endpoint logic
const rows = db.prepare(`
SELECT
  e.id AS equipo_id, e.nombre, e.escudo_url,
  COUNT(p.id) + MAX(COALESCE(eb.pj, 0)) AS pj,
  COALESCE(SUM(CASE WHEN (p.equipo_local_id = e.id AND p.goles_local > p.goles_visita) OR (p.equipo_visita_id = e.id AND p.goles_visita > p.goles_local) THEN 1 ELSE 0 END), 0) + MAX(COALESCE(eb.pg, 0)) AS pg,
  COALESCE(SUM(CASE WHEN p.goles_local = p.goles_visita THEN 1 ELSE 0 END), 0) + MAX(COALESCE(eb.pe, 0)) AS pe,
  COALESCE(SUM(CASE WHEN (p.equipo_local_id = e.id AND p.goles_local < p.goles_visita) OR (p.equipo_visita_id = e.id AND p.goles_visita < p.goles_local) THEN 1 ELSE 0 END), 0) + MAX(COALESCE(eb.pp, 0)) AS pp,
  COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id THEN p.goles_local ELSE p.goles_visita END), 0) + MAX(COALESCE(eb.gf, 0)) AS gf,
  COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id THEN p.goles_visita ELSE p.goles_local END), 0) + MAX(COALESCE(eb.gc, 0)) AS gc
FROM equipos e
JOIN torneo_equipos te ON te.equipo_id = e.id AND te.torneo_id = ?
LEFT JOIN estadisticas_base eb ON eb.equipo_id = e.id AND eb.torneo_id = ?
LEFT JOIN partidos p ON (p.equipo_local_id = e.id OR p.equipo_visita_id = e.id) AND p.estado = 'finalizado' AND p.fecha_id IN (SELECT id FROM fechas WHERE torneo_id = ?)
GROUP BY e.id
`).all(torneo_id, torneo_id, torneo_id);
const tabla2 = rows.map(r => ({ ...r, puntos: (r.pg * 3) + r.pe, dg: r.gf - r.gc }));
const partidos2 = db.prepare(`SELECT p.equipo_local_id, p.equipo_visita_id, p.goles_local, p.goles_visita FROM partidos p JOIN fechas f ON f.id = p.fecha_id WHERE f.torneo_id = ? AND p.estado = 'finalizado'`).all(torneo_id);
const res2 = ordenarTabla(tabla2, partidos2);

let match = true;
for (let i = 0; i < res.length; i++) {
  if (res[i].equipo !== res2[i].nombre) match = false;
}
console.log('Matches GET /tabla exactly?', match);
if (!match) {
  console.table(res2.map(r => ({ pos: r.posicion, equipo: r.nombre, pts: r.puntos })));
}