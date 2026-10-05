// server/src/controllers/pedidosController.js
//
// Panel de administración: consulta y gestión de los pedidos generados por el checkout
// (ver procesarSesionPagada() en utils/pagos.js, que es quien los crea).
const supabase = require('../data/supabase');
const { escaparIlike } = require('../utils/ilike');

// 0. Listar los pedidos del cliente logueado (para su "Historial de Pedidos" en Mi Cuenta).
//    El checkout es de invitado y no guarda un user_id, así que se identifican por el email
//    con el que compró, comparado con el email de la cuenta logueada. ILIKE para no distinguir
//    mayúsculas, pero con el email ESCAPADO: sin escapar, un "_" del email hacía de comodín y una
//    cuenta "j_an@x.com" veía los pedidos de "juan@x.com" (H17).
// H36: solo las columnas que enseña "Mis pedidos" (Profile.jsx). Antes, select('*'): cualquier
// columna interna que se añadiera a `pedidos` habría salido al cliente sin que nadie lo decidiera.
// Nunca cliente_info (sus datos de entrega ya los conoce, y ahí podría acabar algo interno),
// stripe_session_id ni cliente_id.
const COLUMNAS_MIS_PEDIDOS = 'id, created_at, estado, total, items';

const obtenerMisPedidos = async (req, res) => {
  try {
    const email = req.usuario?.email;
    if (!email) {
      return res.status(401).json({ error: 'No has iniciado sesión.' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select(COLUMNAS_MIS_PEDIDOS)
      .ilike('cliente_info->>email', escaparIlike(email))
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener mis pedidos:', error.message);
    res.status(500).json({ error: 'Error interno al obtener tus pedidos.' });
  }
};

// 1. Listar los pedidos para el panel, más recientes primero, por páginas. Solo administradores.
//    H37: antes devolvía toda la historia en cada carga. Ahora `page`, `limit` (20 por defecto, como
//    mucho 100) y un `estado` opcional, ya validados en schemas/pedidos.js. Junto a la página van
//    el total (con el filtro) y los pendientes ("procesando", sin filtro): la insignia de la barra
//    lateral y el Resumen los necesitan de toda la historia, no solo de la página que se ve.
//    Columnas: las que enseña la pestaña Pedidos (PedidosTab.jsx), no select('*') (H36).
const COLUMNAS_PEDIDOS_PANEL =
  'id, created_at, estado, total, items, cliente_info, direccion_envio';

const obtenerPedidos = async (req, res) => {
  try {
    const { page, limit, estado } = req.query;
    const desde = (page - 1) * limit;

    let consulta = supabase
      .from('pedidos')
      .select(COLUMNAS_PEDIDOS_PANEL, { count: 'exact' })
      .order('created_at', { ascending: false });
    if (estado) consulta = consulta.eq('estado', estado);
    const { data, error, count } = await consulta.range(desde, desde + limit - 1);
    if (error) throw error;

    const { count: pendientes, error: errorPendientes } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'procesando');
    if (errorPendientes) throw errorPendientes;

    const total = count ?? 0;
    res.status(200).json({
      pedidos: data || [],
      total,
      pagina: page,
      porPagina: limit,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
      pendientes: pendientes ?? 0
    });
  } catch (error) {
    console.error('Error al obtener pedidos:', error.message);
    res.status(500).json({ error: 'Error interno al obtener los pedidos.' });
  }
};

// 2. Cambiar el estado de un pedido (p. ej. al prepararlo o enviarlo). Solo administradores.
// El valor de "estado" ya viene validado contra la lista de estados válidos (ver
// schemas/pedidos.js) antes de llegar aquí.
const actualizarEstadoPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

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
