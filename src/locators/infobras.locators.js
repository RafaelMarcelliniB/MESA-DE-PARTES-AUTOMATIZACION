module.exports = {
  urlPrincipal: "https://infobras.contraloria.gob.pe/InfobrasWeb/",
  home: {
    buscaAhoraTexto: /BUSCA\s*AHORA/i,
    buscaAhoraHref: 'a[href="/InfobrasWeb/Mapa/Index"]'
  },
  search: {
    panelBusqueda: "#ID_FORM_BASIC",
    codigoInfobrasInput: "#ID_BASIC_Codigo",
    buscarButton: '#ID_FORM_BASIC button[type="submit"]',
    resultadosPanel: "#ID_Result",
    verFichaPublicaButton: '#ID_Result a[onclick^="verFicha"]'
  },
  advancedSearch: {
    searchSwitch: "#filter-type-search",
    departmentSelect: "#ID_ADVANCED_Departamento",
    searchButton: 'button[type="submit"][form="ID_FORM_ADVANCED"]',
    exportCsvButton: "#btnExportCSV"
  },
  publicSheet: {
    opcionesFichaPublica: /OPCIONES DE FICHA P[UÚ]BLICA/i,
    datosEjecucionTexto: /Datos de ejecuci[oó]n/i,
    datosEjecucionHref: 'a[href*="/Mapa/DatosEjecucion?obraId="]',
    datosEjecucionTitulo: /DATOS\s+DE\s+EJECUCI[OÓ]N/i,
    avancesObraTitulo: /AVANCES\s+DE\s+OBRA/i,
    verDetalleButton: /Ver detalle/i
  }
};
