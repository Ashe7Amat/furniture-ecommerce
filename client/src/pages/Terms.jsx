import InfoPageLayout from '../components/InfoPageLayout';

const Terms = () => {
  return (
    <InfoPageLayout eyebrow="Legal" title="Términos y Condiciones" tagline="Condiciones de compra y alquiler">
      <div>
        <h2 className="info-subhead-divided">1. Objeto y aceptación</h2>
        <p>
          Estas condiciones regulan la compra y el alquiler de piezas a través de nave5barcelona.com, operado por Nave 5 Barcelona S.L. Al finalizar un pedido aceptas expresamente estas condiciones.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">2. Las piezas</h2>
        <p>
          Cada pieza de nuestro catálogo es una unidad única, restaurada a mano, y puede presentar marcas propias de su historia (pátina, pequeñas imperfecciones) que forman parte de su carácter y se muestran en las fotografías. Al ser piezas únicas, la disponibilidad mostrada en el catálogo puede agotarse en cualquier momento; si compras una pieza que se ha vendido por otra vía justo antes de confirmar tu pedido, te lo notificaremos y te devolveremos el importe íntegro.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">3. Precios y pago</h2>
        <p>
          Los precios mostrados en el catálogo incluyen IVA. El pago se realiza de forma segura a través de Stripe en el momento de confirmar el pedido; Nave 5 Barcelona no almacena en ningún momento los datos completos de tu tarjeta.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">4. Alquiler de piezas</h2>
        <p>
          Algunas piezas están disponibles también en modalidad de alquiler por días, al precio indicado en su ficha. Durante el periodo de alquiler la pieza sigue siendo propiedad de Nave 5 Barcelona; te pedimos devolverla en el mismo estado en que la recibiste, salvo el desgaste normal por el uso.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">5. Envíos</h2>
        <p>
          Enviamos a la dirección que indiques al finalizar el pedido. Al tratarse de mobiliario, los plazos y el transporte se coordinan de forma personalizada por correo electrónico tras la compra.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">6. Derecho de desistimiento</h2>
        <p>
          Si compras como consumidor particular dispones de 14 días naturales desde la recepción de la pieza para desistir de la compra sin necesidad de justificación, conforme a la normativa española de consumo. Para ejercerlo, escríbenos a <strong>hola@nave5barcelona.com</strong>. La pieza debe devolverse en el mismo estado en que se entregó; los gastos de devolución corren a cargo del comprador salvo que la pieza no coincidiera con lo descrito.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">7. Propiedad intelectual</h2>
        <p>
          El sitio web y sus contenidos originales, incluyendo textos, diseños gráficos, logotipos, imágenes y código fuente, son propiedad exclusiva de Nave 5 Barcelona y están protegidos por las leyes internacionales de propiedad intelectual y marcas. Queda prohibida la reproducción, distribución, comunicación pública o transformación no autorizada de cualquiera de sus elementos sin el consentimiento explícito y por escrito de sus titulares.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">8. Tu cuenta</h2>
        <p>
          Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta. Avísanos de inmediato si sospechas un uso no autorizado.
        </p>
      </div>

      <div>
        <h2 className="info-subhead-divided">9. Ley aplicable y jurisdicción</h2>
        <p>
          Estas condiciones se rigen por la legislación española. Cualquier controversia se someterá a los juzgados y tribunales de Barcelona, sin perjuicio de los derechos que la normativa de consumo reconozca al comprador como consumidor.
        </p>
      </div>
    </InfoPageLayout>
  );
};

export default Terms;
