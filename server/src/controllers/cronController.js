const crypto = require('crypto');
const { reservasActivas } = require('../utils/reservas');
const { ejecutarTareaDiaria } = require('../utils/tareaDiariaReservas');

// GET /api/cron/reservas -- la tarea diaria de las reservas (docs/reservas-diseno.md, 8.5), que lanza
// Vercel Cron (server/vercel.json). Vercel manda la cabecera Authorization: Bearer <CRON_SECRET> si esa
// variable está puesta en el proyecto; nadie más la conoce.
//   404 con el interruptor RESERVAS_ACTIVAS apagado (como si no existiera; no mira nada más)
//   503 sin CRON_SECRET en el servidor (fallo de configuración: no se deja abierta)
//   401 sin la cabecera o con otro secreto
//   500 si falla la lectura de la base de datos (mañana se vuelve a intentar)
//   200 con el resumen de lo hecho, sin datos personales
const mismoSecreto = (recibido, esperado) => {
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const tareaDiariaReservas = async (req, res) => {
  if (!reservasActivas()) return res.status(404).json({ error: 'Ruta no encontrada.' });

  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error(
      'Tarea diaria de reservas: falta CRON_SECRET en las variables de entorno del servidor.'
    );
    return res.status(503).json({ error: 'La tarea diaria no está configurada.' });
  }
  if (!mismoSecreto(req.headers.authorization ?? '', `Bearer ${secreto}`)) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const resumen = await ejecutarTareaDiaria();
    console.log('Tarea diaria de reservas:', JSON.stringify(resumen));
    return res.status(200).json(resumen);
  } catch (error) {
    console.error('Tarea diaria de reservas: error al leer las reservas:', error.message || error);
    return res.status(500).json({ error: 'Error al ejecutar la tarea diaria.' });
  }
};

module.exports = { tareaDiariaReservas };
