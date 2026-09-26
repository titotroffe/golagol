const express = require('express');
const http = require('http');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');

// Rutas
const authRoutes    = require('./routes/auth');
const equiposRoutes = require('./routes/equipos');
const torneosRoutes = require('./routes/torneos');
const partidosRoutes = require('./routes/partidos');
const prodeRoutes   = require('./routes/prode');
const jugadoresRoutes = require('./routes/jugadores');

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────
// MIDDLEWARES
// ─────────────────────────────────────────
app.use(cors({
  origin: '*', // En producción restringir al dominio real
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// ─────────────────────────────────────────
// WEBSOCKET SERVER (mismo puerto que HTTP)
// ─────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Hacer broadcast disponible globalmente para las rutas
app.locals.broadcast = broadcast;

wss.on('connection', (ws) => {
  console.log(`📡 Cliente WS conectado. Total: ${wss.clients.size}`);

  ws.on('close', () => {
    console.log(`📡 Cliente WS desconectado. Total: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
  });
});

const usuariosRoutes = require('./routes/usuarios');
const sancionesRoutes = require('./routes/sanciones');

// Servir archivos estaticos para avatares
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─────────────────────────────────────────
// RUTAS API
// ─────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/equipos',  equiposRoutes);
app.use('/api/torneos',  torneosRoutes);
app.use('/api/partidos', partidosRoutes);
app.use('/api/prode',    prodeRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/sanciones', sancionesRoutes);
app.use('/api/jugadores', jugadoresRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'Prode Liga Nicoleña - API funcionando',
    clientes_ws: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────
// ARRANCAR SERVIDOR
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 Servidor Prode corriendo en puerto ${PORT}`);
  console.log(`🔗 REST API: http://localhost:${PORT}/api`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
  console.log('==============================================');
});
