// Logotipo de la cabecera. Lo elige la marca, con el campo logo de theme/brand.config.js:
// - 'dibujo': el SVG trazado a mano de theme/LogoDibujo.jsx (el de Nave 5).
// - 'texto': el nombre corto de la marca (BRAND.nombreCorto) en mayúsculas, con la fuente de títulos.
//   Es lo que deja `npm run init:client` hasta que el cliente tenga su propio dibujo.
// Los dos toman el color del texto (siguen al tema claro u oscuro) y son decorativos: el nombre
// accesible lo da el enlace que los contiene.
import { BRAND } from '../theme/brand.config';
import LogoDibujo from '../theme/LogoDibujo';

const Logo = ({ className }) =>
  BRAND.logo === 'dibujo' ? (
    <LogoDibujo className={className} />
  ) : (
    <span className={[className, 'logo-texto'].filter(Boolean).join(' ')} aria-hidden="true">
      {BRAND.nombreCorto}
    </span>
  );

export default Logo;
