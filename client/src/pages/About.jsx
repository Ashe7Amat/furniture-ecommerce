import InfoPageLayout from '../components/InfoPageLayout';
import { BRAND } from '../theme/brand.config';

const About = () => {
  return (
    <InfoPageLayout eyebrow="Sobre Nosotros" title={BRAND.nombre} tagline={BRAND.eslogan}>
      <p>
        {`En el corazón del distrito industrial de ${BRAND.contacto.ciudad}, en un antiguo almacén reconvertido, nace `}<strong>{BRAND.nombre}</strong>. Nos definimos como un <em>almacén de ideas</em>, un espacio híbrido donde el diseño, la artesanía y la devoción por la historia se encuentran para dar una segunda vida al mobiliario excepcional.
      </p>
      <p>
        Nuestra pasión radica en el rescate y la recuperación activa de muebles vintage, maderas nobles y objetos singulares con alma. Piezas que han resistido el paso de las décadas y que, a menudo, quedan olvidadas en desvanes, talleres antiguos o fábricas abandonadas. Vemos la belleza en la pátina del tiempo, en las vetas desgastadas y en las uniones hechas a mano por maestros carpinteros de otra época.
      </p>

      <div className="info-pullquote">
        <p>&ldquo;No fabricamos muebles nuevos; rescatamos el carácter y el oficio del pasado para integrarlo con orgullo en los hogares contemporáneos.&rdquo;</p>
      </div>

      <p>
        Cada pieza que entra en nuestro taller es sometida a un cuidadoso proceso de restauración artesanal. Respetamos su autenticidad y su historia, saneando las estructuras mediante técnicas respetuosas con los materiales originales y aplicando acabados naturales como aceites orgánicos, cera de abejas y pigmentos ecológicos. El resultado son muebles únicos, cargados de carácter, listos para escribir un nuevo capítulo en tu espacio.
      </p>
      <p>
        {`${BRAND.nombre} no es solo una tienda de muebles; es un punto de encuentro para amantes del diseño slow, coleccionistas de tesoros y creadores que buscan inspiración. Te invitamos a sumergirte en nuestro catálogo y a compartir nuestra visión de un diseño más humano, histórico y respetuoso.`}
      </p>
    </InfoPageLayout>
  );
};

export default About;
