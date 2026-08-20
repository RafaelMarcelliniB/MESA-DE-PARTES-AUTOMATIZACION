const logOutput = document.getElementById("log-output");
const jobMeta = document.getElementById("job-meta");
const extractForm = document.getElementById("extract-form");
const reportForm = document.getElementById("report-form");
const scheduleForm = document.getElementById("schedule-form");
const verificarForm = document.getElementById("verificar-form");
const btnRefreshIncumplimientos = document.getElementById("btn-refresh-incumplimientos");
const incumplimientosStatus = document.getElementById("incumplimientos-status");
const incumplimientosTableBody = document.getElementById("incumplimientos-table-body");
const incumplimientosCount = document.getElementById("incumplimientos-count");
const btnCheckSchedule = document.getElementById("btn-check-schedule");
const btnExtractAllHidden = document.getElementById("btn-extract-all-hidden");
const btnExtractAllVisible = document.getElementById("btn-extract-all-visible");

const departmentSelect = document.getElementById("department-select");
const estadoFilter = document.getElementById("estado-filter");
const searchInput = document.getElementById("search-input");
const dataStatus = document.getElementById("data-status");
const csvFileLabel = document.getElementById("csv-file");
const worksTableBody = document.getElementById("works-table-body");
const worksCount = document.getElementById("works-count");
const totalRecordsKpi = document.getElementById("kpi-total-records");
const totalMontoKpi = document.getElementById("kpi-total-monto");
const promedioMontoKpi = document.getElementById("kpi-promedio-monto");
const visibleRecordsKpi = document.getElementById("kpi-visible-records");
const bulkProgressFill = document.getElementById("bulk-progress-fill");
const bulkProgressText = document.getElementById("bulk-progress-text");
const bulkStatus = document.getElementById("bulk-status");
const bulkStatusText = document.getElementById("bulk-status-text");
const scheduleStatus = document.getElementById("schedule-status");
const scheduleStatusText = document.getElementById("schedule-status-text");
const btnRefreshInformes = document.getElementById("btn-refresh-informes");
const informesStatus = document.getElementById("informes-status");
const informesList = document.getElementById("informes-list");

const DEPARTAMENTOS_FALLBACK = [
  "AMAZONAS", "ANCASH", "APURÍMAC", "AREQUIPA", "AYACUCHO",
  "CAJAMARCA", "CALLAO", "CUSCO", "HUANCAVELICA", "HUÁNUCO",
  "ICA", "JUNÍN", "LA LIBERTAD", "LAMBAYEQUE", "LIMA",
  "LORETO", "MADRE DE DIOS", "MOQUEGUA", "PASCO", "PIURA",
  "PUNO", "SAN MARTÍN", "TACNA", "TUMBES", "UCAYALI"
];

const state = {
  department: "HUÁNUCO",
  allRows: [],
  filteredRows: [],
  stats: null,
  currentJobId: null,
  pollTimer: null,
  bulkTimer: null
};

function getDepartments() {
  return typeof DEPARTAMENTOS !== "undefined" ? DEPARTAMENTOS : DEPARTAMENTOS_FALLBACK;
}

function setLog(lines) {
  logOutput.textContent = (lines && lines.length > 0) ? lines.join("\n") : "Sin logs por ahora";
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setJobMeta(job) {
  if (!job) {
    jobMeta.textContent = "Sin ejecuciones activas";
    return;
  }

  const started = job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : "-";
  const ended = job.endedAt ? new Date(job.endedAt).toLocaleTimeString() : "-";
  jobMeta.textContent = `Job ${job.id} | ${job.type} | ${job.status} | inicio ${started} | fin ${ended}`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Error inesperado");
  }
  return data;
}

