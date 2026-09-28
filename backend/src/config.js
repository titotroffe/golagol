// Configuración centralizada del servidor
// Todos los módulos deben importar JWT_SECRET desde aquí
// para garantizar que siempre se use la misma clave

const JWT_SECRET = process.env.JWT_SECRET || 'prode_liga_nicoleña_secret_2025';

module.exports = { JWT_SECRET };
