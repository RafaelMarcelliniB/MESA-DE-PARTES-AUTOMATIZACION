const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");
const { InfobrasScreen } = require("../screens/infobras.screen");
const { readCsvFile } = require("../core/csv");
const { generarInformesPdf, nombreEvidencia, nombreInforme } = require("../core/reporte-monitoreo");

const RUTA_MANIFEST = path.join(process.cwd(), "docs", "informes", "incumplimientos-manifest.json");

function normalizarNombreArchivo(valor) {
  return String(valor || "departamento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "departamento";
}

function normalizarEstado(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Comparación exacta (no substring) para no atrapar "Sin Ejecución" dentro de "Ejecución".
function esObraEnEjecucion(estado) {
  return normalizarEstado(estado) === "en ejecucion";
}

function obtenerConfiguracionEntorno() {
  const headed = process.env.HEADED === "true";
  const slowMo = Number(process.env.SLOW_MO || 0) || 0;
  const departamento = process.env.DEPARTAMENTO || process.argv[2] || "HUANUCO";
  const diasPlazo = Number(process.env.DIAS_PLAZO || 30) || 30;

  const rutaCsv = path.join(
    process.cwd(),
    "tests",
    "evidencias",
    "extraccion-codigos",
    `${normalizarNombreArchivo(departamento)}.csv`
  );

  return { headed, slowMo, departamento, diasPlazo, rutaCsv };
}

async function leerManifest() {
  try {
    const contenido = await fs.readFile(RUTA_MANIFEST, "utf8");
    const data = JSON.parse(contenido);
    return Array.isArray(data.incumplimientos) ? data.incumplimientos : [];
  } catch {
    return [];
  }
}

async function guardarManifest(entradas) {
  await fs.mkdir(path.dirname(RUTA_MANIFEST), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    incumplimientos: entradas
  };
  await fs.writeFile(RUTA_MANIFEST, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  const { headed, slowMo, departamento, diasPlazo, rutaCsv } = obtenerConfiguracionEntorno();

  const existeCsv = await fs.stat(rutaCsv).then(() => true).catch(() => false);
  if (!existeCsv) {
    console.error(`CSV no encontrado: ${rutaCsv}. Ejecuta primero la extracción del departamento.`);
    process.exit(1);
  }

  const registros = await readCsvFile(rutaCsv).catch((e) => {
    console.error("Error leyendo CSV:", e.message || e);
    return [];
  });

  const obrasEnEjecucion = registros.filter((r) => esObraEnEjecucion(r.estado_de_obra));
  console.log(`[STEP] ${obrasEnEjecucion.length} obra(s) en ejecución en ${departamento} (de ${registros.length} registros totales).`);

  const rutaEvidencias = path.join(process.cwd(), "tests", "evidencias");
  await fs.mkdir(rutaEvidencias, { recursive: true });

  const browser = await chromium.launch({ headless: !headed, slowMo });
  const context = await browser.newContext();
  const page = await context.newPage();
  const screen = new InfobrasScreen(page);

  const incumplimientos = [];
  const ahora = Date.now();
  const fechaConsulta = new Date();

  for (const obra of obrasEnEjecucion) {
    const codigo = String(obra.codigo_infobras || "").trim();
    const nombre = obra.nombre_de_la_obra || "";
    if (!codigo) continue;

    console.log(`[STEP] Verificando código ${codigo} - ${nombre}`);

    try {
      await screen.irAZonaBusqueda();
      await screen.buscarPorCodigoInfobras(codigo);
      await screen.abrirFichaPublica();

      const iso = await screen.extraerFechaUltimaActualizacion();
      let diasSinActualizar = null;
      if (iso) {
        diasSinActualizar = Math.floor((ahora - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
      }

      const alDia = iso !== null && diasSinActualizar !== null && diasSinActualizar <= diasPlazo;

      if (!alDia) {
        console.log(`[STEP] ${codigo}: NO está al día (${iso ? `${diasSinActualizar} días sin actualizar` : "sin fecha registrada"}). Capturando evidencias...`);

        // Solo se capturan evidencias (y por lo tanto solo se genera PDF) para las
        // obras que incumplen el plazo; las que están al día se saltan sin captura.
        const evidenciaDatosEjecucion = path.join(rutaEvidencias, nombreEvidencia("captura-01-datos-ejecucion", codigo));
        const evidenciaAvancesObra = path.join(rutaEvidencias, nombreEvidencia("captura-02-avances-obra", codigo));

        await screen.irADatosEjecucion();
        await screen.capturarDatosEjecucion(evidenciaDatosEjecucion);
        await screen.capturarAvancesObra(evidenciaAvancesObra);

        incumplimientos.push({
          codigoInfobras: codigo,
          codigoEntidadNombre: `Departamento ${departamento}`,
          nombreObra: nombre,
          departamento,
          ultimaActualizacion: iso,
          diasSinActualizar,
          umbralDias: diasPlazo,
          evidenciaDatosEjecucion,
          evidenciaAvancesObra
        });
      } else {
        console.log(`[STEP] ${codigo}: al día (${diasSinActualizar} días sin actualizar, umbral ${diasPlazo}).`);
      }
    } catch (e) {
      console.error(`[STEP] Error verificando ${codigo}: ${e.message || e}`);
    } finally {
      await screen.cerrarFichaPublicaSiAplica().catch(() => {});
    }
  }

  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  let nuevasEntradasManifest = [];

  if (incumplimientos.length > 0) {
    console.log(`[STEP] Generando ${incumplimientos.length} PDF(s) de incumplimiento...`);
    const { rutasPdf } = await generarInformesPdf(incumplimientos, { fechaConsulta });

    nuevasEntradasManifest = incumplimientos.map((item, indice) => ({
      codigo: item.codigoInfobras,
      nombreObra: item.nombreObra,
      departamento: item.departamento,
      ultimaActualizacion: item.ultimaActualizacion,
      diasSinActualizar: item.diasSinActualizar,
      umbralDias: item.umbralDias,
      generadoEn: new Date().toISOString(),
      archivoPdf: path.basename(rutasPdf[indice] || nombreInforme(item.codigoInfobras))
    }));
  }

  // Reemplaza solo las entradas de este departamento (y solo las de códigos que
  // volvieron a verificarse en esta corrida); conserva intactas las de los demás.
  const manifestPrevio = await leerManifest();
  const codigosVerificados = new Set(obrasEnEjecucion.map((o) => String(o.codigo_infobras || "").trim()));
  const entradasQueSeConservan = manifestPrevio.filter((entrada) => {
    if (entrada.departamento !== departamento) return true;
    return !codigosVerificados.has(entrada.codigo);
  });

  await guardarManifest([...entradasQueSeConservan, ...nuevasEntradasManifest]);

  console.log(`[DOC] Verificación completada: ${incumplimientos.length} obra(s) sin documentación al día en ${departamento}.`);
  console.log(`[DOC] Manifiesto actualizado en: ${RUTA_MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