function updateDate() {
  const today = new Date();
  document.getElementById("fechaHoy").textContent = today.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function populateDepartmentSelect() {
  const departments = getDepartments();
  departmentSelect.innerHTML = departments.map((department) => {
    const selected = department === state.department ? " selected" : "";
    return `<option value="${department}"${selected}>${department}</option>`;
  }).join("");
}

function formatMonto(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return number.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEstadoPill(estado) {
  const normalized = String(estado || "").toLowerCase();
  if (normalized.includes("ejecución") || normalized.includes("ejecucion")) {
    return '<span class="pill ej">Ejecución</span>';
  }
  if (normalized.includes("finalizado")) {
    return '<span class="pill fin">Finalizado</span>';
  }
  if (normalized.includes("paralizado")) {
    return '<span class="pill par">Paralizado</span>';
  }
  return '<span class="pill sin">Sin ejecución</span>';
}

function renderStats() {
  const totalRecords = Number(state.stats?.totalRecords || state.allRows.length || 0);
  const totalMonto = formatMonto(state.stats?.totalMonto || 0);
  const promedioMonto = formatMonto(state.stats?.promediaMonto || 0);
  const visibleCount = state.filteredRows.length;

  totalRecordsKpi.textContent = totalRecords.toLocaleString("es-PE");
  totalMontoKpi.textContent = `S/ ${totalMonto}`;
  promedioMontoKpi.textContent = `S/ ${promedioMonto}`;
  visibleRecordsKpi.textContent = visibleCount.toLocaleString("es-PE");
  worksCount.textContent = `${visibleCount.toLocaleString("es-PE")} registros visibles`;
}

function renderWorksTable(rows) {
  if (!rows.length) {
    worksTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No se encontraron registros</td></tr>';
    renderStats();
    return;
  }

  worksTableBody.innerHTML = rows.map((row) => {
    const nombre = String(row["Nombre de la obra"] || "-");
    const monto = row["Monto Expediente Técnico"] || 0;
    const codigo = row["Código INFOBRAS"] || "-";
    const cui = row["Código Único de Inversión"] || "-";
    const modalidad = row["Modalidad de ejecución"] || "-";
    const estado = row["Estado de obra"] || "Sin ejecución";
    const fecha = row["Fecha de Inicio"] || row["Fecha Inicio"] || "-";

    return `
      <tr>
        <td title="${escapeHtml(codigo)}">${escapeHtml(codigo)}</td>
        <td title="${escapeHtml(cui)}">${escapeHtml(cui)}</td>
        <td title="${escapeHtml(nombre)}">${escapeHtml(nombre)}</td>
        <td>${escapeHtml(modalidad)}</td>
        <td>${getEstadoPill(estado)}</td>
        <td>S/ ${escapeHtml(formatMonto(monto))}</td>
      </tr>
    `;
  }).join("");

  renderStats();
}

function applyLocalFilters() {
  const search = String(searchInput.value || "").trim().toLowerCase();
  const estado = estadoFilter.value;

  state.filteredRows = state.allRows.filter((row) => {
    const nombre = String(row["Nombre de la obra"] || "").toLowerCase();
    const codigo = String(row["Código INFOBRAS"] || "").toLowerCase();
    const cui = String(row["Código Único de Inversión"] || "").toLowerCase();
    const modalidad = String(row["Modalidad de ejecución"] || "").toLowerCase();
    const estadoObra = String(row["Estado de obra"] || "").toLowerCase();

    if (search && !nombre.includes(search) && !codigo.includes(search) && !cui.includes(search) && !modalidad.includes(search)) {
      return false;
    }

    if (estado !== "todos" && !estadoObra.includes(estado.toLowerCase())) {
      return false;
    }

    return true;
  });

  renderWorksTable(state.filteredRows);
  csvFileLabel.textContent = state.stats?.csvFile || "-";
  dataStatus.textContent = `Departamento ${state.department} · ${state.filteredRows.length.toLocaleString("es-PE")} obras visibles`;
}

async function loadDepartmentData(department) {
  dataStatus.textContent = `Cargando datos de ${department}...`;
  worksTableBody.innerHTML = '<tr><td colspan="6" class="loading">Cargando registros...</td></tr>';

  try {
    const response = await fetchJson(`/api/csv-data?departamento=${encodeURIComponent(department)}`);
    state.allRows = response.data || [];
    state.stats = response.stats || null;
    state.filteredRows = [...state.allRows];

    csvFileLabel.textContent = response.stats?.csvFile || "-";
    applyLocalFilters();
  } catch (error) {
    dataStatus.textContent = `Error al cargar datos: ${error.message}`;
    worksTableBody.innerHTML = `<tr><td colspan="6" class="error-msg">${error.message}</td></tr>`;
    state.allRows = [];
    state.filteredRows = [];
    renderStats();
  }
}

function formatFechaCorta(iso) {
  if (!iso) {
    return "Sin fecha registrada";
  }
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return "Sin fecha registrada";
  }
  return fecha.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderIncumplimientos(lista) {
  if (!lista || lista.length === 0) {
    incumplimientosTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No hay obras con documentación desactualizada</td></tr>';
    incumplimientosCount.textContent = "0 obras sin documentación al día";
    return;
  }

  incumplimientosTableBody.innerHTML = lista.map((item) => {
    const dias = Number.isFinite(Number(item.diasSinActualizar)) ? `${item.diasSinActualizar} días` : "Sin fecha";
    return `
      <tr>
        <td title="${escapeHtml(item.codigo)}">${escapeHtml(item.codigo)}</td>
        <td title="${escapeHtml(item.nombreObra)}">${escapeHtml(item.nombreObra || "-")}</td>
        <td>${escapeHtml(item.departamento || "-")}</td>
        <td>${escapeHtml(formatFechaCorta(item.ultimaActualizacion))}</td>
        <td>${escapeHtml(dias)}</td>
        <td><a class="btn-secondary" href="/api/incumplimientos/descargar?codigo=${encodeURIComponent(item.codigo)}" download>Descargar PDF</a></td>
      </tr>
    `;
  }).join("");

  incumplimientosCount.textContent = `${lista.length.toLocaleString("es-PE")} obra(s) sin documentación al día`;
}

async function loadIncumplimientos(departamento) {
  incumplimientosStatus.textContent = "Cargando incumplimientos...";
  try {
    const query = departamento ? `?departamento=${encodeURIComponent(departamento)}` : "";
    const response = await fetchJson(`/api/incumplimientos${query}`);
    renderIncumplimientos(response.incumplimientos || []);
    incumplimientosStatus.textContent = response.generatedAt
      ? `Última verificación: ${new Date(response.generatedAt).toLocaleString("es-PE")}`
      : "Aún no se ha ejecutado ninguna verificación.";
  } catch (error) {
    incumplimientosStatus.textContent = `Error al cargar incumplimientos: ${error.message}`;
  }
}

function renderInformes(informes) {
  if (!informes || informes.length === 0) {
    informesList.innerHTML = "No hay informes PDF generados.";
    return;
  }

  informesList.innerHTML = informes.map((informe) => `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid var(--line, #e5e7eb);">
      <strong>INFOBRAS ${escapeHtml(informe.codigo)}</strong>
      <a class="btn-secondary" href="${informe.url}" target="_blank" rel="noopener">Abrir PDF</a>
    </div>
  `).join("");
}

async function loadInformes() {
  informesStatus.textContent = "Consultando informes generados...";
  try {
    const response = await fetchJson("/api/informes");
    renderInformes(response.informes || []);
    informesStatus.textContent = `${(response.informes || []).length} informe(s) disponible(s)`;
  } catch (error) {
    informesList.textContent = `Error al cargar informes: ${error.message}`;
    informesStatus.textContent = "No se pudo consultar la carpeta de informes.";
  }
}

function startPolling(jobId) {
  state.currentJobId = jobId;
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
  }

  const poll = async () => {
    if (!state.currentJobId) {
      return;
    }

    try {
      const job = await fetchJson(`/api/jobs/${state.currentJobId}`);
      setJobMeta(job);
      setLog(job.logs);

      if (job.status !== "running") {
        clearInterval(state.pollTimer);
        state.pollTimer = null;

        if (job.type === "verificar-documentacion") {
          loadIncumplimientos(state.department);
        }
        if (job.type === "report") {
          loadInformes();
        }
      }
    } catch (error) {
      setLog([`Error: ${error.message}`]);
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  };

  poll();
  state.pollTimer = setInterval(poll, 1200);
}

function updateBulkProgress(status) {
  if (!status) {
    bulkProgressFill.style.width = "0%";
    bulkProgressText.textContent = "Sin ejecución en curso";
    bulkStatus.hidden = true;
    return;
  }

  const total = Number(status.totalDepartamentos || 0);
  const completed = Number(status.completedDepartamentos || 0);
  const failed = Number(status.failedDepartamentos || 0);
  const processed = completed + failed;
  const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  bulkProgressFill.style.width = `${percentage}%`;
  bulkProgressText.textContent = `${processed} / ${total} departamentos · ${completed} completados · ${failed} fallidos`;
  bulkStatus.hidden = false;
  bulkStatusText.innerHTML = `
    <strong>Grupo:</strong> ${status.groupId || "-"}<br/>
    <strong>Estado:</strong> ${status.status || "-"}<br/>
    <strong>Procesados:</strong> ${processed} / ${total}
  `;
}

async function refreshBulkStatus() {
  try {
    const status = await fetchJson("/api/bulk-extraction-status");
    if (status && status.status) {
      updateBulkProgress(status);
    }
  } catch {
    // No hay extracción activa o el servidor aún no está listo.
  }
}

async function monitorBulkExtraction() {
  if (state.bulkTimer) {
    clearInterval(state.bulkTimer);
  }

  state.bulkTimer = setInterval(async () => {
    try {
      const status = await fetchJson("/api/bulk-extraction-status");
      updateBulkProgress(status);

      if (!status || status.status !== "running") {
        clearInterval(state.bulkTimer);
        state.bulkTimer = null;
      }
    } catch (error) {
      console.error("Error monitoring bulk extraction:", error);
    }
  }, 2000);
}

async function executeBulkExtraction(headed) {
  setLog([`Iniciando extracción masiva de 25 departamentos en modo ${headed ? "visible" : "oculto"}...`]);
  bulkStatus.hidden = false;
  bulkStatusText.textContent = "Iniciando...";
  bulkProgressFill.style.width = "0%";
  bulkProgressText.textContent = "0 / 25 departamentos";

  try {
    const response = await fetchJson("/api/extract-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headed, slowMo: 300 })
    });

    updateBulkProgress(response);
    await monitorBulkExtraction();
  } catch (error) {
    setLog([`Error al iniciar extracción masiva: ${error.message}`]);
    bulkProgressText.textContent = `Error: ${error.message}`;
    bulkStatusText.textContent = `Error: ${error.message}`;
  }
}

function renderScheduleStatus(response) {
  scheduleStatus.hidden = false;

  if (response.enabled) {
    scheduleStatusText.innerHTML = `
      <strong>✓ Scheduler ACTIVO</strong><br/>
      <strong>Hora:</strong> ${String(response.hour).padStart(2, "0")}:${String(response.minute).padStart(2, "0")}<br/>
      <strong>Próxima ejecución:</strong> ${response.nextRun ? new Date(response.nextRun).toLocaleString() : "-"}<br/>
      <strong>Última ejecución:</strong> ${response.lastRun ? new Date(response.lastRun).toLocaleString() : "Aún no ejecutada"}
    `;
  } else {
    scheduleStatusText.innerHTML = "<strong>Scheduler INACTIVO</strong> - Configura una hora para activarlo.";
  }
}

async function refreshScheduleStatus() {
  try {
    const response = await fetchJson("/api/schedule-status");
    renderScheduleStatus(response);
  } catch {
    // No hace falta interrumpir la carga si el estado aún no responde.
  }
}

function attachEvents() {
  departmentSelect.addEventListener("change", (event) => {
    state.department = event.target.value;
    loadDepartmentData(state.department);
    loadIncumplimientos(state.department);
  });

  estadoFilter.addEventListener("change", applyLocalFilters);
  searchInput.addEventListener("input", applyLocalFilters);

  extractForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(extractForm);
    const headed = String(event.submitter?.dataset?.headed || "false") === "true";

    const payload = {
      departamento: state.department,
      csvOutput: String(formData.get("csvOutput") || "").trim(),
      slowMo: Number(formData.get("slowMo") || 300),
      headed
    };

    setLog([`Iniciando extraccion para ${state.department} en modo ${headed ? "visible" : "oculto"}...`]);

    try {
      const job = await fetchJson("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      startPolling(job.id);
    } catch (error) {
      setLog([`Error al iniciar extraccion: ${error.message}`]);
    }
  });

  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(reportForm);
    const headed = String(event.submitter?.dataset?.headed || "false") === "true";

    const payload = {
      csvInput: String(formData.get("csvInput") || "").trim(),
      slowMo: Number(formData.get("slowMo") || 300),
      headed
    };

    setLog([`Iniciando generacion de reportes en modo ${headed ? "visible" : "oculto"}...`]);

    try {
      const job = await fetchJson("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      startPolling(job.id);
    } catch (error) {
      setLog([`Error al iniciar reportes: ${error.message}`]);
    }
  });

  verificarForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(verificarForm);
    const headed = String(event.submitter?.dataset?.headed || "false") === "true";

    const payload = {
      departamento: state.department,
      diasPlazo: Number(formData.get("diasPlazo") || 30),
      slowMo: Number(formData.get("slowMo") || 300),
      headed
    };

    setLog([`Verificando documentación de obras en ejecución en ${state.department} (plazo ${payload.diasPlazo} días, modo ${headed ? "visible" : "oculto"})...`]);

    try {
      const job = await fetchJson("/api/verificar-documentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      startPolling(job.id);
    } catch (error) {
      setLog([`Error al iniciar verificación de documentación: ${error.message}`]);
    }
  });

  btnRefreshIncumplimientos.addEventListener("click", () => loadIncumplimientos(state.department));
  btnRefreshInformes.addEventListener("click", loadInformes);

  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const hour = Number(document.getElementById("schedule-hour").value);
    const minute = Number(document.getElementById("schedule-minute").value);

    setLog([`Configurando scheduler para las ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}...`]);

    try {
      const response = await fetchJson("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hour, minute })
      });

      renderScheduleStatus(response.config || { enabled: true, hour, minute, nextRun: null, lastRun: null });
      setLog([
        `Configurando scheduler para las ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}...`,
        "✓ Scheduler configurado correctamente"
      ]);
      await refreshScheduleStatus();
    } catch (error) {
      setLog([`Error al configurar scheduler: ${error.message}`]);
      scheduleStatus.hidden = false;
      scheduleStatusText.textContent = `Error: ${error.message}`;
    }
  });

  btnCheckSchedule.addEventListener("click", refreshScheduleStatus);

  btnExtractAllHidden.addEventListener("click", () => {
    if (confirm("¿Descargar los 25 CSVs de todos los departamentos? Esto puede tomar varios minutos.")) {
      executeBulkExtraction(false);
    }
  });

  btnExtractAllVisible.addEventListener("click", () => {
    if (confirm("¿Descargar los 25 CSVs en modo visible? Esto abrirá navegadores de forma visible.")) {
      executeBulkExtraction(true);
    }
  });
}

(async () => {
  updateDate();
  populateDepartmentSelect();
  attachEvents();
  await loadDepartmentData(state.department);
  await loadIncumplimientos(state.department);
  await loadInformes();
  await refreshBulkStatus();
  await refreshScheduleStatus();

  try {
    const jobs = await fetchJson("/api/jobs");
    if (jobs.length > 0) {
      startPolling(jobs[0].id);
    }
  } catch {
    // Ignorar error inicial de lectura.
  }
})();

