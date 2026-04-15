const locators = require("../locators/infobras.locators");

class InfobrasScreen {
  constructor(page) {
    this.page = page;
    this.fichaPage = null;
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
