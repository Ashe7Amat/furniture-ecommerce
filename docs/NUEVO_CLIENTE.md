# Nuevo cliente en 30 minutos (NUEVO_CLIENTE.md)

Checklist para montar otra tienda a partir de este repositorio. Los pasos de infraestructura están
explicados en [DEPLOY.md](DEPLOY.md) y las variables en [ENV_VARS.md](ENV_VARS.md); aquí va el orden y
lo que hay que cambiar de la marca.

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
  `hashtag`, `descripcion`, `prefijoSku`, `idInterno`, `contacto` (correo, calle, dirección, ciudad,
  código postal, razón social, NIF...), `web`, `dominio` y `redes`. Los textos de la web, el `<title>` y
  las metas de `index.html` (marcadores `%BRAND_...%`), los datos estructurados de Google, el albarán y
  las etiquetas del panel salen de aquí.
- **`server/src/config/brand.config.js`**: `nombre`, `nombreLogo`, `eslogan`, `prefijoSku`, `idInterno`,
  `web`, `dominio`, `contacto`, y en `email` el remitente y el destinatario de avisos por defecto, el
  logo y los colores de los correos.

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

## Lo que `brand.config.js` no cubre (a mano)

| Qué | Dónde |
|---|---|
| Logotipo de la web (SVG con «NAVE 5» en letras de plantilla) | `client/src/components/Logo.jsx` |
| Favicon, imagen para redes, manifiesto y robots | `client/public/favicon.svg`, `og-image.png`, `manifest.json`, `robots.txt` |
| Fotos del hero y de la portada | `client/public/img/` (las de la portada también se cambian desde el panel) |
| Música de fondo | `client/public/audio/` y `client/src/utils/musica.js` |
| Logo de los correos | `server/scripts/logo-email.js` lo genera; su URL va en `BRAND.email.logo` |
| Textos propios de Nave 5: Sobre nosotros, Sostenibilidad, Aviso legal, Privacidad, Condiciones | `client/src/pages/About.jsx`, `Sustainability.jsx`, `Legal.jsx`, `PrivacyPolicy.jsx`, `Terms.jsx`. Ya usan el nombre, la dirección y el NIF de `brand.config.js`, pero la prosa es de Nave 5 y los textos legales los tiene que dar el cliente |
| Producciones en las que han salido las piezas | `client/src/utils/producciones.js` |
| Dominios de la API y de Supabase | `client/vercel.json` y el `preconnect` de `client/index.html` |
| Reglas del alquiler (horarios, días mínimos, portes) | `server/src/utils/reglasAlquiler.js` |
| Color del icono de "sin imagen" y del manifiesto | `client/public/img/sin-imagen.svg` y `client/public/manifest.json` (el color de la barra del navegador de `index.html` ya sale de `--color-primary` al compilar) |

## Los tests de ejemplo

Muchos tests comprueban textos de Nave 5 tal cual («Nave 5 Barcelona», `NAV-SIL-001`, la web, los
correos...). Con la tienda de ejemplo de arriba, lint y build salen limpios, pero fallan **66 tests de la
web** (en 23 archivos: datos estructurados, metas, cookies, cabecera, pie, etiquetas QR, mensajes del
panel...) y **45 de la API** (en 13 archivos: correos, sitemap, CSV, referencias). La web funciona: lo que cambia es el
texto esperado. Para un cliente nuevo hay que actualizar esos textos (ninguno es de los `Admin.*.test.jsx`
congelados). Los tests del starter (`client/src/theme/`, `server/src/config/`, `scripts/`) sí se adaptan a
la marca, salvo dos de `client/src/theme/brand.config.test.js` que comprueban los datos de Nave 5, y vigilan que nadie
vuelva a escribir el nombre o la web a mano en el código.
