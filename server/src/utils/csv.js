// CSV del catálogo (exportar e importar desde el panel). Pensado para abrirse con Excel en español:
// separador punto y coma, BOM UTF-8 delante (si no, Excel lee mal las tildes) y saltos de línea CRLF.
//
// Fórmulas: una celda de texto que empieza por =, +, -, @, tabulador o retorno de carro, Excel la
// ejecuta como fórmula al abrir el archivo ("inyección de CSV"). Al exportar se le pone delante un
// apóstrofo, que Excel no enseña, y al importar se le quita. Los números no se tocan.

const BOM = '﻿';
const SEPARADOR = ';';
const FIN_DE_LINEA = '\r\n';
const EMPIEZA_COMO_FORMULA = /^[=+\-@\t\r]/;

// Convierte un valor en el texto de su celda, con comillas si hace falta.
const celdaCsv = (valor) => {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  if (typeof valor === 'string' && EMPIEZA_COMO_FORMULA.test(texto)) texto = `'${texto}`;
  if (/[";\r\n]/.test(texto)) {
    texto = `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
};

// Arma el CSV completo: BOM, cabecera y una línea por fila. `columnas` es la lista de claves, en
// orden; cada fila es un objeto con esas claves.
const construirCsv = (columnas, filas) => {
  const lineas = [columnas.map(celdaCsv).join(SEPARADOR)];
  for (const fila of filas) {
    lineas.push(columnas.map((columna) => celdaCsv(fila[columna])).join(SEPARADOR));
  }
  return BOM + lineas.join(FIN_DE_LINEA) + FIN_DE_LINEA;
};

// Quita el apóstrofo que se pone al exportar delante de una celda que parecería una fórmula.
const quitarProteccionFormula = (texto) =>
  texto.length > 1 && texto[0] === "'" && EMPIEZA_COMO_FORMULA.test(texto.slice(1))
    ? texto.slice(1)
    : texto;

// Lee un CSV y devuelve una lista de filas, cada una una lista de celdas (texto). Admite comillas
// dobles (con "" dentro y saltos de línea dentro), BOM delante y finales de línea \n o \r\n. El
// separador se deduce de la primera línea: punto y coma si aparece alguno fuera de comillas, si no,
// coma (un CSV guardado desde Excel en inglés o desde Google Sheets). Las líneas vacías se saltan.
// Cada fila lleva también `linea`: el número de línea del archivo donde empieza (1 = cabecera), para
// poder decirle al usuario dónde está un error.
const parsearCsv = (texto) => {
  const contenido = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const separador = detectarSeparador(contenido);
  const filas = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;
  let linea = 1;
  let lineaInicioFila = 1;

  const cerrarCelda = () => {
    fila.push(quitarProteccionFormula(celda));
    celda = '';
  };
  const cerrarFila = () => {
    cerrarCelda();
    if (!(fila.length === 1 && fila[0] === ''))
      filas.push({ linea: lineaInicioFila, celdas: fila });
    fila = [];
  };

  for (let i = 0; i < contenido.length; i++) {
    const caracter = contenido[i];
    if (entreComillas) {
      if (caracter === '"') {
        if (contenido[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        if (caracter === '\n') linea++;
        celda += caracter;
      }
    } else if (caracter === '"' && celda === '') {
      entreComillas = true;
    } else if (caracter === separador) {
      cerrarCelda();
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && contenido[i + 1] === '\n') i++;
      cerrarFila();
      linea++;
      lineaInicioFila = linea;
    } else {
      celda += caracter;
    }
  }
  if (celda !== '' || fila.length > 0) cerrarFila();
  return filas;
};

const detectarSeparador = (contenido) => {
  let entreComillas = false;
  for (const caracter of contenido) {
    if (caracter === '"') entreComillas = !entreComillas;
    else if (!entreComillas && (caracter === '\n' || caracter === '\r')) break;
    else if (!entreComillas && caracter === SEPARADOR) return SEPARADOR;
  }
  return ',';
};

module.exports = { BOM, SEPARADOR, celdaCsv, construirCsv, parsearCsv };
