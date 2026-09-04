// server/src/controllers/pedidosController.js
//
// Panel de administración: consulta y gestión de los pedidos generados por el checkout
// (ver procesarCompra() en mueblesController.js, que es quien los crea).
const supabase = require('../data/supabase');

const ESTADOS_VALIDOS = ['procesando', 'enviado', 'entregado', 'cancelado'];

// 0. Listar los pedidos del cliente logueado (para su "Historial de Pedidos" en Mi Cuenta).
//    El checkout es de invitado y no guarda un user_id, así que se identifican por el email
//    con el que compró, comparado con el email de la cuenta logueada.
const obtenerMisPedidos = async (req, res) => {
  try {
    const email = req.usuario?.email;
    if (!email) {
      return res.status(401).json({ error: 'No has iniciado sesión.' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .ilike('cliente_info->>email', email)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener mis pedidos:', error.message);
    res.status(500).json({ error: 'Error interno al obtener tus pedidos.' });
  }
};

// 1. Listar todos los pedidos, más recientes primero. Solo administradores.
const obtenerPedidos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener pedidos:', error.message);
    res.status(500).json({ error: 'Error interno al obtener los pedidos.' });
  }
};

// 2. Cambiar el estado de un pedido (p. ej. al prepararlo o enviarlo). Solo administradores.
const actualizarEstadoPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Usa uno de: ${ESTADOS_VALIDOS.join(', ')}.` });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Error al actualizar el estado del pedido:', error.message);
    res.status(500).json({ error: 'Error interno al actualizar el pedido.' });
  }
};

module.exports = { obtenerMisPedidos, obtenerPedidos, actualizarEstadoPedido };
