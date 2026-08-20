const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const { parseCsvLine } = require("../core/csv");

const PORT = Number(process.env.APP_PORT || 3080);
const PUBLIC_DIR = path.join(__dirname, "public");
const jobs = new Map();

// 25 departamentos del Perú
const DEPARTAMENTOS = [
  "AMAZONAS", "ANCASH", "APURÍMAC", "AREQUIPA", "AYACUCHO",
  "CAJAMARCA", "CALLAO", "CUSCO", "HUANCAVELICA", "HUÁNUCO",
  "ICA", "JUNÍN", "LA LIBERTAD", "LAMBAYEQUE", "LIMA",
  "LORETO", "MADRE DE DIOS", "MOQUEGUA", "PASCO", "PIURA",
  "PUNO", "SAN MARTÍN", "TACNA", "TUMBES", "UCAYALI"
];

// Estado del scheduler
let bulkExtractionGroup = null;
let schedulerConfig = {
  enabled: false,
  hour: 0,
  minute: 0,
  intervalId: null,
  lastRun: null,
  nextRun: null
};

function uuidSimple() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const content = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(content);
}

function parseBool(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return fallback;
}

function parseNonNegativeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function serializeJob(job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    exitCode: job.exitCode,
    params: job.params,
    logs: job.logs.slice(-300)
  };
}

function pushLog(job, text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.length > 0);
  for (const line of lines) {
    job.logs.push(line);
  }
  if (job.logs.length > 1000) {
    job.logs = job.logs.slice(-1000);
  }
}

function spawnJob({ type, commandArgs, env, params }) {
  const id = uuidSimple();
  const startedAt = new Date().toISOString();
  const job = {
    id,
    type,
    status: "running",
    startedAt,
    endedAt: null,
    exitCode: null,
    params,
    logs: []
  };

  jobs.set(id, job);

  const child = spawn(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  pushLog(job, `[APP] Proceso iniciado: ${process.execPath} ${commandArgs.join(" ")}`);

  child.stdout.on("data", (chunk) => {
    pushLog(job, chunk.toString("utf8"));
  });

  child.stderr.on("data", (chunk) => {
    pushLog(job, chunk.toString("utf8"));
  });

  child.on("close", (code) => {
    job.status = code === 0 ? "completed" : "failed";
    job.exitCode = code;
    job.endedAt = new Date().toISOString();
    pushLog(job, `[APP] Proceso finalizado con codigo ${code}`);
  });

  child.on("error", (error) => {
    job.status = "failed";
    job.exitCode = -1;
    job.endedAt = new Date().toISOString();
    pushLog(job, `[APP] Error al iniciar proceso: ${error.message}`);
  });

  return serializeJob(job);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extrae todos los departamentos con carga controlada
async function startBulkExtraction(headed = false, slowMo = 300) {
  const groupId = uuidSimple();
  bulkExtractionGroup = {
    groupId,
    status: "running",
    createdAt: new Date().toISOString(),
    totalDepartamentos: DEPARTAMENTOS.length,
    completedDepartamentos: 0,
    failedDepartamentos: 0,
    jobIds: []
  };

  const maxParallel = Number(process.env.BULK_PARALLEL || 1);

  // Ejecutar con baja concurrencia para evitar saturar CPU/RAM
  for (let i = 0; i < DEPARTAMENTOS.length; i += maxParallel) {
    const batch = DEPARTAMENTOS.slice(i, i + maxParallel);
    const promises = batch.map((departamento) => {
      const job = spawnJob({
        type: "extract",
        commandArgs: [path.join("src", "run", "extraccion-codigos.js")],
        env: {
          HEADED: String(headed),
          SLOW_MO: String(slowMo),
          DEPARTAMENTO: departamento
        },
        params: { departamento, headed, slowMo, groupId }
      });

      bulkExtractionGroup.jobIds.push(job.id);

      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const jobData = jobs.get(job.id);
          if (jobData && jobData.status !== "running") {
            clearInterval(checkInterval);
            if (jobData.exitCode === 0) {
              bulkExtractionGroup.completedDepartamentos++;
            } else {
              bulkExtractionGroup.failedDepartamentos++;
            }
            resolve();
          }
        }, 500);
      });
    });

    await Promise.all(promises);

    if (i + maxParallel < DEPARTAMENTOS.length) {
      await delay(Number(process.env.BULK_PAUSE_MS || 1000));
    }
  }

  bulkExtractionGroup.status = "completed";
}

