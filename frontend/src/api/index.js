const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;
}

// ── AUTH ──────────────────────────────────────────────
export const authApi = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  registro: (body) => request('/auth/registro', { method: 'POST', body: JSON.stringify(body) }),
};

// ── EQUIPOS ───────────────────────────────────────────
export const equiposApi = {
  listar: () => request('/equipos'),
  detalle: (id) => request(`/equipos/${id}`),
  plantel: (id) => request(`/equipos/${id}/plantel`),
  agregarJugador: (id, body) => request(`/equipos/${id}/jugadores`, { method: 'POST', body: JSON.stringify(body) }),
  stats: (id, torneoId) => request(`/equipos/${id}/estadisticas/${torneoId}`),
  proximosPartidos: (id) => request(`/equipos/${id}/proximos-partidos`),
  ultimosPartidos: (id) => request(`/equipos/${id}/ultimos-partidos`),
};

// ── TORNEOS ───────────────────────────────────────────
export const torneosApi = {
  listar: () => request('/torneos'),
  detalle: (id) => request(`/torneos/${id}`),
  tabla: (id) => request(`/torneos/${id}/tabla`),
  goleadores: (id) => request(`/torneos/${id}/goleadores`),
  expulsados: (id) => request(`/torneos/${id}/expulsados`),
  sancionados: (id) => request(`/torneos/${id}/sancionados`),
  fechas: (id) => request(`/torneos/${id}/fechas`),
  simularTabla: (id, resultados) =>
    request(`/torneos/${id}/simular-tabla`, { method: 'POST', body: JSON.stringify({ resultados }) }),
  cargarHistorico: (body) =>
    request('/torneos/historico', { method: 'POST', body: JSON.stringify(body) }),
};

// ── PARTIDOS ──────────────────────────────────────────
export const partidosApi = {
  detalle: (id) => request(`/partidos/${id}`),
  porFecha: (fechaId) => request(`/partidos/fecha/${fechaId}`),
  registrarEvento: (id, body) =>
    request(`/partidos/${id}/evento`, { method: 'POST', body: JSON.stringify(body) }),
  eliminarEvento: (id, eventoId) =>
    request(`/partidos/${id}/evento/${eventoId}`, { method: 'DELETE' }),
  cargarResultado: (id, body) =>
    request(`/partidos/${id}/resultado`, { method: 'PUT', body: JSON.stringify(body) }),
  alineaciones: (id) => request(`/partidos/${id}/alineaciones`),
  agregarAlineacion: (id, body) =>
    request(`/partidos/${id}/alineaciones`, { method: 'POST', body: JSON.stringify(body) }),
  eliminarAlineacion: (id, jugadorId) =>
    request(`/partidos/${id}/alineaciones/${jugadorId}`, { method: 'DELETE' }),
};

// ── PRODE ─────────────────────────────────────────────
export const prodeApi = {
  miPronostico: (partidoId) => request(`/prode/partido/${partidoId}`),
  guardarPronostico: (partidoId, body) =>
    request(`/prode/partido/${partidoId}`, { method: 'POST', body: JSON.stringify(body) }),
  misPuntos: (torneoId) => request(`/prode/mis-puntos/${torneoId}`),
  ranking: (torneoId) => request(`/prode/ranking/${torneoId}`),
  crearGrupo: (body) => request('/prode/grupos', { method: 'POST', body: JSON.stringify(body) }),
  unirseGrupo: (codigo) =>
    request('/prode/grupos/unirse', { method: 'POST', body: JSON.stringify({ codigo }) }),
  misGrupos: () => request('/prode/grupos/mis-grupos'),
  rankingGrupo: (grupoId) => request(`/prode/grupos/${grupoId}/ranking`),
};
