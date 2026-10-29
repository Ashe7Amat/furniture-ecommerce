import { describe, it, expect } from 'vitest';
import {
  traducirCampo,
  formatearValor,
  construirMensajeBorrado,
  hayCambiosRelevantes,
  obtenerResumenDetalle
} from './actividad';

describe('actividad — traducirCampo', () => {
  it('usa el diccionario cuando el campo está', () => {
    expect(traducirCampo('precio_venta')).toBe('Precio de venta');
  });

  it('si no está, cambia los guiones bajos por espacios y pone mayúscula', () => {
    expect(traducirCampo('fecha_de_alta')).toBe('Fecha de alta');
  });
});

describe('actividad — formatearValor', () => {
  it('un dato nuevo de un borrado es «Eliminado»', () => {
    expect(formatearValor('nombre', 'Silla', true, 'eliminar')).toBe('Eliminado');
    expect(formatearValor('nombre', 'Silla', false, 'eliminar')).toBe('Silla');
  });

  it('vacíos, booleanos y listas', () => {
    expect(formatearValor('nombre', null)).toBe('—');
    expect(formatearValor('nombre', undefined)).toBe('—');
    expect(formatearValor('nombre', '')).toBe('—');
    expect(formatearValor('destacado', true)).toBe('Sí');
    expect(formatearValor('destacado', false)).toBe('No');
    expect(formatearValor('imagenes', [])).toBe('Ninguna');
    expect(formatearValor('imagenes', ['a'])).toBe('1 foto');
    expect(formatearValor('fotos', ['a', 'b'])).toBe('2 fotos');
    expect(formatearValor('items', ['a'])).toBe('1 elemento');
    expect(formatearValor('items', ['a', 'b', 'c'])).toBe('3 elementos');
  });

  it('precios en euros, y un precio que no es número se deja tal cual', () => {
    expect(formatearValor('precio_venta', 120)).toBe('120 €');
    expect(formatearValor('precio_alquiler_dia', '15')).toBe('15 €');
    expect(formatearValor('precio_alquiler', 9)).toBe('9 €');
    expect(formatearValor('total', 0.5)).toBe('0.5 €');
    expect(formatearValor('precio_venta', 'gratis')).toBe('gratis');
  });

  it('estados conocidos traducidos, sin importar mayúsculas; los otros tal cual', () => {
    expect(formatearValor('estado', 'VENDIDO')).toBe('Vendido');
    expect(formatearValor('estado', 'enviado')).toBe('Enviado');
    expect(formatearValor('estado', 'raro')).toBe('raro');
  });

  it('fechas ISO en formato corto; una fecha imposible se deja tal cual', () => {
    expect(formatearValor('created', '2026-10-29T10:00:00Z')).toMatch(/2026/);
    expect(formatearValor('created', '2026-10-29T10:00:00Z')).not.toContain('T');
    expect(formatearValor('created', '2026-99-99')).toBe('2026-99-99');
  });

  it('objetos como JSON, y si no se pueden serializar como texto', () => {
    expect(formatearValor('cliente_info', { nombre: 'Ana' })).toBe('{"nombre":"Ana"}');
    const circular = {};
    circular.yo = circular;
    expect(formatearValor('cliente_info', circular)).toBe('[object Object]');
  });

  it('números y otros valores como texto', () => {
    expect(formatearValor('stock', 3)).toBe('3');
  });
});

describe('actividad — construirMensajeBorrado', () => {
  it('sin registro, cadena vacía', () => {
    expect(construirMensajeBorrado(null)).toBe('');
  });

  it('con nombre y referencia', () => {
    expect(
      construirMensajeBorrado({
        admin_email: 'admin@nave5.es',
        entidad: 'muebles',
        datos_anteriores: { nombre: 'Silla', referencia: 'NAV-SIL-001' }
      })
    ).toBe('El administrador admin@nave5.es eliminó Mueble con nombre: Silla y referencia NAV-SIL-001.');
  });

  it('sin email, sin datos anteriores y con una entidad desconocida', () => {
    expect(construirMensajeBorrado({ entidad: 'cosas', entidad_id: 42 })).toBe(
      'El administrador Sistema eliminó cosas con nombre: 42.'
    );
    expect(construirMensajeBorrado({ entidad: 'categorias' })).toBe(
      'El administrador Sistema eliminó Categoría con nombre: —.'
    );
  });
});

describe('actividad — hayCambiosRelevantes', () => {
  it('sin registro no hay cambios; un borrado siempre los tiene', () => {
    expect(hayCambiosRelevantes(null)).toBe(false);
    expect(hayCambiosRelevantes({ accion: 'eliminar' })).toBe(true);
  });

  it('cuenta solo los campos que no se ignoran', () => {
    expect(
      hayCambiosRelevantes({ accion: 'editar', datos_anteriores: { id: 1 }, datos_nuevos: { updated_at: 'x' } })
    ).toBe(false);
    expect(hayCambiosRelevantes({ accion: 'editar', datos_nuevos: { nombre: 'Silla' } })).toBe(true);
    expect(hayCambiosRelevantes({ accion: 'editar', datos_anteriores: { nombre: 'Silla' } })).toBe(true);
    expect(hayCambiosRelevantes({ accion: 'editar' })).toBe(false);
  });
});

