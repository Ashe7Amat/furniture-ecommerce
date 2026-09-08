import InfoPageLayout from '../components/InfoPageLayout';

const PrivacyPolicy = () => {
  return (
    <InfoPageLayout eyebrow="Legal" title="Política de Privacidad" tagline="Cómo tratamos tus datos personales">
      <div>
        <h2 className="info-subhead-divided">1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de tus datos personales es <strong>Nave 5 Barcelona S.L.</strong> (NIF B-00000000), con domicilio en Carrer del Plom, 32-34, interior, 08038 Barcelona. Puedes contactarnos en <strong>hola@nave5barcelona.com</strong> para cualquier consulta sobre esta política.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">2. Qué datos recopilamos</h2>
        <ul>
          <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña (almacenada siempre cifrada, nunca en texto plano).</li>
          <li><strong>Datos de pedido:</strong> dirección de entrega, teléfono de contacto y notas que nos indiques al comprar o alquilar una pieza.</li>
          <li><strong>Datos de pago:</strong> gestionados directamente por Stripe, nuestra pasarela de pago. Nave 5 Barcelona no ve ni almacena en ningún momento el número completo de tu tarjeta.</li>
          <li><strong>Datos de navegación:</strong> si aceptas las cookies de analítica, información agregada y anónima sobre cómo usas el sitio (páginas visitadas, dispositivo, procedencia).</li>
        </ul>
      </div>

      <div>
        <h2 className="info-subhead-divided">3. Para qué usamos tus datos</h2>
        <ul>
          <li>Crear y gestionar tu cuenta de usuario.</li>
          <li>Procesar tus compras y alquileres, incluida la comunicación necesaria con Stripe para el cobro.</li>
          <li>Enviarte confirmaciones de pedido y responder a tus consultas por el formulario de contacto.</li>
          <li>Mejorar el sitio web mediante estadísticas de uso agregadas, únicamente si has aceptado las cookies de analítica.</li>
        </ul>
      </div>

      <div>
        <h2 className="info-subhead-divided">4. Base legal</h2>
        <p>
          Tratamos tus datos de cuenta y de pedido porque son necesarios para ejecutar el contrato de compraventa o alquiler que formalizas con nosotros. Las cookies de analítica se instalan únicamente con tu consentimiento previo, que puedes retirar en cualquier momento desde el propio banner de cookies.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">5. Con quién compartimos tus datos</h2>
        <p>
          No vendemos ni cedemos tus datos a terceros con fines comerciales. Compartimos únicamente los datos estrictamente necesarios con los proveedores que nos permiten operar el servicio, todos ellos actuando como encargados del tratamiento bajo sus propias garantías de seguridad:
        </p>
        <ul>
          <li><strong>Stripe</strong> — procesamiento seguro de pagos.</li>
          <li><strong>Supabase</strong> — alojamiento de la base de datos y las imágenes del catálogo.</li>
          <li><strong>Resend</strong> — envío de correos transaccionales (confirmación de pedido, bienvenida).</li>
        </ul>
      </div>

      <div>
        <h2 className="info-subhead-divided">6. Cuánto tiempo conservamos tus datos</h2>
        <p>
          Conservamos los datos de tu cuenta mientras permanezca activa. Los datos de cada pedido se conservan durante el tiempo exigido por la normativa fiscal y de consumo aplicable. Puedes solicitar la eliminación de tu cuenta en cualquier momento; conservaremos únicamente lo que la ley nos obligue a retener.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">7. Tus derechos</h2>
        <p>
          Tienes derecho a acceder, rectificar, limitar y solicitar la supresión de tus datos personales, así como a la portabilidad y a oponerte a su tratamiento, enviando un correo a <strong>hola@nave5barcelona.com</strong>. También puedes reclamar ante la Agencia Española de Protección de Datos (AEPD) si consideras que no hemos atendido correctamente tu solicitud.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">8. Seguridad</h2>
        <p>
          Todo el tráfico entre tu navegador y nuestros servidores viaja cifrado mediante HTTPS. Las contraseñas se almacenan siempre con un algoritmo de hash seguro y nunca en texto plano.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">9. Cambios en esta política</h2>
        <p>
          Podemos actualizar esta política para reflejar cambios legales o en el funcionamiento del sitio. Publicaremos siempre la versión vigente en esta misma página.
        </p>
      </div>
    </InfoPageLayout>
  );
};

export default PrivacyPolicy;
