import { URL_COMO_LLEGAR } from '../utils/direccion';

// Pin de localización + «Cómo llegar», que abre la dirección en Google Maps en otra pestaña.
const EnlaceComoLlegar = ({ className = '' }) => (
  <a
    href={URL_COMO_LLEGAR}
    target="_blank"
    rel="noopener noreferrer"
    className={`enlace-como-llegar ${className}`.trim()}
    aria-label="Cómo llegar: ver la dirección en Google Maps (se abre en otra pestaña)"
  >
    <svg className="enlace-como-llegar-pin" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
      />
    </svg>
    Cómo llegar
  </a>
);

export default EnlaceComoLlegar;
