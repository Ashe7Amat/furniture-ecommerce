// Logotipo de Nave 5: "NAVE" en letras de plantilla (stencil) y un "5" pequeño abajo a la derecha.
// Redibujado en SVG a partir de la foto del rótulo, medido sobre ella. Toma el color del texto
// (currentColor), así que sigue al tema claro u oscuro. El nombre lo da el enlace que lo contiene.
const Logo = ({ className }) => (
  <svg
    className={className}
    viewBox="158 502 584 218"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M160,508 L213,508 L213,677 L160,677 Z M194.2,508 L214.2,508 L264,632.5 L264,677 L261.8,677 Z M241,508 L264,508 L264,677 L241,677 Z" />
    <path fillRule="evenodd" d="M302,508 L330.2,508 L399.8,677 L276,677 Z M321.8,534.5 L336.8,572 L316.2,572 Z M343,585 L379.8,677 L324.6,677 Z" />
    <path d="M346.2,508 L399.2,508 L443,617 L488.8,508 L507,508 L436,677 L415.6,677 Z" />
    <path d="M520,508 L616,508 L616,523 L568,523 L568,566 L616,566 L616,581 L568,581 L568,628 L616,628 L616,677 L520,677 Z" />
    <path d="M686.5,604 L736,604 L736,619 L686.5,619 Z M686.5,604 L702,604 L688.9,655 L673.9,655 Z" />
    <path d="M680.9,653.6 A31,31 0 1 1 671.3,689.6" fill="none" stroke="currentColor" strokeWidth="15" />
  </svg>
);

export default Logo;
