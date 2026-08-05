const assert = require("assert/strict");
const path = require("path");
const { Given, When, Then } = require("@cucumber/cucumber");
const { readCsvFile } = require("../core/csv");
const { generarReporteMonitoreo, generarInformesPdf } = require("../core/reporte-monitoreo");
const { VerificacionFeature } = require("../features/verificacion");
const { InfobrasScreen } = require("../screens/infobras.screen");

Given('cargo los códigos asignados desde {string}', async function (csvRelativePath) {
  const csvPath = path.resolve(process.cwd(), csvRelativePath);
  this.registros = await readCsvFile(csvPath);
});

When('ejecuto la verificación para cada registro', async function () {
  const screen = new InfobrasScreen(this.page);
  const feature = new VerificacionFeature(screen);
  this.resultados = [];

  for (const registro of this.registros) {
    const resultado = await feature.ejecutarRegistro(registro);
    this.resultados.push(resultado);
  }
});

Then('todas las obras deben completar la ruta de verificación', async function () {
  assert.ok(Array.isArray(this.resultados));
  assert.ok(this.resultados.length > 0);
  assert.ok(this.resultados.every((resultado) => resultado.completado === true));

  const opcionesGeneracion = { fechaConsulta: this.fechaConsulta };
  const { rutaReporte } = await generarReporteMonitoreo(this.resultados, opcionesGeneracion);
  const { rutaInformes, rutasPdf } = await generarInformesPdf(this.resultados, opcionesGeneracion);
  console.log(`[DOC] Reporte generado en: ${rutaReporte}`);
  console.log(`[DOC] Informes PDF generados en: ${rutaInformes}`);
  console.log(`[DOC] Total PDFs: ${rutasPdf.length}`);
});
