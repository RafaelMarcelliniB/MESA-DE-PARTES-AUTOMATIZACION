const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");
const { InfobrasScreen } = require("../screens/infobras.screen");
const { readCsvFile } = require("../core/csv");

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
  const slowMo = Number(process.env.SLOW_MO || 0) || 0;
  const departamento = process.env.DEPARTAMENTO || process.argv[2] || "HUANUCO";

  const rutaCsv = path.join(
    process.cwd(),
    "tests",
    "evidencias",
    "extraccion-codigos",
    `${normalizarNombreArchivo(departamento)}.csv`
  );

  const salidaJson = path.join(
    process.cwd(),
    "tests",
    "evidencias",
    `stale-updates-${normalizarNombreArchivo(departamento)}.json`
  );

  return { headed, slowMo, departamento, rutaCsv, salidaJson };
}

async function main() {
  const { headed, slowMo, departamento, rutaCsv, salidaJson } = obtenerConfiguracionEntorno();

  const exists = await fs.stat(rutaCsv).then(() => true).catch(() => false);
  if (!exists) {
    console.error(`CSV no encontrado: ${rutaCsv}`);
    process.exit(1);
  }

  const registros = await readCsvFile(rutaCsv).catch((e) => {
    console.error("Error leyendo CSV:", e.message || e);
    return [];
  });

  const obrasEjecucion = registros.filter((r) => {
    const estado = String(r.estado_de_obra || "").toLowerCase();
    return estado.includes("ejec");
  });

  const browser = await chromium.launch({ headless: !headed, slowMo });
  const context = await browser.newContext();
  const page = await context.newPage();
  const screen = new InfobrasScreen(page);

  const desactualizadas = [];
  const ahora = Date.now();

  for (const obra of obrasEjecucion) {
    const codigo = String(obra.codigo_infobras || obra['codigo_infobras'] || obra['codigo infoBRAS'] || "").trim();
    const nombre = obra.nombre_de_la_obra || obra.nombre_de_la_obra || obra['nombre_de_la_obra'] || "";
    if (!codigo) continue;

    try {
      await screen.irAZonaBusqueda();
      await screen.buscarPorCodigoInfobras(codigo);
      await screen.abrirFichaPublica();

      const iso = await screen.extraerFechaUltimaActualizacion();
      let diffDays = null;
      if (iso) {
        const t = new Date(iso).getTime();
        diffDays = Math.floor((ahora - t) / (1000 * 60 * 60 * 24));
      }

      if (!iso || (diffDays !== null && diffDays > 30)) {
        desactualizadas.push({ codigo, nombre, ultima_actualizacion: iso || null, dias_desactualizado: diffDays });
      }
    } catch (e) {
      desactualizadas.push({ codigo, nombre, error: String(e.message || e) });
    } finally {
      await screen.cerrarFichaPublicaSiAplica().catch(() => {});
    }
  }

  await fs.mkdir(path.dirname(salidaJson), { recursive: true });
  await fs.writeFile(salidaJson, JSON.stringify({ departamento, generatedAt: new Date().toISOString(), stale: desactualizadas }, null, 2), "utf8");

  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  console.log(`Resultado guardado en: ${salidaJson}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