// Configura el scheduler de extracción
function setupScheduler(hour, minute) {
  // Cancelar scheduler anterior si existe
  if (schedulerConfig.intervalId) {
    clearInterval(schedulerConfig.intervalId);
  }

  schedulerConfig.hour = hour;
  schedulerConfig.minute = minute;
  schedulerConfig.enabled = true;

  // Función para chequear cada minuto si es hora de ejecutar
  const checkAndRun = async () => {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === minute) {
      console.log(`[SCHEDULER] Ejecutando extracción de todos los departamentos a las ${hour}:${String(minute).padStart(2, '0')}`);
      await startBulkExtraction(false, 300);
      schedulerConfig.lastRun = new Date().toISOString();
      updateNextRun();
    }
  };

  // Chequear cada minuto
  schedulerConfig.intervalId = setInterval(checkAndRun, 60000);
  updateNextRun();
}

// Calcula la próxima ejecución
function updateNextRun() {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(schedulerConfig.hour, schedulerConfig.minute, 0, 0);

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  schedulerConfig.nextRun = nextRun.toISOString();
}

async function serveStatic(req, res) {
  let pathname = req.url.split("?")[0];
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const target = path.join(PUBLIC_DIR, pathname);
  if (!target.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Ruta no permitida" });
    return;
  }

  let content;
  try {
    content = await fs.readFile(target);
  } catch {
    sendJson(res, 404, { error: "Archivo no encontrado" });
    return;
  }

  const contentType = target.endsWith(".html")
    ? "text/html; charset=utf-8"
    : target.endsWith(".css")
      ? "text/css; charset=utf-8"
      : target.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/jobs") {
    const payload = Array.from(jobs.values())
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
      .map(serializeJob);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const id = url.pathname.split("/").pop();
    const job = jobs.get(id);
    if (!job) {
      sendJson(res, 404, { error: "Job no encontrado" });
      return;
    }
    sendJson(res, 200, serializeJob(job));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/csv-data") {
    try {
      const departamento = url.searchParams.get("departamento") || "HUÁNUCO";
      const csvDir = path.join(__dirname, "..", "..", "tests", "evidencias", "extraccion-codigos");
      const files = await fs.readdir(csvDir);
      
      // Find CSV file for department (normalize name)
      const normalizedDept = String(departamento)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "");
      let csvFiles = files.filter(f => f.endsWith(".csv"));
      
      // Try to find specific department CSV
      let csvFile = csvFiles.find(f => String(f)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes(normalizedDept));
      
      // Fallback to most recent if not found
      if (!csvFile) {
        csvFiles = csvFiles.sort().reverse();
        csvFile = csvFiles[0];
      }
      
      if (!csvFile) {
        sendJson(res, 404, { error: "No CSV files found", data: [] });
        return;
      }

      const csvPath = path.join(csvDir, csvFile);
      const content = await fs.readFile(csvPath, "utf-8");
      const lines = content.trim().split("\n");
      
      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const record = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || "";
        });

        return record;
      });

      // Calculate statistics
      const estadoCount = {};
      const modalidadCount = {};
      let totalMonto = 0;
      let recordsWithMonto = 0;

      rows.forEach(row => {
        const estado = row["Estado de obra"] || "Sin estado";
        estadoCount[estado] = (estadoCount[estado] || 0) + 1;
        
        const modalidad = row["Modalidad de ejecución"] || "Sin modalidad";
        modalidadCount[modalidad] = (modalidadCount[modalidad] || 0) + 1;
        
        const monto = parseFloat(row["Monto Expediente Técnico"]);
        if (!isNaN(monto)) {
          totalMonto += monto;
          recordsWithMonto++;
        }
      });

      const stats = {
        totalRecords: rows.length,
        totalMonto: totalMonto.toFixed(2),
        promediaMonto: (totalMonto / (recordsWithMonto || 1)).toFixed(2),
        estado: estadoCount,
        modalidad: modalidadCount,
        csvFile: csvFile
      };

      sendJson(res, 200, { data: rows, stats });
      return;
    } catch (error) {
      sendJson(res, 500, { error: error.message, data: [] });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/extract") {
    const body = await readBody(req).catch(() => null);
    if (!body) {
      sendJson(res, 400, { error: "JSON invalido" });
      return;
    }

    const departamento = String(body.departamento || "HUANUCO").trim() || "HUANUCO";
    const headed = parseBool(body.headed, false);
    const slowMo = parseNonNegativeNumber(body.slowMo, 300);
    const csvOutput = body.csvOutput ? String(body.csvOutput).trim() : "";

    const job = spawnJob({
      type: "extract",
      commandArgs: [path.join("src", "run", "extraccion-codigos.js")],
      env: {
        HEADED: String(headed),
        SLOW_MO: String(slowMo),
        DEPARTAMENTO: departamento,
        ...(csvOutput ? { CSV_OUTPUT: csvOutput } : {})
      },
      params: { departamento, headed, slowMo, csvOutput }
    });

    sendJson(res, 202, job);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/report") {
    const body = await readBody(req).catch(() => null);
    if (!body) {
      sendJson(res, 400, { error: "JSON invalido" });
      return;
    }

    const headed = parseBool(body.headed, false);
    const slowMo = parseNonNegativeNumber(body.slowMo, 300);
    const csvInput = body.csvInput ? String(body.csvInput).trim() : path.join("src", "input", "codigos_infobras.csv");

    const job = spawnJob({
      type: "report",
      commandArgs: [path.join("src", "run", "generar-reportes.js")],
      env: {
        HEADED: String(headed),
        SLOW_MO: String(slowMo),
        CSV_INPUT: csvInput
      },
      params: { headed, slowMo, csvInput }
    });

    sendJson(res, 202, job);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/verificar-documentacion") {
    const body = await readBody(req).catch(() => null);
    if (!body) {
      sendJson(res, 400, { error: "JSON invalido" });
      return;
    }

    const departamento = String(body.departamento || "HUANUCO").trim() || "HUANUCO";
    const headed = parseBool(body.headed, false);
    const slowMo = parseNonNegativeNumber(body.slowMo, 300);
    const diasPlazo = parseNonNegativeNumber(body.diasPlazo, 30);

    const job = spawnJob({
      type: "verificar-documentacion",
      commandArgs: [path.join("src", "run", "verificar-documentacion.js")],
      env: {
        HEADED: String(headed),
        SLOW_MO: String(slowMo),
        DEPARTAMENTO: departamento,
        DIAS_PLAZO: String(diasPlazo)
      },
      params: { departamento, headed, slowMo, diasPlazo }
    });

    sendJson(res, 202, job);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/incumplimientos") {
    try {
      const rutaManifest = path.join(__dirname, "..", "..", "docs", "informes", "incumplimientos-manifest.json");
      const contenido = await fs.readFile(rutaManifest, "utf8").catch(() => null);
      const data = contenido ? JSON.parse(contenido) : { generatedAt: null, incumplimientos: [] };
      let incumplimientos = Array.isArray(data.incumplimientos) ? data.incumplimientos : [];

      const departamento = url.searchParams.get("departamento");
      if (departamento) {
        incumplimientos = incumplimientos.filter((item) => item.departamento === departamento);
      }

      incumplimientos = incumplimientos.slice().sort((a, b) => Number(b.diasSinActualizar || 0) - Number(a.diasSinActualizar || 0));

      sendJson(res, 200, { generatedAt: data.generatedAt || null, incumplimientos });
      return;
    } catch (error) {
      sendJson(res, 500, { error: error.message, incumplimientos: [] });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/informes") {
    try {
      const rutaInformes = path.join(__dirname, "..", "..", "docs", "informes");
      const archivos = await fs.readdir(rutaInformes).catch(() => []);
      const informes = archivos
        .filter((archivo) => /^\d+-informe\.pdf$/i.test(archivo))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((archivo) => ({
          archivo,
          codigo: archivo.replace(/-informe\.pdf$/i, ""),
          url: `/api/informes/descargar?archivo=${encodeURIComponent(archivo)}`
        }));

      sendJson(res, 200, { informes });
      return;
    } catch (error) {
      sendJson(res, 500, { error: error.message, informes: [] });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/informes/descargar") {
    try {
      const archivo = String(url.searchParams.get("archivo") || "").trim();
      if (!/^\d+-informe\.pdf$/i.test(archivo)) {
        sendJson(res, 400, { error: "Nombre de informe invalido" });
        return;
      }

      const rutaPdf = path.join(__dirname, "..", "..", "docs", "informes", archivo);
      const bufferPdf = await fs.readFile(rutaPdf).catch(() => null);
      if (!bufferPdf) {
        sendJson(res, 404, { error: "El informe no se encontro en el servidor" });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": bufferPdf.length,
        "Content-Disposition": `inline; filename="${archivo}"`
      });
      res.end(bufferPdf);
      return;
    } catch (error) {
      sendJson(res, 500, { error: error.message });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/incumplimientos/descargar") {
    try {
      const codigo = String(url.searchParams.get("codigo") || "").trim();
      if (!codigo) {
        sendJson(res, 400, { error: "Falta el parametro codigo" });
        return;
      }

      const rutaManifest = path.join(__dirname, "..", "..", "docs", "informes", "incumplimientos-manifest.json");
      const contenido = await fs.readFile(rutaManifest, "utf8").catch(() => null);
      const data = contenido ? JSON.parse(contenido) : { incumplimientos: [] };
      const entrada = (data.incumplimientos || []).find((item) => item.codigo === codigo);

      if (!entrada || !entrada.archivoPdf) {
        sendJson(res, 404, { error: "No hay informe de incumplimiento para ese codigo" });
        return;
      }

      const rutaPdf = path.join(__dirname, "..", "..", "docs", "informes", entrada.archivoPdf);
      const bufferPdf = await fs.readFile(rutaPdf).catch(() => null);
      if (!bufferPdf) {
        sendJson(res, 404, { error: "El archivo PDF no se encontro en el servidor" });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": bufferPdf.length,
        "Content-Disposition": `attachment; filename="${entrada.archivoPdf}"`
      });
      res.end(bufferPdf);
      return;
    } catch (error) {
      sendJson(res, 500, { error: error.message });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/extract-all") {
    const body = await readBody(req).catch(() => null);
    if (!body) {
      sendJson(res, 400, { error: "JSON invalido" });
      return;
    }

    const headed = parseBool(body.headed, false);
    const slowMo = parseNonNegativeNumber(body.slowMo, 300);

    // Inicia la extracción
    await startBulkExtraction(headed, slowMo);
    sendJson(res, 202, { status: "Extracción iniciada", ...bulkExtractionGroup });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/schedule") {
    const body = await readBody(req).catch(() => null);
    if (!body) {
      sendJson(res, 400, { error: "JSON invalido" });
      return;
    }

    const hour = parseNonNegativeNumber(body.hour, 2);
    const minute = parseNonNegativeNumber(body.minute, 0);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      sendJson(res, 400, { error: "Hora (0-23) o minuto (0-59) inválido" });
      return;
    }

    setupScheduler(hour, minute);
    sendJson(res, 200, {
      status: "Scheduler configurado",
      config: {
        enabled: schedulerConfig.enabled,
        hour: schedulerConfig.hour,
        minute: schedulerConfig.minute,
        nextRun: schedulerConfig.nextRun,
        lastRun: schedulerConfig.lastRun
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/schedule-status") {
    const payload = {
      enabled: schedulerConfig.enabled,
      hour: schedulerConfig.hour,
      minute: schedulerConfig.minute,
      nextRun: schedulerConfig.nextRun,
      lastRun: schedulerConfig.lastRun,
      departamentos: DEPARTAMENTOS.length,
      bulkExtractionStatus: bulkExtractionGroup ? {
        groupId: bulkExtractionGroup.groupId,
        status: bulkExtractionGroup.status,
        totalDepartamentos: bulkExtractionGroup.totalDepartamentos,
        completedDepartamentos: bulkExtractionGroup.completedDepartamentos,
        failedDepartamentos: bulkExtractionGroup.failedDepartamentos
      } : null
    };
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bulk-extraction-status") {
    if (!bulkExtractionGroup) {
      sendJson(res, 200, { status: "No extraction in progress", group: null });
      return;
    }
    sendJson(res, 200, {
      groupId: bulkExtractionGroup.groupId,
      status: bulkExtractionGroup.status,
      createdAt: bulkExtractionGroup.createdAt,
      totalDepartamentos: bulkExtractionGroup.totalDepartamentos,
      completedDepartamentos: bulkExtractionGroup.completedDepartamentos,
      failedDepartamentos: bulkExtractionGroup.failedDepartamentos,
      jobCount: bulkExtractionGroup.jobIds ? bulkExtractionGroup.jobIds.length : 0
    });
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada" });
}

const server = http.createServer((req, res) => {
  requestHandler(req, res).catch((error) => {
    sendJson(res, 500, { error: error.message });
  });
});

server.listen(PORT, () => {
  console.log(`[APP] UI lista en http://localhost:${PORT}`);
});
