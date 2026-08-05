const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");
const { InfobrasScreen } = require("../screens/infobras.screen");
const { ExtraccionCodigosFeature } = require("../features/extraccion-codigos");

function normalizarNombreArchivo(valor) {
  return String(valor || "departamento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "departamento";
}

function obtenerConfiguracionEntorno() {
  const headed = process.env.HEADED === "true";
  const slowMoValue = Number(process.env.SLOW_MO || 0);
  const slowMo = Number.isFinite(slowMoValue) && slowMoValue >= 0 ? slowMoValue : 0;
  const departamento = process.env.DEPARTAMENTO || process.argv[2] || "HUANUCO";
  const salidaPersonalizada = process.env.CSV_OUTPUT ? path.resolve(process.cwd(), process.env.CSV_OUTPUT) : null;
  const rutaSalida = salidaPersonalizada || path.join(
    process.cwd(),
    "tests",
    "evidencias",
    "extraccion-codigos",
    `${normalizarNombreArchivo(departamento)}.csv`
  );

  return { headed, slowMo, departamento, rutaSalida };
}

async function main() {
  const { headed, slowMo, departamento, rutaSalida } = obtenerConfiguracionEntorno();

  await fs.mkdir(path.dirname(rutaSalida), { recursive: true });

  const browser = await chromium.launch({
    headless: !headed,
    slowMo
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const screen = new InfobrasScreen(page);
  const feature = new ExtraccionCodigosFeature(screen);

  try {
    const resultado = await feature.ejecutarExtraccion({ departamento, rutaSalida });
    console.log(`[DOC] CSV generado en: ${resultado.rutaSalida}`);
    console.log(`[DOC] Departamento procesado: ${resultado.departamento}`);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});