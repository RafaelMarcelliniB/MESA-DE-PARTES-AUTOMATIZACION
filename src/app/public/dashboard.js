let allData = [];
let filteredData = [];
let currentSort = { field: null, asc: true };

async function loadInformes() {
  const status = document.getElementById("informes-status");
  const list = document.getElementById("informes-list");

  try {
    const response = await fetch("/api/informes");
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Error al cargar informes");
    }

    const informes = result.informes || [];
    list.innerHTML = informes.length > 0
      ? informes.map((informe) => `<p><strong>INFOBRAS ${informe.codigo}</strong> <a href="${informe.url}" target="_blank" rel="noopener">Abrir PDF</a></p>`).join("")
      : "No hay informes PDF generados.";
    status.textContent = `${informes.length} informe(s) disponible(s)`;
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
    list.textContent = "No se pudieron cargar los informes.";
  }
}

async function loadData() {
  const loading = document.getElementById("loading");
  const content = document.getElementById("content");
  const errorContainer = document.getElementById("error-container");

  try {
    const response = await fetch("/api/csv-data");
    const result = await response.json();

    if (!response.ok || !result.data) {
      throw new Error(result.error || "Error al cargar datos");
    }

    allData = result.data;
    filteredData = [...allData];

    // Display stats
    displayStats(result.stats);

    // Display CSV file info
    document.getElementById("csv-file").textContent = result.stats.csvFile;

    // Populate filters
    populateFilters(result.stats);

    // Display table
    displayTable(filteredData);

    loading.style.display = "none";
    content.style.display = "block";
  } catch (error) {
    loading.style.display = "none";
    errorContainer.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
  }
}

function displayStats(stats) {
  const container = document.getElementById("stats-container");

  const totalRecords = document.createElement("div");
  totalRecords.className = "stat-card";
  totalRecords.innerHTML = `
    <h3>Total de Registros</h3>
    <div class="value">${stats.totalRecords}</div>
  `;

  const totalMonto = document.createElement("div");
  totalMonto.className = "stat-card highlight";
  totalMonto.innerHTML = `
    <h3>Monto Total</h3>
    <div class="value">S/ ${formatNumber(stats.totalMonto)}</div>
  `;

  const promMonto = document.createElement("div");
  promMonto.className = "stat-card";
  promMonto.innerHTML = `
    <h3>Monto Promedio</h3>
    <div class="value">S/ ${formatNumber(stats.promediaMonto)}</div>
  `;

  container.appendChild(totalRecords);
  container.appendChild(totalMonto);
  container.appendChild(promMonto);

  // Estado distribution
  for (const [estado, count] of Object.entries(stats.estado)) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <h3>${estado}</h3>
      <div class="value">${count}</div>
    `;
    container.appendChild(card);
  }
}

function formatNumber(num) {
  return parseFloat(num).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function populateFilters(stats) {
  const estadoFilter = document.getElementById("estado-filter");
  const modalidadFilter = document.getElementById("modalidad-filter");

  for (const estado of Object.keys(stats.estado).sort()) {
    const option = document.createElement("option");
    option.value = estado;
    option.textContent = estado;
    estadoFilter.appendChild(option);
  }

  for (const modalidad of Object.keys(stats.modalidad).sort()) {
    const option = document.createElement("option");
    option.value = modalidad;
    option.textContent = modalidad;
    modalidadFilter.appendChild(option);
  }
}

function displayTable(data) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">No se encontraron registros</td></tr>';
    document.getElementById("record-count").textContent = "Total: 0 registros";
    return;
  }

  data.forEach(row => {
    const tr = document.createElement("tr");

    const codigo = row["Código INFOBRAS"] || "-";
    const cui = row["Código Único de Inversión"] || "-";
    const nombre = (row["Nombre de la obra"] || "-").substring(0, 80);
    const modalidad = row["Modalidad de ejecución"] || "-";
    const estado = row["Estado de obra"] || "-";
    const monto = row["Monto Expediente Técnico"] || "-";

    const estadoBadge = getEstadoBadge(estado);

    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${cui}</td>
      <td title="${row["Nombre de la obra"]}">${nombre}...</td>
      <td>${modalidad}</td>
      <td>${estadoBadge}</td>
      <td class="monto">${monto !== "-" ? "S/ " + formatNumber(monto) : "-"}</td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("record-count").textContent = `Total: ${data.length} registros`;
}

function getEstadoBadge(estado) {
  let cssClass = "estado-sin";
  if (estado.includes("Ejecución")) {
    cssClass = "estado-ejecucion";
  } else if (estado.includes("Finalizado")) {
    cssClass = "estado-finalizado";
  }

  return `<span class="estado-badge ${cssClass}">${estado}</span>`;
}

function applyFilters() {
  filteredData = allData.filter(row => {
    const search = document.getElementById("search").value.toLowerCase();
    const estadoFilter = document.getElementById("estado-filter").value;
    const modalidadFilter = document.getElementById("modalidad-filter").value;

    const nombre = (row["Nombre de la obra"] || "").toLowerCase();
    const estado = row["Estado de obra"] || "";
    const modalidad = row["Modalidad de ejecución"] || "";

    if (search && !nombre.includes(search)) return false;
    if (estadoFilter && estado !== estadoFilter) return false;
    if (modalidadFilter && modalidad !== modalidadFilter) return false;

    return true;
  });

  applySort();
  displayTable(filteredData);
}

function applySort() {
  if (!currentSort.field) return;

  filteredData.sort((a, b) => {
    let aVal = a[currentSort.field];
    let bVal = b[currentSort.field];

    // Try to parse as number
    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      aVal = aNum;
      bVal = bNum;
    } else {
      // String comparison
      aVal = String(aVal || "").toLowerCase();
      bVal = String(bVal || "").toLowerCase();
    }

    if (aVal < bVal) return currentSort.asc ? -1 : 1;
    if (aVal > bVal) return currentSort.asc ? 1 : -1;
    return 0;
  });
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadInformes();
  document.getElementById("btn-refresh-informes").addEventListener("click", loadInformes);

  // Search and filter listeners
  document.getElementById("search").addEventListener("input", applyFilters);
  document.getElementById("estado-filter").addEventListener("change", applyFilters);
  document.getElementById("modalidad-filter").addEventListener("change", applyFilters);

  // Sort listeners
  document.querySelectorAll(".data-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.field;

      // Update sort direction
      if (currentSort.field === field) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.field = field;
        currentSort.asc = true;
      }

      // Update UI
      document.querySelectorAll(".data-table th").forEach(h => {
        h.classList.remove("sort-asc", "sort-desc");
      });

      if (currentSort.asc) {
        th.classList.add("sort-asc");
      } else {
        th.classList.add("sort-desc");
      }

      applySort();
      displayTable(filteredData);
    });
  });

  // Load data
  loadData();
});
