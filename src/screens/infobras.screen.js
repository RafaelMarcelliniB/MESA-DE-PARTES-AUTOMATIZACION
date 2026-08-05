const fs = require("fs/promises");
const locators = require("../locators/infobras.locators");

class InfobrasScreen {
  constructor(page) {
    this.page = page;
    this.fichaPage = null;
  }

  normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  async esperarAntesDeCaptura(pageObjetivo, esperaMs = 1500) {
    await pageObjetivo.waitForTimeout(esperaMs).catch(() => {});
  }

  async abrirSitio() {
    await this.page.goto(locators.urlPrincipal, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  async irAZonaBusqueda() {
    const linkBusqueda = this.page.locator(locators.home.buscaAhoraHref).first();
    await linkBusqueda.waitFor({ state: "visible", timeout: 15000 });

    // El enlace lleva a la pantalla de búsqueda; navegar directo evita problemas de viewport.
    await this.page.goto("https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Index", {
      waitUntil: "domcontentloaded"
    });

    // Espera hasta que la pantalla de búsqueda esté lista para digitar el código.
    await this.page.locator(locators.search.panelBusqueda).waitFor({ state: "visible", timeout: 20000 });
    await this.page.locator(locators.search.codigoInfobrasInput).waitFor({ state: "visible", timeout: 20000 });
  }

  async irAZonaBusquedaAvanzada() {
    const linkBusqueda = this.page.locator(locators.home.buscaAhoraHref).first();
    await linkBusqueda.waitFor({ state: "visible", timeout: 15000 });

    await this.page.goto("https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Index", {
      waitUntil: "domcontentloaded"
    });

    await this.page.locator(locators.advancedSearch.searchSwitch).waitFor({ state: "visible", timeout: 20000 });
  }

  async activarBusquedaAvanzada() {
    const switchBusqueda = this.page.locator(locators.advancedSearch.searchSwitch).first();
    await switchBusqueda.waitFor({ state: "attached", timeout: 20000 });

    if (!(await switchBusqueda.isChecked().catch(() => false))) {
      await switchBusqueda.click();
    }

    await this.page.locator(locators.advancedSearch.departmentSelect).waitFor({ state: "attached", timeout: 20000 });
  }

  async seleccionarDepartamento(departamento) {
    const departamentoNormalizado = this.normalizarTexto(departamento);
    const selectorDepartamento = this.page.locator(locators.advancedSearch.departmentSelect).first();

    await selectorDepartamento.waitFor({ state: "attached", timeout: 20000 });
    await this.page.waitForFunction(
      ({ selector, objetivo }) => {
        const normalizar = (texto) => String(texto || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toUpperCase();

        const select = document.querySelector(selector);
        if (!select) {
          return false;
        }

        const opciones = Array.from(select.options || []);
        if (opciones.length < 2) {
          return false;
        }

        return opciones.some((opcion) => normalizar(opcion.textContent) === objetivo);
      },
      { selector: locators.advancedSearch.departmentSelect, objetivo: departamentoNormalizado },
      { timeout: 30000 }
    );

    const seleccionado = await selectorDepartamento.evaluate((elemento, valorObjetivo) => {
      const normalizar = (texto) => String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

      const option = Array.from(elemento.options).find((opcion) => normalizar(opcion.textContent) === valorObjetivo);

      if (!option) {
        return false;
      }

      elemento.value = option.value;
      elemento.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, departamentoNormalizado);

    if (!seleccionado) {
      throw new Error(`No se encontró el departamento ${departamentoNormalizado}`);
    }
  }

  async esperarDespuesDeSeleccionDepartamento(esperaMs = 1000) {
    await this.page.waitForTimeout(esperaMs).catch(() => {});
  }

  async buscarCodigosPorDepartamento() {
    const botonBuscar = this.page.locator(locators.advancedSearch.searchButton).first();
    await botonBuscar.waitFor({ state: "visible", timeout: 20000 });
    await botonBuscar.click();

    await this.page.locator(locators.advancedSearch.exportCsvButton).waitFor({ state: "visible", timeout: 60000 });
  }

  async exportarCsvBusquedaAvanzada(rutaArchivo) {
    const botonExportar = this.page.locator(locators.advancedSearch.exportCsvButton).first();
    await botonExportar.waitFor({ state: "visible", timeout: 20000 });
    await botonExportar.scrollIntoViewIfNeeded().catch(() => {});

    await fs.rm(rutaArchivo, { force: true }).catch(() => {});

    const obtenerDescarga = async (intento) => {
      const descargaPromesa = this.page.waitForEvent("download", { timeout: 90000 }).catch(() => null);
      await botonExportar.click({ force: true }).catch(async () => {
        await botonExportar.evaluate((elemento) => elemento.click());
      });
      const descarga = await descargaPromesa;
      if (!descarga && intento === 1) {
        await this.page.waitForTimeout(1500).catch(() => {});
      }
      return descarga;
    };

    let descarga = await obtenerDescarga(1);
    if (!descarga) {
      descarga = await obtenerDescarga(2);
    }

    if (descarga) {
      await descarga.saveAs(rutaArchivo);
      const stat = await fs.stat(rutaArchivo).catch(() => null);
      if (!stat || stat.size <= 0) {
        throw new Error("La descarga CSV se detectó pero el archivo quedó vacío.");
      }
      return rutaArchivo;
    }

    // Fallback robusto para headless: reproducir la exportación en dos pasos por API.
    const datosExportacion = await this.page.evaluate(() => {
      if (typeof getSearchParamsForExport !== "function") {
        return null;
      }

      const searchParams = getSearchParamsForExport();
      const contextApp = typeof CONTEXT_APP === "string" ? CONTEXT_APP : "/InfobrasWeb";

      return {
        searchParams,
        contextApp
      };
    }).catch(() => null);

    if (datosExportacion?.searchParams) {
      const { searchParams, contextApp } = datosExportacion;
      const totalRecords = Number(searchParams.totalRecords || 0);
      if (totalRecords <= 0) {
        throw new Error("No hay resultados disponibles para exportar en CSV.");
      }

      const origin = new URL(this.page.url()).origin;
      const actionUrl = `${origin}${contextApp}/Mapa/MapaEstadistico/ExportarExcelAvanzada`;
      const paramNames = [
        "nombre", "codigo", "valor", "desde", "hasta", "minimo", "maximo",
        "nivel1", "nivel2", "nivel3", "controlSocial", "controlGubernamental", "tipoControl",
        "marca", "departamento", "provincia", "distrito", "estado", "modalidadEjecucion"
      ];

      const form = {};
      paramNames.forEach((nombre) => {
        form[nombre] = String(searchParams[nombre] || "");
      });
      form.formato = "csv";

      const generar = await this.page.context().request.post(actionUrl, {
        form,
        timeout: 180000
      });

      if (!generar.ok()) {
        throw new Error(`Falló la generación de CSV (HTTP ${generar.status()}).`);
      }

      const data = await generar.json().catch(() => null);
      if (!data?.success || !data?.fileName) {
        throw new Error(data?.error || "El servidor no devolvió un archivo CSV para descargar.");
      }

      const urlDescarga = `${origin}${contextApp}/Mapa/MapaEstadistico/DescargarExport?doc=${encodeURIComponent(data.fileName)}`;
      const respuesta = await this.page.context().request.get(urlDescarga, { timeout: 180000 });

      if (!respuesta.ok()) {
        throw new Error(`Falló la descarga del CSV pre-generado (HTTP ${respuesta.status()}).`);
      }

      const contenido = await respuesta.body();
      if (!contenido || contenido.length === 0) {
        throw new Error("La respuesta de exportación CSV llegó vacía.");
      }

      await fs.writeFile(rutaArchivo, contenido);
      return rutaArchivo;
    }

    const href = await botonExportar.getAttribute("href").catch(() => null);
    if (href && href !== "#") {
      const urlDescarga = new URL(href, this.page.url()).toString();
      const respuesta = await this.page.context().request.get(urlDescarga);
      if (respuesta.ok()) {
        const contenido = await respuesta.body();
        if (!contenido || contenido.length === 0) {
          throw new Error("La respuesta de exportación CSV llegó vacía.");
        }
        await fs.writeFile(rutaArchivo, contenido);
        return rutaArchivo;
      }
    }

    throw new Error("No se pudo descargar el CSV desde el botón Exportar.");
  }

  async buscarPorCodigoInfobras(codigoInfobras) {
    await this.page.locator(locators.search.codigoInfobrasInput).fill(String(codigoInfobras));
    await this.page.locator(locators.search.buscarButton).click();

    // La señal de que la búsqueda terminó es la aparición del botón de ficha pública.
    await this.page.locator(locators.search.verFichaPublicaButton).first().waitFor({
      state: "visible",
      timeout: 60000
    });
  }

  async abrirFichaPublica() {
    const botonFicha = this.page.locator(locators.search.verFichaPublicaButton).first();
    await botonFicha.waitFor({ state: "visible", timeout: 20000 });

    const popupPromise = this.page.waitForEvent("popup", { timeout: 10000 }).catch(() => null);
    await botonFicha.click();

    const popup = await popupPromise;
    this.fichaPage = popup || this.page;
    await this.fichaPage.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async irADatosEjecucion() {
    const pageObjetivo = this.fichaPage || this.page;

    await pageObjetivo.waitForLoadState("domcontentloaded").catch(() => {});

    const tituloDatosEjecucion = pageObjetivo
      .getByText(locators.publicSheet.datosEjecucionTitulo)
      .first();

    if (await tituloDatosEjecucion.isVisible().catch(() => false)) {
      return;
    }

    const linkDatosEjecucion = pageObjetivo.locator(locators.publicSheet.datosEjecucionHref).first();
    const textoDatosEjecucion = pageObjetivo.getByText(locators.publicSheet.datosEjecucionTexto).first();

    if (await linkDatosEjecucion.isVisible().catch(() => false)) {
      await linkDatosEjecucion.click().catch(() => {});
    } else if (await textoDatosEjecucion.isVisible().catch(() => false)) {
      await textoDatosEjecucion.click().catch(() => {});
    } else {
      // Fallback: cuando no renderiza el menú lateral, navegar por URL directa con obraId.
      const hrefDirecto = await pageObjetivo
        .locator(locators.publicSheet.datosEjecucionHref)
        .first()
        .getAttribute("href")
        .catch(() => null);

      if (hrefDirecto) {
        const urlDirecta = new URL(hrefDirecto, pageObjetivo.url()).toString();
        await pageObjetivo.goto(urlDirecta, { waitUntil: "domcontentloaded" });
      } else {
        const matchObra = pageObjetivo.url().match(/[?&]obraId=(\d+)/i);
        if (matchObra?.[1]) {
          const urlDatosEjecucion = `https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/DatosEjecucion?obraId=${matchObra[1]}`;
          await pageObjetivo.goto(urlDatosEjecucion, { waitUntil: "domcontentloaded" });
        }
      }
    }

    await pageObjetivo.waitForLoadState("networkidle").catch(() => {});
    await tituloDatosEjecucion.waitFor({ state: "visible", timeout: 60000 });
  }

  async extraerFechaUltimaActualizacion() {
    const pageObjetivo = this.fichaPage || this.page;

    await this.irADatosEjecucion().catch(() => {});

    // Esperar carga y pequeños delays para que el DOM quede estable
    await pageObjetivo.waitForLoadState("networkidle").catch(() => {});
    await this.esperarAntesDeCaptura(pageObjetivo, 500).catch(() => {});

    const html = await pageObjetivo.content().catch(() => "");
    if (!html) return null;

    const aFecha = (d, mo, y) => {
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    // 1) Preferir fechas que aparecen cerca de la etiqueta "actualiz..."
    //    (p. ej. "Última actualización: 12/05/2026"). Se busca en una ventana
    //    de texto alrededor de cada ocurrencia de la palabra, sin depender de
    //    un selector CSS específico que no podemos verificar en vivo.
    const textoPlano = html.replace(/<[^>]+>/g, " ");
    const reEtiqueta = /actualiz\w*/gi;
    const reFecha = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
    const fechasCercaEtiqueta = [];
    let etiqueta;
    while ((etiqueta = reEtiqueta.exec(textoPlano)) !== null) {
      const ventana = textoPlano.slice(etiqueta.index, etiqueta.index + 120);
      const match = reFecha.exec(ventana);
      if (match) {
        const dt = aFecha(Number(match[1]), Number(match[2]), Number(match[3]));
        if (dt) fechasCercaEtiqueta.push(dt);
      }
    }

    if (fechasCercaEtiqueta.length > 0) {
      fechasCercaEtiqueta.sort((a, b) => b.getTime() - a.getTime());
      return fechasCercaEtiqueta[0].toISOString();
    }

    // 2) Respaldo: si no se encontró ninguna fecha etiquetada como
    //    "actualización", usar la fecha más reciente de toda la página
    //    (comportamiento original).
    const re = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    const fechas = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const dt = aFecha(Number(m[1]), Number(m[2]), Number(m[3]));
      if (dt) fechas.push(dt);
    }

    if (fechas.length === 0) {
      return null;
    }

    fechas.sort((a, b) => b.getTime() - a.getTime());
    return fechas[0].toISOString();
  }

  async capturarDatosEjecucion(rutaArchivo) {
    const pageObjetivo = this.fichaPage || this.page;
    await this.esperarAntesDeCaptura(pageObjetivo);
    await pageObjetivo.screenshot({ path: rutaArchivo, fullPage: true });
  }

  async capturarAvancesObra(rutaArchivo) {
    const pageObjetivo = this.fichaPage || this.page;

    const botonVerDetalle = pageObjetivo.getByRole("button", {
      name: locators.publicSheet.verDetalleButton
    }).first();

    if (await botonVerDetalle.isVisible().catch(() => false)) {
      await botonVerDetalle.click().catch(() => {});
    }

    await pageObjetivo.getByText(locators.publicSheet.avancesObraTitulo).first().waitFor({
      state: "visible",
      timeout: 10000
    }).catch(() => {});

    await this.esperarAntesDeCaptura(pageObjetivo);

    await pageObjetivo.screenshot({ path: rutaArchivo, fullPage: true });
  }

  async cerrarFichaPublicaSiAplica() {
    if (this.fichaPage && this.fichaPage !== this.page) {
      await this.fichaPage.close().catch(() => {});
    }
    this.fichaPage = null;
  }
}

module.exports = { InfobrasScreen };
