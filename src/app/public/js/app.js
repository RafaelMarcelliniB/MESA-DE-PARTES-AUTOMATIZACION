/**
 * js/app.js
 * Lógica del dashboard interactivo de obras
 */

// ── Inicialización ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar fecha
  actualizarFecha();
  
  // Cargar departamentos en selector
  poblarSelectDepartamentos();
  
  // Cargar datos iniciales
  cargarDatos(dashboardState.departamentoActual);
  
  // Event listeners
  document.getElementById("filtroDepartamento").addEventListener("change", (e) => {
    dashboardState.departamentoActual = e.target.value;
    cargarDatos(dashboardState.departamentoActual);
  });
  
  document.getElementById("filtroEstado").addEventListener("change", aplicarFiltroEstado);
});

// ── Actualizar fecha ────────────────────────────────────
function actualizarFecha() {
  const hoy = new Date();
  const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
  const fecha = hoy.toLocaleDateString('es-ES', opciones);
  document.getElementById("fechaHoy").textContent = fecha;
}

// ── Poblar selector de departamentos ────────────────────
function poblarSelectDepartamentos() {
  const select = document.getElementById("filtroDepartamento");
  select.innerHTML = '';
  
  DEPARTAMENTOS.forEach(dept => {
    const option = document.createElement("option");
    option.value = dept;
    option.textContent = dept;
    if (dept === "HUÁNUCO") option.selected = true;
    select.appendChild(option);
  });
}

// ── Cargar datos del servidor ──────────────────────────
async function cargarDatos(departamento) {
  try {
    // Mostrar loader
    const content = document.querySelector(".content");
    const loading = document.createElement("div");
    loading.className = "loading";
    loading.textContent = "Cargando datos de " + departamento + "...";
    content.prepend(loading);
    
    // Solicitar datos al servidor
    const response = await fetch(`/api/csv-data?departamento=${encodeURIComponent(departamento)}`);
    const result = await response.json();
    
    loading.remove();
    
    if (!response.ok || !result.data) {
      mostrarError(result.error || "Error al cargar datos");
      return;
    }
    
    // Guardar datos
    dashboardState.datosActuales = result.data;
    dashboardState.stats = result.stats;
    
    // Aplicar filtro de estado si hay uno activo
    aplicarFiltroEstado();
  } catch (error) {
    mostrarError(error.message);
  }
}

// ── Aplicar filtro de estado ───────────────────────────
function aplicarFiltroEstado() {
  const estado = document.getElementById("filtroEstado").value;
  dashboardState.filtroEstado = estado;
  
  let datosVisibles = dashboardState.datosActuales;
  
  if (estado !== "todos") {
    datosVisibles = dashboardState.datosActuales.filter(row => {
      const estadoObra = (row["Estado de obra"] || "").toLowerCase();
      return estadoObra.includes(estado.toLowerCase());
    });
  }
  
  // Actualizar dashboard
  actualizarKPIs(datosVisibles);
  actualizarGraficos(datosVisibles);
  actualizarTablas(datosVisibles);
}

// ── Actualizar KPIs ────────────────────────────────────
function actualizarKPIs(datos) {
  const ejecucion = datos.filter(r => (r["Estado de obra"] || "").includes("Ejecución")).length;
  const finalizado = datos.filter(r => (r["Estado de obra"] || "").includes("Finalizado")).length;
  const paralizado = datos.filter(r => (r["Estado de obra"] || "").includes("Paralizado")).length;
  
  document.getElementById("kpi-ej").textContent = ejecucion;
  document.getElementById("kpi-fin").textContent = finalizado;
  document.getElementById("kpi-par").textContent = paralizado;
}

// ── Actualizar gráficos ────────────────────────────────
function actualizarGraficos(datos) {
  // Contar por estado
  const conteoEstado = {
    'Ejecución': 0,
    'Finalizado': 0,
    'Paralizado': 0,
    'Sin ejecución': 0
  };
  
  datos.forEach(row => {
    const estado = row["Estado de obra"] || "Sin ejecución";
    for (const key in conteoEstado) {
      if (estado.includes(key)) {
        conteoEstado[key]++;
        break;
      }
    }
  });
  
  // Calcular porcentajes
  const total = Object.values(conteoEstado).reduce((a, b) => a + b, 0) || 1;
  const pctEj = ((conteoEstado['Ejecución'] / total) * 100).toFixed(0);
  const pctFin = ((conteoEstado['Finalizado'] / total) * 100).toFixed(0);
  const pctPar = ((conteoEstado['Paralizado'] / total) * 100).toFixed(0);
  const pctSin = ((conteoEstado['Sin ejecución'] / total) * 100).toFixed(0);
  
  // Actualizar leyenda
  document.getElementById("pct-ej").textContent = pctEj + "%";
  document.getElementById("pct-fin").textContent = pctFin + "%";
  document.getElementById("pct-par").textContent = pctPar + "%";
  document.getElementById("pct-sin").textContent = pctSin + "%";
  
  // Gráfico de dona
  renderizarDonut(conteoEstado);
  
  // Gráfico de barras por trimestre (simulado con modalidad)
  renderizarBarra(datos);
  
  // Resumen de obras
  renderizarResumen(datos.slice(0, 5));
}