describe('actividad — obtenerResumenDetalle', () => {
  it('sin registro, guion', () => {
    expect(obtenerResumenDetalle(null)).toBe('—');
  });

  it('cambio de estado', () => {
    expect(obtenerResumenDetalle({ accion: 'cambio_estado', datos_nuevos: { estado: 'vendido' } })).toBe(
      'Estado cambiado a Vendido'
    );
    expect(obtenerResumenDetalle({ accion: 'cambio_estado' })).toBe('Estado cambiado a desconocido');
  });

  it('inicio de sesión: email nuevo, del admin o «usuario»', () => {
    expect(obtenerResumenDetalle({ accion: 'login', datos_nuevos: { email: 'a@b.es' } })).toBe(
      'Inicio de sesión (a@b.es)'
    );
    expect(obtenerResumenDetalle({ accion: 'login', admin_email: 'admin@b.es' })).toBe(
      'Inicio de sesión (admin@b.es)'
    );
    expect(obtenerResumenDetalle({ accion: 'login' })).toBe('Inicio de sesión (usuario)');
  });

  it('crear: mueble con referencia, con nombre o con id; categoría; otra entidad', () => {
    expect(
      obtenerResumenDetalle({ accion: 'crear', entidad: 'muebles', datos_nuevos: { referencia: 'NAV-1', nombre: 'Silla' } })
    ).toBe('Mueble NAV-1');
    expect(obtenerResumenDetalle({ accion: 'crear', entidad: 'mueble', datos_nuevos: { nombre: 'Silla' } })).toBe(
      'Mueble "Silla"'
    );
    expect(obtenerResumenDetalle({ accion: 'crear', entidad: 'muebles', entidad_id: 7 })).toBe('Mueble #7');
    expect(
      obtenerResumenDetalle({ accion: 'crear', entidad: 'categorias', datos_nuevos: { nombre: 'Sillas' } })
    ).toBe('Categoría "Sillas"');
    expect(obtenerResumenDetalle({ accion: 'crear', entidad: 'categoria', entidad_id: 3 })).toBe('Categoría #3');
    expect(obtenerResumenDetalle({ accion: 'crear', entidad: 'pedidos', entidad_id: 9 })).toBe(
      'Elemento creado #9'
    );
  });

  it('duplicar: con nombre o con id', () => {
    expect(obtenerResumenDetalle({ accion: 'duplicar', datos_nuevos: { nombre: 'Silla (copia)' } })).toBe(
      'Mueble duplicado "Silla (copia)"'
    );
    expect(obtenerResumenDetalle({ accion: 'duplicar', entidad_id: 5 })).toBe('Mueble duplicado #5');
  });

  it('eliminar: mueble con referencia, nombre o id; categoría; otra entidad', () => {
    expect(
      obtenerResumenDetalle({ accion: 'eliminar', entidad: 'muebles', datos_anteriores: { referencia: 'NAV-2' } })
    ).toBe('Mueble eliminado NAV-2');
    expect(
      obtenerResumenDetalle({ accion: 'eliminar', entidad: 'mueble', datos_anteriores: { nombre: 'Mesa' } })
    ).toBe('Mueble eliminado "Mesa"');
    expect(obtenerResumenDetalle({ accion: 'eliminar', entidad: 'muebles', entidad_id: 8 })).toBe(
      'Mueble eliminado #8'
    );
    expect(
      obtenerResumenDetalle({ accion: 'eliminar', entidad: 'categorias', datos_anteriores: { nombre: 'Mesas' } })
    ).toBe('Categoría eliminada "Mesas"');
    expect(obtenerResumenDetalle({ accion: 'eliminar', entidad: 'categoria', entidad_id: 2 })).toBe(
      'Categoría eliminada #2'
    );
    expect(obtenerResumenDetalle({ accion: 'eliminar', entidad: 'pedidos', entidad_id: 4 })).toBe(
      'Elemento eliminado #4'
    );
  });

  it('editar: sin datos nuevos o solo con campos ignorados', () => {
    expect(obtenerResumenDetalle({ accion: 'editar', entidad: 'muebles', entidad_id: 1 })).toBe(
      'Edición en muebles #1'
    );
    expect(
      obtenerResumenDetalle({ accion: 'editar', entidad: 'muebles', entidad_id: 1, datos_nuevos: { updated_at: 'x' } })
    ).toBe('Edición en muebles #1');
  });

  it('editar: cambio de precio, con o sin precio anterior', () => {
    expect(
      obtenerResumenDetalle({
        accion: 'editar',
        datos_anteriores: { precio_venta: 100 },
        datos_nuevos: { precio_venta: 120 }
      })
    ).toBe('Precio de venta: 100 € -> 120 €');
    expect(obtenerResumenDetalle({ accion: 'editar', datos_nuevos: { precio_venta: 120 } })).toBe(
      'Precio de venta: — -> 120 €'
    );
  });

  it('editar: solo el nombre, con referencia, o la lista de campos', () => {
    expect(obtenerResumenDetalle({ accion: 'editar', datos_nuevos: { nombre: 'Silla nueva' } })).toBe(
      'Nombre cambiado a "Silla nueva"'
    );
    expect(
      obtenerResumenDetalle({
        accion: 'editar',
        datos_anteriores: { referencia: 'NAV-3' },
        datos_nuevos: { nombre: 'X', descripcion: 'Y' }
      })
    ).toBe('Mueble NAV-3');
    expect(
      obtenerResumenDetalle({ accion: 'editar', datos_nuevos: { referencia: 'NAV-4', descripcion: 'Y' } })
    ).toBe('Mueble NAV-4');
    expect(
      obtenerResumenDetalle({ accion: 'editar', datos_nuevos: { descripcion: 'Y', fecha_de_alta: 'Z' } })
    ).toBe('Campos modificados: Descripción, Fecha de alta');
  });

  it('una acción desconocida se describe con sus datos', () => {
    expect(obtenerResumenDetalle({ accion: 'exportar', entidad: 'pedidos', entidad_id: 6 })).toBe(
      'exportar en pedidos #6'
    );
  });
});
