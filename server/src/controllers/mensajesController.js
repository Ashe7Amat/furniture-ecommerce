const supabase = require('../data/supabase');

// Panel "Mensajes": los mensajes del formulario de contacto guardados en mensajes_contacto (ver
// contactoController.js). Solo para administradores (verificarAdmin en adminRoutes.js).
// La tabla se crea con server/migrations/20261005002322_create_mensajes_contacto.sql (aplicada el
// 5 oct 2026).

const COLUMNAS_MENSAJE = 'id, nombre, email, mensaje, leido, created_at';
// Los más recientes primero, y un tope para que la lista no crezca sin fin en una sola respuesta.
const MAX_MENSAJES = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/mensajes
const obtenerMensajes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('mensajes_contacto')
      .select(COLUMNAS_MENSAJE)
      .order('created_at', { ascending: false })
      .limit(MAX_MENSAJES);
    if (error) throw error;

    res.set('Cache-Control', 'private, no-store');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener los mensajes de contacto:', error.message);
    res.status(500).json({ error: 'Error al obtener los mensajes.' });
  }
};

// PATCH /api/admin/mensajes/:id/leido -- marca el mensaje como leído. Con { "leido": false } en el
// cuerpo, lo vuelve a dejar como no leído.
const marcarLeido = async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return res.status(400).json({ error: 'Id de mensaje no válido.' });
  const leido = req.body?.leido === false ? false : true;

  try {
    const { data, error } = await supabase
      .from('mensajes_contacto')
      .update({ leido })
      .eq('id', id)
      .select(COLUMNAS_MENSAJE);
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado.' });
    }
    res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error al marcar el mensaje como leído:', error.message);
    res.status(500).json({ error: 'Error al actualizar el mensaje.' });
  }
};

module.exports = { obtenerMensajes, marcarLeido, MAX_MENSAJES };
