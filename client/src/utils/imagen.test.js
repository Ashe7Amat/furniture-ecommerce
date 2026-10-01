import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  redimensionarImagen,
  redimensionarImagenes,
  prepararFotos,
  textoOptimizando,
  textoDemasiadoPeso,
  MAX_LADO,
  PESO_PEQUENO,
  TOPE_SUBIDA,
} from './imagen';

// jsdom no decodifica imágenes ni dibuja en un canvas: no tiene createImageBitmap, ni
// HTMLImageElement.decode, y su canvas no pinta. Aquí se simula un navegador que sí puede:
// createImageBitmap devuelve una imagen con las medidas que se le digan, y canvas.toBlob devuelve un
// Blob del peso indicado, anotando con qué medidas, tipo y calidad se le llamó.
const MB = 1024 * 1024;
const archivo = (nombre, tipo, peso) => new File([new Uint8Array(peso)], nombre, { type: tipo });

const navegadorQueRedimensiona = ({ ancho, alto, pesoSalida = 300 * 1024 }) => {
  const bitmap = { width: ancho, height: alto, close: vi.fn() };
  const createImageBitmap = vi.fn(async () => bitmap);
  vi.stubGlobal('createImageBitmap', createImageBitmap);

  const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '', imageSmoothingQuality: '' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  const lienzos = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (alTerminar, tipo, calidad) {
    lienzos.push({ ancho: this.width, alto: this.height, tipo, calidad });
    alTerminar(new Blob([new Uint8Array(pesoSalida)], { type: tipo }));
  });
  return { createImageBitmap, bitmap, ctx, lienzos };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('redimensionarImagen', () => {
  it('reduce una foto grande de móvil a 1920 px en su lado mayor, más ligera y en el mismo tipo', async () => {
    const { lienzos, ctx, bitmap } = navegadorQueRedimensiona({ ancho: 4032, alto: 3024, pesoSalida: 400 * 1024 });
    const original = archivo('salon.jpg', 'image/jpeg', 6 * MB);

    const reducida = await redimensionarImagen(original);

    expect(reducida).not.toBe(original);
    expect(reducida).toBeInstanceOf(File);
    expect(reducida.type).toBe('image/jpeg');
    expect(reducida.name).toBe('salon.jpg');
    expect(reducida.size).toBeLessThan(original.size);
    expect(lienzos).toEqual([{ ancho: 1920, alto: 1440, tipo: 'image/jpeg', calidad: 0.85 }]);
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1920, 1440);
    expect(bitmap.close).toHaveBeenCalled(); // libera la imagen decodificada
  });

  it('una foto en vertical se reduce por su lado mayor, el alto', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 3024, alto: 4032 });

    await redimensionarImagen(archivo('vertical.jpg', 'image/jpeg', 5 * MB));

    expect(lienzos[0]).toMatchObject({ ancho: 1440, alto: 1920 });
  });

  it('aplica la rotación del EXIF al decodificar, para que una foto vertical no salga tumbada', async () => {
    const { createImageBitmap } = navegadorQueRedimensiona({ ancho: 4032, alto: 3024 });
    const original = archivo('foto.jpg', 'image/jpeg', 6 * MB);

    await redimensionarImagen(original);

    expect(createImageBitmap).toHaveBeenCalledWith(original, { imageOrientation: 'from-image' });
  });

  it('una foto que ya es pequeña (menos de 500 KB y de 1920 px) se sube tal cual, sin recomprimir', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 1200, alto: 900 });
    const original = archivo('pequena.jpg', 'image/jpeg', PESO_PEQUENO - 1);

    expect(await redimensionarImagen(original)).toBe(original);
    expect(lienzos).toHaveLength(0);
  });

  it('una foto ligera pero de muchos píxeles sí se reduce', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 4000, alto: 3000, pesoSalida: 200 * 1024 });

    const reducida = await redimensionarImagen(archivo('comprimida.jpg', 'image/jpeg', 450 * 1024));

    expect(lienzos[0]).toMatchObject({ ancho: MAX_LADO, alto: 1440 });
    expect(reducida.size).toBe(200 * 1024);
  });

  it('una foto pesada que ya mide menos de 1920 px se recomprime sin agrandarla', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 1600, alto: 1200 });

    await redimensionarImagen(archivo('pesada.jpg', 'image/jpeg', 3 * MB));

    expect(lienzos[0]).toMatchObject({ ancho: 1600, alto: 1200 });
  });

  it('JPEG: pinta un fondo blanco antes de la foto, para que nada transparente salga negro', async () => {
    const { ctx } = navegadorQueRedimensiona({ ancho: 4000, alto: 3000 });

    await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 5 * MB));

    expect(ctx.fillStyle).toBe('#fff');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1440);
  });

  it('un PNG (que puede tener transparencia) sale en WebP, que la conserva, sin fondo blanco', async () => {
    const { lienzos, ctx } = navegadorQueRedimensiona({ ancho: 3000, alto: 3000 });

    const reducida = await redimensionarImagen(archivo('recorte.png', 'image/png', 5 * MB));

    expect(lienzos[0].tipo).toBe('image/webp');
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(reducida.type).toBe('image/webp');
    expect(reducida.name).toBe('recorte.webp');
  });

  it('respeta el tipo y la calidad que se le pidan', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 4000, alto: 3000 });

    await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 5 * MB), { tipo: 'image/webp', calidad: 0.7, maxLado: 1000 });

    expect(lienzos[0]).toEqual({ ancho: 1000, alto: 750, tipo: 'image/webp', calidad: 0.7 });
  });

  it('cambia la extensión al tipo nuevo: un HEIC que el navegador sabe leer sale como .jpg', async () => {
    navegadorQueRedimensiona({ ancho: 4032, alto: 3024 });

    const reducida = await redimensionarImagen(archivo('IMG_0001.HEIC', 'image/heic', 3 * MB));

    expect(reducida.name).toBe('IMG_0001.jpg');
    expect(reducida.type).toBe('image/jpeg');
  });

  it('si el resultado no pesa menos que el original, se sube el original', async () => {
    navegadorQueRedimensiona({ ancho: 4000, alto: 3000, pesoSalida: 2 * MB });
    const original = archivo('rara.jpg', 'image/jpeg', 1 * MB);

    expect(await redimensionarImagen(original)).toBe(original);
  });

  it('si toBlob no devuelve nada, se sube el original', async () => {
    navegadorQueRedimensiona({ ancho: 4000, alto: 3000 });
    HTMLCanvasElement.prototype.toBlob.mockImplementation((alTerminar) => alTerminar(null));
    const original = archivo('foto.jpg', 'image/jpeg', 5 * MB);

    expect(await redimensionarImagen(original)).toBe(original);
  });

  it('si el navegador no sabe leer el archivo (p. ej. HEIC en Chrome), se sube el original', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new DOMException('no se puede decodificar'); }));
    const original = archivo('IMG_0001.HEIC', 'image/heic', 3 * MB);

    expect(await redimensionarImagen(original)).toBe(original);
  });

  it('si no hay canvas 2D, se sube el original y se libera la imagen decodificada', async () => {
    const { bitmap } = navegadorQueRedimensiona({ ancho: 4000, alto: 3000 });
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    const original = archivo('foto.jpg', 'image/jpeg', 5 * MB);

    expect(await redimensionarImagen(original)).toBe(original);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('sin createImageBitmap ni img.decode (como en jsdom) devuelve el original enseguida, sin esperar a nada', async () => {
    const original = archivo('foto.jpg', 'image/jpeg', 6 * MB);

    expect(await redimensionarImagen(original)).toBe(original);
  });

  it('lo que no es una imagen se devuelve tal cual, sin intentar leerlo', async () => {
    const { createImageBitmap } = navegadorQueRedimensiona({ ancho: 4000, alto: 3000 });
    const pdf = archivo('factura.pdf', 'application/pdf', 5 * MB);

    expect(await redimensionarImagen(pdf)).toBe(pdf);
    expect(await redimensionarImagen(null)).toBe(null);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  describe('sin createImageBitmap: <img> con decode()', () => {
    const instalarImg = ({ ancho, alto, falla = false }) => {
      const decode = vi.fn(async () => { if (falla) throw new DOMException('no se puede decodificar'); });
      Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: decode, configurable: true });
      Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { get: () => ancho, configurable: true });
      Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { get: () => alto, configurable: true });
      URL.createObjectURL = vi.fn(() => 'blob:foto');
      URL.revokeObjectURL = vi.fn();
      return decode;
    };
    afterEach(() => {
      delete HTMLImageElement.prototype.decode;
      delete HTMLImageElement.prototype.naturalWidth;
      delete HTMLImageElement.prototype.naturalHeight;
      delete URL.createObjectURL;
      delete URL.revokeObjectURL;
    });

    it('decodifica con <img>, reduce igual y libera la URL temporal', async () => {
      const decode = instalarImg({ ancho: 4032, alto: 3024 });
      const { lienzos } = navegadorQueRedimensiona({ ancho: 0, alto: 0 });
      vi.stubGlobal('createImageBitmap', undefined);

      const reducida = await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 6 * MB));

      expect(decode).toHaveBeenCalled();
      expect(lienzos[0]).toMatchObject({ ancho: 1920, alto: 1440 });
      expect(reducida.size).toBeLessThan(6 * MB);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto');
    });

    it('si createImageBitmap no acepta imageOrientation "from-image" (Chrome < 112, Firefox < 111, Safari < 16), se reduce con <img>', async () => {
      const decode = instalarImg({ ancho: 4032, alto: 3024 });
      const { lienzos } = navegadorQueRedimensiona({ ancho: 0, alto: 0 });
      // Como en esos navegadores: la función existe, pero un valor de enum que no conoce es un TypeError.
      vi.stubGlobal('createImageBitmap', vi.fn(async (_archivo, opciones) => {
        if (opciones?.imageOrientation === 'from-image') throw new TypeError("'from-image' is not a valid enum value");
        return { width: 4032, height: 3024, close: vi.fn() };
      }));

      const reducida = await redimensionarImagen(archivo('foto.jpg', 'image/jpeg', 6 * MB));

      expect(decode).toHaveBeenCalled();
      expect(lienzos[0]).toMatchObject({ ancho: 1920, alto: 1440 });
      expect(reducida.size).toBeLessThan(6 * MB);
    });

    it('si createImageBitmap falla y <img> tampoco puede (una foto que no se sabe leer), se sube el original', async () => {
      instalarImg({ ancho: 4032, alto: 3024, falla: true });
      vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new DOMException('no se puede decodificar'); }));
      const original = archivo('IMG_0001.HEIC', 'image/heic', 3 * MB);

      expect(await redimensionarImagen(original)).toBe(original);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto');
    });

    it('si decode() falla, se sube el original y también se libera la URL', async () => {
      instalarImg({ ancho: 4032, alto: 3024, falla: true });
      vi.stubGlobal('createImageBitmap', undefined);
      const original = archivo('foto.jpg', 'image/jpeg', 6 * MB);

      expect(await redimensionarImagen(original)).toBe(original);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto');
    });
  });
});

