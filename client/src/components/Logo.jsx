// Logotipo de Nave 5: "NAVE" en letras de plantilla (stencil) y un "5" pequeño abajo a la derecha.
// Trazado en SVG sobre la referencia limpia que mandó el cliente (contorno de cada letra, con las
// esquinas y los lados rectos ajustados). Una forma por letra, sin trazos que se solapen: la A lleva
// el ojo como hueco interior (evenodd) y no deja ninguna línea fina bajo los palos. Toma el color del
// texto (currentColor), así que sigue al tema claro u oscuro. El nombre lo da el enlace que lo contiene.
const Logo = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 496.3 178.9"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M89.7,145.3 L87.6,145.3 L46.3,44.3 L46.3,145.3 L0,145.3 L0,0 L46,0 L69,50.6 L69,0 L89.7,0 Z" />
    <path
      fillRule="evenodd"
      d="M189.3,145.3 L157.8,70.3 L142,145.3 L99,145.3 L122.3,0 L146.8,0 L206.7,145.3 Z M139.5,26.3 L150.3,52.6 L135.3,52.6 Z"
    />
    <path d="M299.1,0 L236.4,145.3 L219.3,145.3 L159.8,0 L205.7,0 L243.3,90.8 L282.3,0 Z" />
    <path d="M391.4,0 L391.4,13.7 L351.3,13.7 L351.3,49.3 L391.4,49.3 L391.4,63.7 L351.3,63.7 L351.3,102.3 L391.4,102.3 L391.4,145.3 L309,145.3 L309,0 Z" />
    <path d="M451.3,81.7 L493.3,81.7 L493.3,95.3 L462.5,95.3 L458.1,109.5 A35.9,34.7 0 1 1 428.8,160.6 L440.4,150.9 A21,20.8 0 1 0 442.9,132.6 L438,131.8 Z" />
  </svg>
);

export default Logo;
