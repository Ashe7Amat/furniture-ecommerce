import InfoPageLayout from '../components/InfoPageLayout';

const Sustainability = () => {
  return (
    <InfoPageLayout eyebrow="Compromiso" title="Sostenibilidad y Restauración" tagline="Diseño con impacto positivo">
      <p>
        Creemos firmemente que el mueble más sostenible del planeta es aquel que <strong>ya existe</strong>. En una era dominada por la producción en masa acelerada y el consumo de usar y tirar (fast-furniture), en <strong>Nave 5 Barcelona</strong> apostamos por una alternativa consciente y de impacto positivo a través de la economía circular y la restauración consciente.
      </p>
      <p>
        La fabricación masiva de mobiliario moderno genera una alta huella de carbono, impulsando la deforestación de bosques sensibles y el uso intensivo de colas plásticas y aglomerados que no se pueden reciclar. Nuestro enfoque es diametralmente opuesto: buscamos, recuperamos y restauramos piezas que ya han superado la prueba del tiempo. Al hacerlo, evitamos la demanda de nuevos recursos naturales y rescatamos la energía, el agua y la madera ya invertidas en su día.
      </p>

      <div className="info-pullquote">
        <p>&ldquo;Cada mueble restaurado en nuestro taller representa una victoria directa contra el olvido y una huella ecológica evitada.&rdquo;</p>
      </div>

      <h2>Nuestros Pilares Ecológicos</h2>

      <ul>
        <li>
          <strong>Economía Circular Activa:</strong> Reintroducimos piezas antiguas en el mercado dándoles un nuevo sentido estético e higienizándolas para que duren otra generación.
        </li>
        <li>
          <strong>Procesos y Materiales Limpios:</strong> En nuestro taller utilizamos únicamente ceras naturales de abejas, aceites minerales respetuosos con el medio ambiente y pinturas a base de agua con bajos compuestos orgánicos volátiles (COVs).
        </li>
        <li>
          <strong>Recuperación de Madera Noble:</strong> Priorizamos la restauración de muebles hechos con maderas macizas como el roble, el nogal, el castaño y la teca, materiales de una calidad imposible de encontrar en el mobiliario genérico actual.
        </li>
        <li>
          <strong>Diseño Atemporal:</strong> Al huir de modas efímeras, seleccionamos piezas cuyo diseño y presencia arquitectónica trascienden tendencias pasajeras, asegurando que sigan resultando hermosas y funcionales durante décadas.
        </li>
      </ul>

      <p>
        Consumir diseño sostenible en Nave 5 Barcelona es una declaración de intenciones. Significa valorar el oficio del artesano, preferir la autenticidad frente a la uniformidad y entender que el confort en el hogar puede y debe convivir en perfecta armonía con el cuidado de nuestro planeta.
      </p>
    </InfoPageLayout>
  );
};

export default Sustainability;
