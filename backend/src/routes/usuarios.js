const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ----------------------------------------
// MULTER CONFIG
// ----------------------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.usuario.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Formato no válido'));
  }
});

// ----------------------------------------
// GET /api/usuarios/perfil
// ----------------------------------------
router.get('/perfil', authMiddleware, (req, res) => {
  const userId = req.usuario.id;
  const user = db.prepare(`
    SELECT u.id, u.nombre, u.apellido, u.email, u.usuario, u.fecha_nacimiento, u.rol, u.avatar_url, 
           e.id as equipo_id, e.nombre as equipo_nombre, e.escudo_url as equipo_escudo
    FROM usuarios u
    LEFT JOIN equipos e ON u.equipo_id = e.id
    WHERE u.id = ?
  `).get(userId);

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// ----------------------------------------
// PUT /api/usuarios/perfil
// ----------------------------------------
router.put('/perfil', authMiddleware, (req, res) => {
  const userId = req.usuario.id;
  const { nombre, apellido, email, equipo_id, fecha_nacimiento } = req.body;

  if (!nombre || !apellido || !email) {
    return res.status(400).json({ error: 'Nombre, apellido y email son requeridos' });
  }

  // Check si el email ya existe en otro usuario
  const emailExiste = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, userId);
  if (emailExiste) return res.status(409).json({ error: 'El email ya está en uso por otro usuario' });

  db.prepare(`
    UPDATE usuarios 
    SET nombre = ?, apellido = ?, email = ?, equipo_id = ?, fecha_nacimiento = ?
    WHERE id = ?
  `).run(nombre, apellido, email, equipo_id || null, fecha_nacimiento, userId);

  res.json({ mensaje: 'Perfil actualizado correctamente' });
});

// ----------------------------------------
// PUT /api/usuarios/perfil/password
// ----------------------------------------
router.put('/perfil/password', authMiddleware, (req, res) => {
  const userId = req.usuario.id;
  const { currentPassword, newPassword } = req.body;

  const user = db.prepare('SELECT password_hash FROM usuarios WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, userId);

  res.json({ mensaje: 'Contraseña actualizada correctamente' });
});

// ----------------------------------------
// POST /api/usuarios/perfil/avatar
// ----------------------------------------
router.post('/perfil/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  
  const userId = req.usuario.id;
  // Construir URL pública (asumiendo que el server corre en la raiz o que lo sirve via express.static)
  // ej: /uploads/avatars/filename.jpg
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  db.prepare('UPDATE usuarios SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);

  res.json({ mensaje: 'Avatar actualizado correctamente', avatar_url: avatarUrl });
});

module.exports = router;
