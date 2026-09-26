const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'prode_liga_nicoleña_secret_2025';

// ─────────────────────────────────────────
// POST /api/auth/registro
// ─────────────────────────────────────────
router.post('/registro', (req, res) => {
  const { nombre, apellido, email, usuario, password, fecha_nacimiento, equipo_id } = req.body;

  if (!nombre || !apellido || !email || !usuario || !password || !fecha_nacimiento) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  // Verificar unicidad
  const emailExiste  = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  const userExiste   = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario);

  if (emailExiste)  return res.status(409).json({ error: 'El email ya está registrado' });
  if (userExiste)   return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });

  const hash = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO usuarios (nombre, apellido, email, usuario, password_hash, fecha_nacimiento, equipo_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, apellido, email, usuario, hash, fecha_nacimiento, equipo_id || null);

  const token = jwt.sign(
    { id: result.lastInsertRowid, usuario, rol: 'usuario' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.status(201).json({
    mensaje: 'Usuario registrado correctamente',
    token,
    usuario: { id: result.lastInsertRowid, nombre, apellido, usuario, rol: 'usuario' }
  });
});

// ─────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────
router.post('/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    usuario: {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      usuario: user.usuario,
      email: user.email,
      rol: user.rol,
      equipo_id: user.equipo_id,
      avatar_url: user.avatar_url
    }
  });
});

module.exports = router;
