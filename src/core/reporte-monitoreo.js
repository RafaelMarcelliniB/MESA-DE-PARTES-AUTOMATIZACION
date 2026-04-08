const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

function normalizarTexto(valor) {
  return String(valor || "sin-codigo").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function fechaConsultaEs(fecha = new Date()) {
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ];

  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} de ${mes} de ${anio}`;
}

function nombreEvidencia(prefijo, codigo) {
  return `${prefijo}-${normalizarTexto(codigo)}.png`;
}

function nombreInforme(codigo) {
  return `${normalizarTexto(codigo)}-informe.pdf`;
}

function escaparHtml(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rutaRelativaDesdeDocs(rutaAbsolutaProyecto) {
  return path.posix.join("..", rutaAbsolutaProyecto.split(path.sep).join("/"));
}

async function imagenPngComoDataUri(rutaImagen) {
  const contenido = await fs.readFile(rutaImagen);
  return `data:image/png;base64,${contenido.toString("base64")}`;
}

async function generarReporteMonitoreo(resultados, opciones = {}) {
  const cwd = process.cwd();
  const rutaDocs = path.join(cwd, "docs");
  const rutaEvidencias = path.join(cwd, "tests", "evidencias");
  const rutaReporte = path.join(rutaDocs, "reporte-monitoreo.md");
  const fechaConsulta = opciones.fechaConsulta || fechaConsultaEs(new Date());

  await fs.mkdir(rutaDocs, { recursive: true });
  await fs.mkdir(rutaEvidencias, { recursive: true });

  const lineas = [
    "# Guía de Reporte de Monitoreo (INFOBRAS)",
    "",
    "## Pasos para realizar el Reporte de Monitoreo",
    ""
  ];

  resultados.forEach((resultado, indice) => {
    const numero = indice + 1;
    const codigo = resultado.codigoInfobras || "sin-codigo";
    const entidad = resultado.codigoEntidadNombre || "sin-entidad";

    const cap1 = rutaRelativaDesdeDocs(path.join("tests", "evidencias", nombreEvidencia("captura-01-datos-ejecucion", codigo)));
    const cap2 = rutaRelativaDesdeDocs(path.join("tests", "evidencias", nombreEvidencia("captura-02-avances-obra", codigo)));

    lineas.push(`### Registro ${numero}: Código INFOBRAS ${codigo}`);
    lineas.push("");
    lineas.push(`Entidad: ${entidad}`);
    lineas.push("");
    lineas.push("### PASO 1: Verificar en la sección de DATOS DE EJECUCIÓN");
    lineas.push("");
    lineas.push("Validar en el sistema INFOBRAS la sección **Datos de ejecución** de la ficha pública de la obra.");
    lineas.push("");
    lineas.push("**Nota:**");
    lineas.push("Verificar la **fecha de inicio** y **fecha de fin de ejecución de la obra** para confirmar si la actualización del registro de avance de obra está vigente.");
    lineas.push("");
    lineas.push("**Ojo:**");
    lineas.push("Realizar la **primera captura de pantalla** en esta sección.");
    lineas.push("");
    lineas.push(`![Captura 1 - Datos de ejecución - ${codigo}](${cap1})`);
    lineas.push("");
    lineas.push(`Fuente: https://infobras.contraloria.gob.pe/infobrasweb, consulta de fecha ${fechaConsulta}.`);
    lineas.push("");
    lineas.push("### PASO 2: Verificar el detalle de AVANCES DE OBRA");
    lineas.push("");
    lineas.push("En la sección de avances, revisar la tabla de periodos para confirmar:");
    lineas.push("");
    lineas.push("- Año y mes de avance.");
    lineas.push("- Avance físico programado.");
    lineas.push("- Avance físico real.");
    lineas.push("- Avance valorizado programado.");
    lineas.push("- Avance valorizado real.");
    lineas.push("- % de ejecución financiera.");
    lineas.push("- Monto de ejecución financiera.");
    lineas.push("- Estado.");
    lineas.push("");
    lineas.push("**Ojo:**");
    lineas.push("Abrir el botón **Ver detalle** y realizar la **segunda captura de pantalla** de la tabla.");
    lineas.push("");
    lineas.push(`![Captura 2 - Avances de obra - ${codigo}](${cap2})`);
    lineas.push("");
    lineas.push(`Fuente: https://infobras.contraloria.gob.pe/infobrasweb, consulta de fecha ${fechaConsulta}.`);
    lineas.push("");
    lineas.push("---");
    lineas.push("");
  });

  lineas.push("## Relación con la automatización actual");
  lineas.push("");
  lineas.push("La automatización vigente recorre esta ruta para cada código del CSV:");
  lineas.push("");
  lineas.push("1. Abrir INFOBRAS.");
  lineas.push("2. Ir a la búsqueda.");
  lineas.push("3. Buscar por código INFOBRAS.");
  lineas.push("4. Abrir ficha pública.");
  lineas.push("5. Entrar a Datos de ejecución.");
  lineas.push("6. Capturar evidencias y generar documento automáticamente.");
  lineas.push("");
  lineas.push("Archivo de datos de entrada usado por el flujo automatizado:");
  lineas.push("");
  lineas.push("- `src/input/codigos_infobras.csv`");

  await fs.writeFile(rutaReporte, lineas.join("\n"), "utf8");

  return {
    rutaReporte,
    rutaEvidencias
  };
}