describe('redimensionarImagenes', () => {
  it('reduce todas, de una en una y en orden, y avisa antes de cada una', async () => {
    const { createImageBitmap } = navegadorQueRedimensiona({ ancho: 4032, alto: 3024 });
    const fotos = ['a.jpg', 'b.jpg', 'c.jpg'].map((n) => archivo(n, 'image/jpeg', 4 * MB));
    const avisos = [];

    const reducidas = await redimensionarImagenes(fotos, {
      alProgreso: (numero, total) => avisos.push([numero, total, createImageBitmap.mock.calls.length]),
    });

    expect(reducidas.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(reducidas.every((f) => f.size < 4 * MB)).toBe(true);
    // [número, total, fotos ya empezadas]: cada aviso llega antes de empezar esa foto, no todas a la vez.
    expect(avisos).toEqual([[1, 3, 0], [2, 3, 1], [3, 3, 2]]);
  });

  it('acepta un FileList (o cualquier lista) y, vacía, no hace nada', async () => {
    expect(await redimensionarImagenes([])).toEqual([]);
    expect(await redimensionarImagenes(undefined)).toEqual([]);
  });
});

describe('prepararFotos', () => {
  it('si reducidas una vez ya caben, no hay segundo intento', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 4032, alto: 3024, pesoSalida: 600 * 1024 });
    const fotos = ['a.jpg', 'b.jpg', 'c.jpg'].map((n) => archivo(n, 'image/jpeg', 5 * MB));

    const { fotos: listas, peso, caben } = await prepararFotos(fotos);

    expect(caben).toBe(true);
    expect(peso).toBe(3 * 600 * 1024);
    expect(listas).toHaveLength(3);
    expect(lienzos.every((l) => l.ancho === 1920 && l.calidad === 0.85)).toBe(true);
  });

  it('si reducidas pasan del tope, se reducen otra vez desde los originales: 1600 px y calidad 0,7', async () => {
    const { lienzos } = navegadorQueRedimensiona({ ancho: 4032, alto: 3024 });
    // Con 1920 px y calidad 0,85 cada una pesa 1 MB (5 MB en total, más que el tope); con 1600 px y
    // 0,7, 500 KB.
    HTMLCanvasElement.prototype.toBlob.mockImplementation(function (alTerminar, tipo, calidad) {
      lienzos.push({ ancho: this.width, alto: this.height, tipo, calidad });
      alTerminar(new Blob([new Uint8Array(calidad === 0.85 ? 1 * MB : 500 * 1024)], { type: tipo }));
    });
    const fotos = ['a', 'b', 'c', 'd', 'e'].map((n) => archivo(`${n}.jpg`, 'image/jpeg', 5 * MB));

    const { fotos: listas, peso, caben } = await prepararFotos(fotos);

    expect(caben).toBe(true);
    expect(peso).toBe(5 * 500 * 1024);
    expect(peso).toBeLessThanOrEqual(TOPE_SUBIDA);
    expect(lienzos.slice(5).every((l) => l.ancho === 1600 && l.alto === 1200 && l.calidad === 0.7)).toBe(true);
    expect(listas.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']);
  });

  it('si el navegador no puede reducirlas y los originales pasan del tope, dice que no caben', async () => {
    const fotos = [archivo('a.jpg', 'image/jpeg', 3 * MB), archivo('b.jpg', 'image/jpeg', 3 * MB)];

    const { fotos: listas, peso, caben } = await prepararFotos(fotos);

    expect(caben).toBe(false);
    expect(peso).toBe(6 * MB);
    expect(listas).toEqual(fotos);
  });

  it('avisa del progreso en cada pasada: con una basta, una vez por foto', async () => {
    navegadorQueRedimensiona({ ancho: 4032, alto: 3024 });
    const avisos = [];

    await prepararFotos([archivo('a.jpg', 'image/jpeg', 5 * MB)], { alProgreso: (n, t) => avisos.push(`${n}/${t}`) });

    expect(avisos).toEqual(['1/1']);
  });

  it('avisa del progreso en cada pasada: si hace falta la segunda, vuelve a contar desde 1', async () => {
    navegadorQueRedimensiona({ ancho: 4032, alto: 3024 });
    // 1920 px y 0,85: 1 MB por foto (5 MB en total, más que el tope); 1600 px y 0,7: 500 KB.
    HTMLCanvasElement.prototype.toBlob.mockImplementation((alTerminar, tipo, calidad) =>
      alTerminar(new Blob([new Uint8Array(calidad === 0.85 ? 1 * MB : 500 * 1024)], { type: tipo }))
    );
    const fotos = ['a', 'b', 'c', 'd', 'e'].map((n) => archivo(`${n}.jpg`, 'image/jpeg', 5 * MB));
    const avisos = [];

    await prepararFotos(fotos, { alProgreso: (n, t) => avisos.push(`${n}/${t}`) });

    const unaPasada = ['1/5', '2/5', '3/5', '4/5', '5/5'];
    expect(avisos).toEqual([...unaPasada, ...unaPasada]);
  });
});

describe('textoDemasiadoPeso', () => {
  it('dice cuánto pesan y cuál es el máximo, en MB con coma decimal', () => {
    expect(textoDemasiadoPeso(6.2 * MB, 3)).toBe(
      'Las fotos pesan demasiado para subirlas juntas (6,2 MB de un máximo de 4 MB). Sube menos a la vez: puedes añadir el resto después, editando el mueble.'
    );
    expect(textoDemasiadoPeso(5 * MB, 1)).toBe('La foto pesa demasiado (5 MB de un máximo de 4 MB). Prueba con una más ligera.');
  });
});

describe('textoOptimizando', () => {
  it('con una foto no cuenta; con varias, dice por cuál va', () => {
    expect(textoOptimizando(1, 1)).toBe('Optimizando imagen...');
    expect(textoOptimizando(2, 3)).toBe('Optimizando imágenes... 2/3');
  });
});
