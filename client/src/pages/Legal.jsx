import React from 'react';
import InfoPageLayout from '../components/InfoPageLayout';

const Legal = () => {
  return (
    <InfoPageLayout eyebrow="Legal" title="Aviso Legal y Privacidad" tagline="Términos de servicio y uso">
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
        <h2 className="info-subhead-divided">2. Propiedad Intelectual y Uso del Sitio Web</h2>
        <p>
          El sitio web y sus contenidos originales, incluyendo textos, diseños gráficos, logotipos, imágenes y código fuente, son propiedad exclusiva de <strong>Nave 5 Barcelona</strong> y están protegidos por las leyes internacionales de propiedad intelectual y marcas.
        </p>
        <p style={{ marginTop: '10px' }}>
          El usuario se compromete a realizar un uso diligente y lícito de este sitio web. Queda prohibida la reproducción, distribución, comunicación pública o transformación no autorizada de cualquiera de sus elementos sin el consentimiento explícito y por escrito de sus titulares.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">3. Política de Privacidad (RGPD)</h2>
        <p>
          De conformidad con el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016 (RGPD), y la Ley Orgánica 3/2018 (LOPDGDD), informamos que los datos recabados en nuestros formularios se tratarán bajo la responsabilidad de Nave 5 Barcelona S.L. con la única finalidad de gestionar sus solicitudes de información, pedidos y citas personalizadas.
        </p>
        <p style={{ marginTop: '10px' }}>
          Sus datos no serán cedidos a terceros salvo obligación legal y se conservarán mientras dure la relación comercial o durante los años necesarios para cumplir con las obligaciones legales correspondientes. El usuario tiene derecho a acceder, rectificar, limitar y solicitar la supresión de sus datos personales enviando un correo electrónico a <strong>hola@nave5barcelona.com</strong>.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">4. Limitación de Responsabilidad</h2>
        <p>
          Nave 5 Barcelona no se hace responsable de los posibles daños o perjuicios que puedan derivarse de interferencias, omisiones, interrupciones, virus informáticos o desconexiones en el funcionamiento operativo de este sistema electrónico, motivados por causas ajenas al titular.
        </p>
      </div>
    </InfoPageLayout>
  );
};

export default Legal;
