# Nuevo cliente en 30 minutos (NUEVO_CLIENTE.md)

Checklist para montar otra tienda a partir de este repositorio. Los pasos de infraestructura están
explicados en [DEPLOY.md](DEPLOY.md) y las variables en [ENV_VARS.md](ENV_VARS.md); aquí va el orden y
lo que hay que cambiar de la marca.

> **Importante:** `npm run init:client` cambia la marca en el código, pero **no toca `client/public/` ni
> `client/vercel.json`**. El favicon, la imagen para redes, el manifiesto, el `robots.txt`, las fotos y los
> dominios de la API y de Supabase siguen siendo los de Nave 5 hasta que los reemplaces a mano: ver
> [Archivos que se cambian a mano](#archivos-que-se-cambian-a-mano-clientpublic-y-clientverceljson).

## Nave 5: los dos únicos datos provisionales que quedan

En la marca de Nave 5 solo quedan dos datos de ejemplo. Los dos están en un único archivo,
**`client/src/theme/brand.config.js`**, dentro de `contacto`, con un comentario `PROVISIONAL` encima:

| Dato | Campo | Valor de ejemplo | Dónde sale |
|---|---|---|---|
| **NIF** | `contacto.cif` (línea 47) | `'B-00000000'` | Aviso legal, Política de privacidad y el albarán del panel |
| **Teléfono** | `contacto.telefono` (línea 36) | `'+34 930 00 00 00'` | En ninguna página todavía |

Para poner el NIF real: cambia solo el texto entre comillas (`cif: 'B-12345678'`), sin tocar nada más, y
guarda. Las tres páginas lo leen de ahí. La API no lo usa: `server/src/config/brand.config.js` no lleva NIF
ni teléfono. Después, `npm test` en `client/` (el test `marca.test.js` comprueba que el NIF y el teléfono no
están escritos en ningún otro archivo) y el despliegue de siempre. Si con el NIF cambia también la razón
social, es el campo de justo encima, `contacto.razonSocial`.

## Los 30 minutos

| Minuto | Paso |
|---|---|
| 0-3 | 1. Clonar e instalar |
| 3-10 | 2. Marca: `brand.config.js` (web y API) |
| 10-14 | 3. Colores y fuentes: `tokens.css` |
| 14-20 | 4. Supabase: proyecto, esquema, bucket |
| 20-24 | 5. Secretos, Stripe y Resend |
| 24-28 | 6. Vercel: API y web |
| 28-30 | 7. Comprobar |

### 1. Clonar e instalar

```bash
git clone https://github.com/<organizacion>/<repo>.git tienda-cliente
cd tienda-cliente
cd client && npm ci && cd ../server && npm ci && cd ..
```

### 2. Marca

**Con el script** (recomendado), desde la raíz del repositorio:

```bash
npm run init:client
```

Pregunta el nombre, el nombre corto, el prefijo de las referencias, el correo, el color primario y,
opcionalmente, el eslogan, el color de acento, la ciudad y la web. Con eso reescribe las dos
`brand.config.js` y `tokens.css` (paleta clara y oscura derivada de los dos colores, con el texto
secundario y el de acento a 4,5:1 de contraste como mínimo). Solo cambia valores: comentarios y campos
que no pregunta se quedan. Lo que no sabe (calle, código postal, razón social, NIF, Instagram, logo de los
correos) lo deja como `PENDIENTE`, para que no quede ningún dato de la tienda anterior: búscalo con
`git grep PENDIENTE -- client/src/theme server/src/config` y complétalo. Sin preguntas, para automatizarlo:

```bash
node scripts/init-client.js --nombre="Studio Vintage Madrid" --nombreCorto="Studio Vintage" \
  --prefijo=SVM --email=hola@studiovintage.es --primario=#1E3A5F --acento=#C9A227 \
  --eslogan="Diseño con historia" --ciudad=Madrid --web=https://www.studiovintage.es --si
```

Capturas de esa tienda de ejemplo, generada así sobre una copia del repositorio, en
`/mnt/project-files/starter-kit/` del proyecto (30 oct 2026).

**A mano**: dos archivos con los mismos datos, porque la web y la API se despliegan por separado:

- **`client/src/theme/brand.config.js`**: nombre (`nombre`, `nombreCorto`), `eslogan`, `tipoNegocio`,
  `hashtag`, `descripcion`, `logo`, `prefijoSku`, `idInterno`, `contacto` (correo, calle, dirección, ciudad,
  código postal, razón social, NIF...), `web`, `dominio` y `redes`. Los textos de la web, el `<title>` y
  las metas de `index.html` (marcadores `%BRAND_...%`), los datos estructurados de Google, el albarán y
  las etiquetas del panel salen de aquí.
- **`server/src/config/brand.config.js`**: `nombre`, `nombreLogo`, `eslogan`, `prefijoSku`, `idInterno`,
  `web`, `dominio`, `contacto`, y en `email` el remitente y el destinatario de avisos por defecto, el
  logo y los colores de los correos.

**El logotipo de la cabecera** lo elige el campo `logo` de `client/src/theme/brand.config.js`:

- `'texto'` (lo que deja `init:client`): el nombre corto (`nombreCorto`) en mayúsculas, con la fuente de
  títulos y el color de la marca. No hay que tocar nada más. En el móvil caben unos 8 caracteres: un nombre
  corto más largo se acorta con puntos suspensivos («STUDIO ...»), así que conviene que sea breve.
- `'dibujo'`: el SVG de `client/src/theme/LogoDibujo.jsx`. Ahí está el de Nave 5. Si el cliente tiene un
  logo dibujado, pon su SVG en ese archivo (rellenos con `currentColor`), ajusta el `aspect-ratio` de
  `.logo-svg` en `client/src/styles/HeaderFooter.css` a su `viewBox` (lo comprueba `Logo.css.test.js`) y
  cambia `client/src/theme/LogoDibujo.test.jsx`, que comprueba las formas del dibujo de Nave 5.

Cuidado con dos campos:

- `prefijoSku` forma las referencias de las piezas nuevas (`NAV-SIL-001`). Elígelo antes de dar de alta
  la primera pieza: cambiarlo después deja las viejas con el prefijo anterior.
- `idInterno` da nombre a las claves que se guardan en el navegador (tema elegido, consentimiento de
  cookies) y a los CSV del panel. En una tienda nueva, pon el que quieras; en una que ya funciona, no lo
  cambies.

### 3. Colores y fuentes

- **`client/src/theme/tokens.css`**: cambia el bloque "Paleta de la marca" y sus dos bloques de modo
  oscuro (el del sistema y el del botón; tienen que llevar los mismos valores, lo comprueba
  `tokens.test.js`). Las fuentes son `--font-display` y `--font-body`.
- Si cambias de fuentes, cambia también el enlace de Google Fonts (y los dos `preload` de fuentes) en
  `client/index.html`.
- Alternativa sin tocar `tokens.css`: un archivo de tema importado después de `index.css` en
  `client/src/main.jsx`. Hay uno de ejemplo, azul marino y dorado, en
  `client/src/theme/theme-cliente-demo.css`, con las instrucciones dentro.
- Los colores de los correos están en `server/src/config/brand.config.js` (`email.colores`), en hex: los
  clientes de correo no entienden variables CSS.

### 4. Supabase

Proyecto nuevo y, en su *SQL Editor*, `server/migrations/00_esquema_base.sql` entero: crea las tablas, las
políticas y el bucket público `imagenes`. Las migraciones de `server/migrations/` con versión
`20261022190000` o anterior ya van dentro: no se ejecutan. Después, el primer administrador:
[DEPLOY.md, sección 1](DEPLOY.md#1-supabase).

### 5. Secretos, Stripe y Resend

`npm run secrets:generate` en `server/`, webhook de Stripe con `checkout.session.completed` y
`checkout.session.expired`, dominio verificado en Resend: [DEPLOY.md, secciones 2 a 4](DEPLOY.md#2-secretos-de-la-api).

### 6. Vercel

Dos proyectos del mismo repositorio (*Root Directory* `server` y `client`) con sus variables, y
**`client/vercel.json` cambiado** a los dominios del cliente (API y Supabase): [DEPLOY.md, sección 5](DEPLOY.md#5-vercel).

### 7. Comprobar

Las comprobaciones de [DEPLOY.md, sección 6](DEPLOY.md#6-comprobaciones-después-de-desplegar), y antes de
desplegar, en local:

```bash
cd client && npm run lint && npm test && npm run build
cd ../server && npm run lint && npm test
```

## Archivos que se cambian a mano: `client/public/` y `client/vercel.json`

`init:client` no los toca: son archivos que se sirven tal cual (imágenes, JSON, texto) o configuración de
Vercel, y no pueden leer `brand.config.js`. **Hasta que los reemplaces, la tienda nueva enseña el icono, la
imagen para redes y las fotos de Nave 5, y sus peticiones van a la API y al Supabase de Nave 5.** Hazlo antes
del primer despliegue.

| Archivo | Qué lleva de Nave 5 | Qué hacer |
|---|---|---|
| `client/public/favicon.svg` | El icono de la pestaña (y del manifiesto), con los colores de Nave 5 | Sustituirlo por el icono del cliente, en SVG cuadrado (`viewBox="0 0 64 64"` o similar) |
| `client/public/og-image.png` | La imagen que sale al compartir un enlace en redes y en WhatsApp | Sustituirla por una del cliente de **1200 × 630 px**, mismo nombre |
| `client/public/manifest.json` | `name`, `short_name`, `description`, `background_color` y `theme_color` | Poner el nombre, el nombre corto y la descripción del cliente; `background_color` = su `--color-bg` y `theme_color` = su `--color-primary` de `tokens.css` |
| `client/public/robots.txt` | `Sitemap: https://www.nave5barcelona.com/sitemap.xml` | Cambiar la línea `Sitemap:` por la web del cliente (la misma que `BRAND.web`) |
| `client/public/img/` | Las fotos del hero y de la galería de la portada (`hero-*.webp`, `galeria-*.webp`) | Sustituirlas por fotos del cliente con los **mismos nombres y tamaños** (las de `-800` y `-1200` son las versiones pequeñas). Las de la portada también se pueden cambiar después desde el panel |
| `client/public/img/sin-imagen.svg` | El dibujo de "sin imagen", con el fondo y el trazo de Nave 5 | Cambiar sus dos colores (`fill` del fondo y `stroke`) por el `--color-bg` y el `--color-accent` del cliente |
| `client/public/audio/` | La música de fondo (8 pistas de Pixabay) | Cambiar las pistas y su lista en `client/src/utils/musica.js`, o dejarlas (son de uso libre) |
| `client/vercel.json` | `https://nave5-api.vercel.app` (en el `rewrite` de `/sitemap.xml` y en `connect-src`) y `https://gdrmpxcpucmaxvtpljge.supabase.co` (en `img-src`) | Cambiar las dos URL por la de la API del cliente en Vercel y la de su proyecto de Supabase. Son las únicas líneas que hay que tocar: el resto (caché y cabeceras de seguridad) vale igual |

Y en `client/index.html`, las dos líneas de `preconnect` y `dns-prefetch` a Supabase: la URL del proyecto del
cliente. Para comprobar que no queda nada de Nave 5 fuera de la marca:

```bash
git grep -n -i -E "nave ?5|nave5|gdrmpxcpucmaxvtpljge" -- client/public client/vercel.json client/index.html
```

Tiene que salir vacío (las fotos `.webp` y `og-image.png` no salen en `git grep`: compruébalas a ojo).

## Otros textos y datos propios de Nave 5 (a mano)

| Qué | Dónde |
|---|---|
| Logo de los correos | `server/scripts/logo-email.js` lo genera a partir de `client/src/theme/LogoDibujo.jsx`; su URL va en `BRAND.email.logo` del servidor. Sin logo (vacío), la cabecera de los correos lleva el nombre en texto |
| Textos propios de Nave 5: Sobre nosotros, Sostenibilidad, Aviso legal, Privacidad, Condiciones | `client/src/pages/About.jsx`, `Sustainability.jsx`, `Legal.jsx`, `PrivacyPolicy.jsx`, `Terms.jsx`. Ya usan el nombre, la dirección y el NIF de `brand.config.js`, pero la prosa es de Nave 5 y los textos legales los tiene que dar el cliente |
| Producciones en las que han salido las piezas | `client/src/utils/producciones.js` |
| Reglas del alquiler (horarios, días mínimos, portes) | `server/src/utils/reglasAlquiler.js` |

## Los tests con otra marca

Los tests leen el valor esperado de `brand.config.js` (el nombre, la web, el dominio, el prefijo de las
referencias, el id interno, el logo...), no de Nave 5. Con la tienda de ejemplo de arriba generada con
`init:client`, **pasan todos**: lint, tests y build de la web y lint y tests de la API, sin tocar ningún test.
Si después cambias a mano un campo de la marca, siguen pasando.

Solo hay tests que se saltan o que conviene cambiar con el cliente:

- `client/src/theme/brand.config.test.js` tiene uno que solo corre con Nave 5 (fija su nombre, su prefijo y
  su correo): con otra marca sale como omitido (`skipped`).
- `client/src/theme/LogoDibujo.test.jsx` comprueba las formas del dibujo de Nave 5: si pones otro dibujo en
  `LogoDibujo.jsx`, cambia también su test.
- `client/src/theme/marca.test.js` y su pareja de la API vigilan que nadie vuelva a escribir el nombre, la
  web, la dirección o el NIF a mano en el código: si fallan, el dato tiene que salir de `brand.config.js`.

