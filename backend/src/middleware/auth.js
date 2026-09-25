const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'prode_liga_nicoleña_secret_2025';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload; // { id, usuario, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

function adminOReportero(req, res, next) {
  if (!['admin', 'reportero'].includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Acceso restringido a administradores o reporteros' });
  }
  next();
}

module.exports = { authMiddleware, soloAdmin, adminOReportero };