function htmlInforme({ codigo, entidad, cap1DataUri, cap2DataUri, fechaConsulta }) {
  const tituloInforme = `${codigo} - INFOBRAS - Registro de avances mensuales (desactualizado)`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtml(tituloInforme)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 12px; line-height: 1.35; }
    h1, h2, h3 { margin: 0 0 8px; }
    h1 { font-size: 19px; text-transform: uppercase; letter-spacing: .2px; }
    h2 { font-size: 15px; margin-top: 18px; text-transform: uppercase; }
    h3 { font-size: 13px; margin-top: 16px; }
    .portada { border-top: 6px solid #d91c1c; padding-top: 14px; margin-bottom: 18px; }
    .marca { display: inline-block; background: #b30000; color: #fff; padding: 6px 12px; font-weight: 700; border-radius: 3px; margin-bottom: 10px; }
    .titulo { font-size: 20px; font-weight: 700; margin-top: 8px; }
    .subtitulo { font-size: 14px; font-weight: 700; margin-top: 4px; }
    .meta { margin: 14px 0 12px; padding: 10px 12px; background: #f3f3f3; border-left: 4px solid #b30000; }
    .seccion { margin-top: 10px; }
    .nota { margin: 8px 0; }
    .ojo { margin: 8px 0; }
    img { width: 100%; border: 1px solid #d6d6d6; border-radius: 4px; margin-top: 6px; }
    ul { margin: 6px 0 0 18px; }
    .fuente { margin-top: 6px; font-size: 11px; }
    .linea { height: 1px; background: #ddd; margin: 14px 0; }
  </style>
</head>
<body>
  <div class="portada">
    <div class="marca">INFORME</div>
    <div class="titulo">${escaparHtml(tituloInforme)}</div>
    <div class="subtitulo">Registro de avances mensuales</div>
  </div>
  <div class="meta"><strong>Codigo INFOBRAS:</strong> ${escaparHtml(codigo)}<br/><strong>Entidad:</strong> ${escaparHtml(entidad)}<br/><strong>Fuente principal:</strong> https://infobras.contraloria.gob.pe/infobrasweb</div>

  <div class="linea"></div>

  <h2>PASO 1: Verificar en la seccion de DATOS DE EJECUCION</h2>
  <div class="seccion">Validar en el sistema INFOBRAS la seccion <strong>Datos de ejecucion</strong> de la ficha publica de la obra.</div>
  <div class="nota"><strong>Nota:</strong> Verificar la <strong>fecha de inicio</strong> y <strong>fecha de fin de ejecucion de la obra</strong> para confirmar si la actualizacion del registro de avance de obra esta vigente.</div>
  <div class="ojo"><strong>Ojo:</strong> Realizar la <strong>primera captura de pantalla</strong> en esta seccion.</div>
  <img src="${cap1DataUri}" alt="Captura datos de ejecucion" />
  <div class="fuente">Fuente: https://infobras.contraloria.gob.pe/infobrasweb, consulta de fecha ${escaparHtml(fechaConsulta)}.</div>

  <h2>PASO 2: Verificar el detalle de AVANCES DE OBRA</h2>
  <div class="seccion">En la seccion de avances, revisar la tabla de periodos para confirmar:</div>
  <ul>
    <li>Ano y mes de avance.</li>
    <li>Avance fisico programado.</li>
    <li>Avance fisico real.</li>
    <li>Avance valorizado programado.</li>
    <li>Avance valorizado real.</li>
    <li>% de ejecucion financiera.</li>
    <li>Monto de ejecucion financiera.</li>
    <li>Estado.</li>
  </ul>
  <div class="ojo"><strong>Ojo:</strong> Abrir el boton <strong>Ver detalle</strong> y realizar la <strong>segunda captura de pantalla</strong> de la tabla.</div>
  <img src="${cap2DataUri}" alt="Captura avances de obra" />
  <div class="fuente">Fuente: https://infobras.contraloria.gob.pe/infobrasweb, consulta de fecha ${escaparHtml(fechaConsulta)}.</div>
</body>
</html>`;
}

async function generarInformesPdf(resultados, opciones = {}) {
  const cwd = process.cwd();
  const rutaInformes = path.join(cwd, "docs", "informes");
  const fechaConsulta = opciones.fechaConsulta || fechaConsultaEs(new Date());
  await fs.mkdir(rutaInformes, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const rutasPdf = [];

  try {
    for (const resultado of resultados) {
      const codigo = resultado.codigoInfobras || "sin-codigo";
      const entidad = resultado.codigoEntidadNombre || "sin-entidad";
      const cap1 = resultado.evidenciaDatosEjecucion || path.join(cwd, "tests", "evidencias", nombreEvidencia("captura-01-datos-ejecucion", codigo));
      const cap2 = resultado.evidenciaAvancesObra || path.join(cwd, "tests", "evidencias", nombreEvidencia("captura-02-avances-obra", codigo));
      const rutaPdf = path.join(rutaInformes, nombreInforme(codigo));
      const cap1DataUri = await imagenPngComoDataUri(cap1);
      const cap2DataUri = await imagenPngComoDataUri(cap2);

      const page = await context.newPage();
      await page.setContent(htmlInforme({ codigo, entidad, cap1DataUri, cap2DataUri, fechaConsulta }), {
        waitUntil: "networkidle"
      });

      await page.pdf({
        path: rutaPdf,
        format: "A4",
        printBackground: true,
        margin: {
          top: "16mm",
          right: "12mm",
          bottom: "16mm",
          left: "12mm"
        }
      });

      await page.close();
      rutasPdf.push(rutaPdf);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return {
    rutaInformes,
    rutasPdf
  };
}

module.exports = {
  generarReporteMonitoreo,
  generarInformesPdf,
  nombreEvidencia,
  nombreInforme
};
