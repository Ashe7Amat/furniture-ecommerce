import { Link } from 'react-router-dom';
import InfoPageLayout from '../components/InfoPageLayout';

const Legal = () => {
  return (
    <InfoPageLayout eyebrow="Legal" title="Aviso Legal" tagline="Identificación y condiciones de uso del sitio">
      <div>
        <h2 className="info-subhead-divided">1. Información General</h2>
        <p>
          En cumplimiento del deber de información contemplado en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se facilitan a continuación los siguientes datos identificativos del titular del sitio web:
        </p>
        <ul>
          <li><strong>Denominación Social:</strong> Nave 5 Barcelona S.L.</li>
          <li><strong>NIF:</strong> B-00000000</li>
          <li><strong>Domicilio Social:</strong> Carrer del Plom, 32-34, interior, 08038 Barcelona</li>
          <li><strong>Contacto:</strong> hola@nave5barcelona.com</li>
        </ul>
      </div>

      <div>
        <h2 className="info-subhead-divided">2. Objeto del sitio web</h2>
        <p>
          Este sitio web permite consultar el catálogo de piezas restauradas de Nave 5 Barcelona, gestionar una cuenta de usuario y formalizar la compra o el alquiler de piezas disponibles. Las condiciones específicas de cada operación se detallan en nuestros{' '}
          <Link to="/terminos">Términos y Condiciones</Link>, y el tratamiento de los datos personales en nuestra{' '}
          <Link to="/privacidad">Política de Privacidad</Link>.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">3. Limitación de Responsabilidad</h2>
        <p>
          Nave 5 Barcelona no se hace responsable de los posibles daños o perjuicios que puedan derivarse de interferencias, omisiones, interrupciones, virus informáticos o desconexiones en el funcionamiento operativo de este sistema electrónico, motivados por causas ajenas al titular.
        </p>
      </div>
    </InfoPageLayout>
  );
};

export default Legal;
