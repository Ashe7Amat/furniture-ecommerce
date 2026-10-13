// Acciones en lote del inventario (H12): borrar o cambiar el estado de varias piezas a la vez.
// Antes se avisaba de éxito sin mirar las respuestas; ahora se cuenta qué salió bien y qué no.

// Lanza `accion` para cada id a la vez y devuelve { hechos, fallidos }: cuántas fueron bien y los
// ids de las que fallaron. Falla la que devuelve null (contrato A de api.js) o la que lanza.
export const ejecutarLote = async (ids, accion) => {
  const resultados = await Promise.allSettled(ids.map(id => accion(id)));
  const fallidos = ids.filter((_, i) => resultados[i].status === 'rejected' || !resultados[i].value);
  return { hechos: ids.length - fallidos.length, fallidos };
};

// Lote a medias (texto de la decisión D-c de H12): cuantifica, sin dramatizar.
export const textoLoteAMedias = (hechos, total) => {
  const fallidos = total - hechos;
  return fallidos === 1
    ? `${hechos} de ${total} completados. El otro no se pudo procesar.`
    : `${hechos} de ${total} completados. Los otros ${fallidos} no se pudieron procesar.`;
};
