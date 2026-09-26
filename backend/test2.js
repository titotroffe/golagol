const db = require('better-sqlite3')('prode.db');
const torneo_id = 2; 

const equipos = db.prepare(`SELECT e.id, e.nombre, e.escudo_url FROM equipos e JOIN torneo_equipos te ON te.equipo_id = e.id WHERE te.torneo_id = ?`).all(torneo_id);
const partidos = db.prepare(`SELECT p.*, f.torneo_id FROM partidos p JOIN fechas f ON f.id = p.fecha_id WHERE f.torneo_id = ?`).all(torneo_id);

const stats = {};
equipos.forEach(e => {
stats[e.id] = {
  equipo_id: e.id, nombre: e.nombre, escudo_url: e.escudo_url,
  pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, puntos: 0, dg: 0
};
});

// Simulate a tie between Equipo 6 and Equipo 15 (San Martin vs Matienzo is id 32)
// Let's say San Martin beats Matienzo 1-0.
// So San Martin gets 3 pts, Matienzo 0 pts.
// Wait, we want a tie. Let's have a 3-way tie!
// 6 beats 15 (id 32)
// 15 beats 16 (let's find their match)
const overrides = {};
const p6_15 = partidos.find(p => (p.equipo_local_id == 6 && p.equipo_visita_id == 15) || (p.equipo_local_id == 15 && p.equipo_visita_id == 6));
if(p6_15) {
  if (p6_15.equipo_local_id == 6) overrides[p6_15.id] = { gl: 1, gv: 0 };
  else overrides[p6_15.id] = { gl: 0, gv: 1 };
}

// 6 vs 16 (Somisa vs San Martin)
const p6_16 = partidos.find(p => (p.equipo_local_id == 6 && p.equipo_visita_id == 16) || (p.equipo_local_id == 16 && p.equipo_visita_id == 6));
if(p6_16) {
  // 16 beats 6
  if (p6_16.equipo_local_id == 16) overrides[p6_16.id] = { gl: 1, gv: 0 };
  else overrides[p6_16.id] = { gl: 0, gv: 1 };
}

// 15 vs 16 (Matienzo vs Somisa)
const p15_16 = partidos.find(p => (p.equipo_local_id == 15 && p.equipo_visita_id == 16) || (p.equipo_local_id == 16 && p.equipo_visita_id == 15));
if(p15_16) {
  // 15 beats 16
  if (p15_16.equipo_local_id == 15) overrides[p15_16.id] = { gl: 1, gv: 0 };
  else overrides[p15_16.id] = { gl: 0, gv: 1 };
}

console.log('Overrides:', overrides);

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
console.table(res.filter(r => r.puntos > 0).map(r => ({ pos: r.posicion, equipo: r.nombre, pts: r.puntos })));