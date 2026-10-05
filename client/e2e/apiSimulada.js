// La API simulada de los tests E2E. Intercepta en el navegador todo lo que va a
// http://localhost:5000/api y responde con los datos de aquí, con la misma forma que la API real
// (ver server/src/controllers). Lo que un test no haya previsto responde 404 y queda apuntado en
// `sinSimular`, para que un test pueda comprobar que no se le ha escapado ninguna llamada.
//
// Las fuentes de Google se responden vacías: el contenedor y la CI no tienen por qué llegar a
// fonts.googleapis.com, y un fallo de red ensuciaría la consola que miran los tests.

export const API = 'http://localhost:5000/api';
const FOTO = '/img/sin-imagen.svg';

export const CATEGORIAS = [
  { id: 17, nombre: 'Mobiliario', categoria_padre_id: null, imagen_url: null },
  { id: 18, nombre: 'Decoración y hogar', categoria_padre_id: null, imagen_url: null },
  { id: 20, nombre: 'Sillas y asientos', categoria_padre_id: 17, imagen_url: null },
  { id: 21, nombre: 'Mesas y mobiliario', categoria_padre_id: 17, imagen_url: null },
  { id: 7, nombre: 'Iluminación', categoria_padre_id: 18, imagen_url: null }
];

const mueble = (id, nombre, categoria, referencia, estado = 'disponible') => ({
  id,
  nombre,
  categoria,
  descripcion: `${nombre}, restaurada a mano en el taller.`,
  // Como en producción hoy (MOSTRAR_PRECIOS sin poner): el público no ve precios.
  precio_venta: null,
  precio_alquiler_dia: null,
  imagenes: [FOTO],
  estado,
  referencia
});

export const MUEBLES = [
  mueble('m1', 'Silla Tolix Verde', 'Sillas y asientos', 'NAV-SIL-001'),
  mueble('m2', 'Silla Thonet Curvada', 'Sillas y asientos', 'NAV-SIL-002', 'vendido'),
  mueble('m3', 'Mesa de Roble Restaurada', 'Mesas y mobiliario', 'NAV-MES-001'),
  mueble('m4', 'Lámpara Industrial Plateada', 'Iluminación', 'NAV-ILU-001'),
  mueble('m5', 'Mesa Auxiliar de Hierro', 'Mesas y mobiliario', 'NAV-MES-002')
];

export const ADMIN = { id: 'u-admin', nombre: 'Admin Nave 5', email: 'admin@nave5.test', rol: 'admin' };
export const CLIENTE = { id: 'u-ana', nombre: 'Ana', email: 'ana@correo.test', rol: 'cliente' };
export const CONTRASENA = 'contraseña-de-prueba';

const json = (route, cuerpo, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });

const statsVacias = { totalProductos: 0, disponibles: 0, vendidos: 0, alquilados: 0, valorTotalVenta: '0,00 €' };

// Prepara la API simulada en `page`. `usuarios` son las cuentas que aceptan la contraseña de
// prueba. Devuelve { llamadas, sinSimular } para poder comprobar qué se ha pedido.
export const simularApi = async (page, { usuarios = [ADMIN, CLIENTE] } = {}) => {
  const llamadas = [];
  const sinSimular = [];

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );

  await page.route(`${API}/**`, async (route) => {
    const peticion = route.request();
    const url = new URL(peticion.url());
    const ruta = url.pathname.replace(/^\/api/, '');
    const metodo = peticion.method();
    llamadas.push(`${metodo} ${ruta}${url.search}`);

    if (metodo === 'GET' && ruta === '/categorias') return json(route, CATEGORIAS);
    if (metodo === 'GET' && ruta === '/muebles') {
      const limite = Number(url.searchParams.get('limit')) || MUEBLES.length;
      return json(route, MUEBLES.slice(0, limite));
    }
    const detalle = ruta.match(/^\/muebles\/([^/]+)$/);
    if (metodo === 'GET' && detalle) {
      const encontrado = MUEBLES.find((m) => m.id === detalle[1]);
      return encontrado ? json(route, encontrado) : json(route, { error: 'Mueble no encontrado.' }, 404);
    }

    if (metodo === 'POST' && ruta === '/auth/login') {
      const { email, password } = peticion.postDataJSON();
      const usuario = usuarios.find((u) => u.email === email);
      if (!usuario || password !== CONTRASENA) {
        return json(route, { error: 'Email o contraseña incorrectos.' }, 401);
      }
      return json(route, { success: true, token: `access-${usuario.id}`, refreshToken: `refresh-${usuario.id}`, user: usuario });
    }
    if (metodo === 'POST' && ruta === '/auth/refresh') return json(route, { error: 'Sesión caducada.' }, 401);
    if (metodo === 'POST' && ruta === '/auth/logout') return json(route, { success: true });

    // Panel de administración: solo con el token del administrador (como verificarAdmin).
    if (ruta.startsWith('/admin/') || ruta === '/pedidos') {
      if (peticion.headers().authorization !== `Bearer access-${ADMIN.id}`) {
        return json(route, { error: 'No autorizado.' }, 401);
      }
      if (ruta === '/admin/muebles') return json(route, MUEBLES);
      if (ruta === '/admin/categorias/con-stats') {
        return json(route, CATEGORIAS.map((c) => ({ ...c, codigo: null, stats: statsVacias })));
      }
      if (ruta === '/admin/mensajes') {
        return json(route, [
          {
            id: '11111111-1111-4111-8111-111111111111',
            nombre: 'Lucía',
            email: 'lucia@correo.test',
            mensaje: '¿Sigue disponible la mesa de roble?',
            leido: false,
            created_at: '2026-10-03T10:00:00Z'
          }
        ]);
      }
      if (ruta === '/pedidos') return json(route, []);
    }

    sinSimular.push(`${metodo} ${ruta}`);
    return json(route, { error: 'Ruta no simulada en los tests E2E.' }, 404);
  });

  return { llamadas, sinSimular };
};

// Recoge los errores de la consola del navegador y las excepciones sin capturar de la página.
export const vigilarConsola = (page) => {
  const errores = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));
  return errores;
};

// El banner de cookies sale en la primera visita y tapa parte de la página: se elige "Solo
// esenciales", como haría un visitante.
export const cerrarCookies = async (page) => {
  const boton = page.getByRole('button', { name: 'Solo esenciales' });
  if (await boton.isVisible().catch(() => false)) await boton.click();
};
