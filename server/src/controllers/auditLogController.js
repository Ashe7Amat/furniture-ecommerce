// server/src/controllers/auditLogController.js
const supabase = require('../data/supabase');

/**
 * Normaliza las entidades para soportar singular y plural en filtros.
 */
const mapeoEntidades = {
  mueble: ['muebles', 'mueble'],
  muebles: ['muebles', 'mueble'],
  categoria: ['categorias', 'categoria'],
  categorias: ['categorias', 'categoria'],
  pedido: ['pedidos', 'pedido'],
  pedidos: ['pedidos', 'pedido'],
  auth: ['auth', 'clientes', 'usuarios'],
  usuario: ['auth', 'clientes', 'usuarios'],
  usuarios: ['auth', 'clientes', 'usuarios'],
  cliente: ['auth', 'clientes', 'usuarios'],
  clientes: ['auth', 'clientes', 'usuarios']
};

/**
 * GET /api/admin/audit-log
 * Devuelve el registro de auditoría ordenado por created_at DESC con paginación y filtros opcionales.
 */
const obtenerAuditLogs = async (req, res) => {
  try {
    const { entidad, accion, admin_email, desde, hasta, fecha } = req.query;
    const page = Math.max(1, parseInt(req.query.page || req.query.pagina || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || req.query.porPagina || '50', 10))
    );
    const offset = (page - 1) * limit;

    let consulta = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (entidad) {
      const lista = mapeoEntidades[entidad.toLowerCase().trim()] || [entidad.trim()];
      if (lista.length === 1) {
        consulta = consulta.eq('entidad', lista[0]);
      } else {
        consulta = consulta.in('entidad', lista);
      }
    }

    if (accion) {
      consulta = consulta.eq('accion', accion.toLowerCase().trim());
    }

    if (admin_email) {
      consulta = consulta.ilike('admin_email', `%${admin_email.trim()}%`);
    }

    if (desde) {
      consulta = consulta.gte('created_at', desde);
    }

    if (hasta) {
      consulta = consulta.lte('created_at', hasta);
    }

    if (fecha === 'hoy') {
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      consulta = consulta.gte('created_at', inicioHoy.toISOString());
    } else if (fecha === '7dias' || fecha === 'ultimos7dias') {
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);
      hace7Dias.setHours(0, 0, 0, 0);
      consulta = consulta.gte('created_at', hace7Dias.toISOString());
    }

    const { data, error, count } = await consulta.range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count ?? (data?.length || 0);

    res.status(200).json({
      logs: data || [],
      total,
      pagina: page,
      porPagina: limit,
      totalPaginas: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    console.error('Error al obtener audit logs:', error.message || error);
    res.status(500).json({ error: 'Error al obtener el registro de auditoría.' });
  }
};

module.exports = {
  obtenerAuditLogs
};