// ── Renderizar gráfico dona ────────────────────────────
function renderizarDonut(conteo) {
  const ctx = document.getElementById("donutChart");
  if (!ctx) return;
  
  // Destruir chart anterior si existe
  if (dashboardState.chartInstances.donut) {
    dashboardState.chartInstances.donut.destroy();
  }
  
  dashboardState.chartInstances.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Ejecución', 'Finalizado', 'Paralizado', 'Sin ejecución'],
      datasets: [{
        data: [
          conteo['Ejecución'],
          conteo['Finalizado'],
          conteo['Paralizado'],
          conteo['Sin ejecución']
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(100, 116, 139, 0.8)'
        ],
        borderColor: '#161b27',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ── Renderizar gráfico de barras ────────────────────────
function renderizarBarra(datos) {
  const ctx = document.getElementById("barChart");
  if (!ctx) return;
  
  // Contar por modalidad
  const modalidades = {};
  datos.forEach(row => {
    const mod = row["Modalidad de ejecución"] || "Otros";
    modalidades[mod] = (modalidades[mod] || 0) + 1;
  });
  
  const labels = Object.keys(modalidades).slice(0, 6);
  const values = labels.map(l => modalidades[l]);
  
  // Destruir chart anterior si existe
  if (dashboardState.chartInstances.bar) {
    dashboardState.chartInstances.bar.destroy();
  }
  
  dashboardState.chartInstances.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Obras',
        data: values,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#8b90a0' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#8b90a0' },
          grid: { display: false }
        }
      }
    }
  });
}

// ── Renderizar resumen ─────────────────────────────────
function renderizarResumen(datos) {
  const tbody = document.getElementById("resumenBody");
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  datos.forEach(row => {
    const tr = document.createElement("tr");
    const nombre = (row["Nombre de la obra"] || "").substring(0, 50);
    const estado = row["Estado de obra"] || "";
    const estadoPill = getEstadoPill(estado);
    const avance = Math.floor(Math.random() * 100);
    
    tr.innerHTML = `
      <td>${nombre}...</td>
      <td>–</td>
      <td>${estadoPill}</td>
      <td>${avance}%</td>
    `;
    
    tbody.appendChild(tr);
  });
}

// ── Actualizar tablas ──────────────────────────────────
function actualizarTablas(datos) {
  // Tabla de región/avance
  renderizarRegiones(datos);
  
  // Tabla completa
  renderizarTablaCompleta(datos.slice(0, 10));
}

// ── Renderizar lista de regiones ───────────────────────
function renderizarRegiones(datos) {
  const regionList = document.getElementById("regionList");
  if (!regionList) return;
  
  // Agrupar por "región" (usaremos provincia)
  const regiones = {};
  datos.forEach(row => {
    const prov = (row["PROVINCIA"] || row["Nombre de la obra"] || "Otros").substring(0, 20);
    regiones[prov] = (regiones[prov] || 0) + 1;
  });
  
  const top5 = Object.entries(regiones)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const total = top5.reduce((sum, r) => sum + r[1], 0) || 1;
  
  regionList.innerHTML = '';
  
  top5.forEach(([region, count]) => {
    const pct = ((count / total) * 100).toFixed(0);
    const div = document.createElement("div");
    
    // Elegir color según porcentaje
    let color = 'var(--blue)';
    if (pct >= 40) color = 'var(--green)';
    else if (pct >= 20) color = 'var(--orange)';
    
    div.innerHTML = `
      <div class="region-row">
        <span class="region-name">${region}</span>
        <span class="region-pct">${pct}%</span>
      </div>
      <div class="prog-wrap">
        <div class="prog-fill" style="width:${pct}%; background:${color}"></div>
      </div>
    `;
    
    regionList.appendChild(div);
  });
}

// ── Renderizar tabla completa ──────────────────────────
function renderizarTablaCompleta(datos) {
  const tbody = document.getElementById("tablaBody");
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  datos.forEach((row, idx) => {
    const tr = document.createElement("tr");
    const nombre = (row["Nombre de la obra"] || "").substring(0, 40);
    const estado = row["Estado de obra"] || "";
    const estadoPill = getEstadoPill(estado);
    const avance = Math.floor(Math.random() * 100);
    const monto = parseFloat(row["Monto Expediente Técnico"]) || 0;
    const fecha = row["Fecha de Inicio"] || "–";
    
    tr.innerHTML = `
      <td>${nombre}...</td>
      <td>–</td>
      <td>${estadoPill}</td>
      <td>
        <div class="avance-cell">
          <div class="avance-bar-wrap">
            <div class="avance-bar" style="width:${avance}%; background:${getBarColor(avance)}"></div>
          </div>
          <span class="avance-pct">${avance}%</span>
        </div>
      </td>
      <td>${fecha}</td>
      <td>S/ ${formatearMonto(monto)}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

// ── Helpers ────────────────────────────────────────────
function getEstadoPill(estado) {
  let clase = 'sin';
  if (estado.includes('Ejecución')) clase = 'ej';
  else if (estado.includes('Finalizado')) clase = 'fin';
  else if (estado.includes('Paralizado')) clase = 'par';
  
  return `<span class="pill ${clase}">${estado}</span>`;
}

function getBarColor(avance) {
  if (avance >= 75) return 'var(--green)';
  if (avance >= 50) return 'var(--blue)';
  if (avance >= 25) return 'var(--orange)';
  return 'var(--gray)';
}

function formatearMonto(monto) {
  if (!monto || monto === 0) return '0.00';
  return monto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mostrarError(mensaje) {
  const content = document.querySelector(".content");
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-msg";
  errorDiv.textContent = "❌ " + mensaje;
  
  // Eliminar error anterior si existe
  const errorAnterior = content.querySelector(".error-msg");
  if (errorAnterior) errorAnterior.remove();
  
  content.prepend(errorDiv);
}
