// Núcleo común de errores (H12): peticion() nunca lanza y siempre devuelve { data, error, status }.
import { describe, it, expect, vi } from 'vitest';
import { peticion, comoContratoA, SIN_CONEXION } from './peticion';

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: cuerpo === undefined ? async () => { throw new SyntaxError('Unexpected end of JSON input'); } : async () => cuerpo
});
const transporte = (r) => vi.fn().mockResolvedValue(r);

describe('peticion', () => {
  it('2xx: el cuerpo en data, sin error', async () => {
    expect(await peticion(transporte(respuesta(201, { id: 'x' })), '/u', {}, 'Fallo.')).toEqual({ data: { id: 'x' }, error: null, status: 201 });
  });

  it('2xx sin cuerpo (un 204): éxito con data null, no un error', async () => {
    expect(await peticion(transporte(respuesta(204)), '/u', {}, 'Fallo.')).toEqual({ data: null, error: null, status: 204 });
  });

  it('error con { error }: el mensaje del servidor tal cual, con su status', async () => {
    const r = respuesta(409, { error: 'La pieza tiene reservas.' });
    expect(await peticion(transporte(r), '/u', {}, 'Fallo.')).toEqual({ data: null, error: 'La pieza tiene reservas.', status: 409 });
  });

  it('error sin JSON (la página de Vercel de un 504) o sin mensaje: el mensaje por defecto', async () => {
    expect(await peticion(transporte(respuesta(504)), '/u', {}, 'Fallo.')).toEqual({ data: null, error: 'Fallo.', status: 504 });
    expect(await peticion(transporte(respuesta(500, {})), '/u', {}, 'Fallo.')).toEqual({ data: null, error: 'Fallo.', status: 500 });
    expect(await peticion(transporte(respuesta(500, { error: '' })), '/u', {}, 'Fallo.')).toEqual({ data: null, error: 'Fallo.', status: 500 });
  });

  it('fallo de red: status 0 y un mensaje en castellano, no el del navegador', async () => {
    const caido = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await peticion(caido, '/u', {}, 'Fallo.')).toEqual({ data: null, error: SIN_CONEXION, status: 0 });
  });

  it('pasa la url y las opciones al transporte tal cual', async () => {
    const t = transporte(respuesta(200, {}));
    await peticion(t, '/api/muebles/m1', { method: 'DELETE' }, 'Fallo.');
    expect(t).toHaveBeenCalledWith('/api/muebles/m1', { method: 'DELETE' });
  });
});

describe('comoContratoA', () => {
  it('el cuerpo si va bien; null si falla', () => {
    expect(comoContratoA({ data: { success: true }, error: null, status: 200 })).toEqual({ success: true });
    expect(comoContratoA({ data: null, error: 'x', status: 500 })).toBeNull();
  });
});
