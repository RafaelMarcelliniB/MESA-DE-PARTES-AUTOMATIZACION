const path = require("path");
const { chromium } = require("playwright");
const { readCsvFile } = require("../core/csv");
const { generarReporteMonitoreo, generarInformesPdf } = require("../core/reporte-monitoreo");
const { VerificacionFeature } = require("../features/verificacion");
const { InfobrasScreen } = require("../screens/infobras.screen");

function obtenerConfiguracionEntorno() {
  const headed = process.env.HEADED === "true";
  const slowMoValue = Number(process.env.SLOW_MO || 0);
  const slowMo = Number.isFinite(slowMoValue) && slowMoValue >= 0 ? slowMoValue : 0;
  const csvInput = process.env.CSV_INPUT
    ? path.resolve(process.cwd(), process.env.CSV_INPUT)
    : path.join(process.cwd(), "src", "input", "codigos_infobras.csv");

  return { headed, slowMo, csvInput };
}

async function ejecutar() {
  const { headed, slowMo, csvInput } = obtenerConfiguracionEntorno();
  const fechaConsulta = new Date();
  const registros = await readCsvFile(csvInput);

  if (!Array.isArray(registros) || registros.length === 0) {
    throw new Error(`No hay registros para procesar en ${csvInput}`);
  }

  const browser = await chromium.launch({
    headless: !headed,
    slowMo
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  const screen = new InfobrasScreen(page);
  const feature = new VerificacionFeature(screen);
  const resultados = [];

  try {
    for (const registro of registros) {
      console.log(`[STEP] Procesando codigo ${registro.codigo_infobras}`);
      const resultado = await feature.ejecutarRegistro(registro);
      resultados.push(resultado);
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const opcionesGeneracion = { fechaConsulta };
  const { rutaReporte } = await generarReporteMonitoreo(resultados, opcionesGeneracion);
  const { rutaInformes, rutasPdf } = await generarInformesPdf(resultados, opcionesGeneracion);

  console.log(`[DOC] Reporte generado en: ${rutaReporte}`);
  console.log(`[DOC] Informes PDF generados en: ${rutaInformes}`);
  console.log(`[DOC] Total PDFs: ${rutasPdf.length}`);
}

if (require.main === module) {
  ejecutar().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { ejecutar };
