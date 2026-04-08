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
  publicSheet: {
    opcionesFichaPublica: /OPCIONES DE FICHA P[UÚ]BLICA/i,
    datosEjecucionTexto: /Datos de ejecuci[oó]n/i,
    datosEjecucionHref: 'a[href*="/Mapa/DatosEjecucion?obraId="]',
    avancesObraTitulo: /AVANCES\s+DE\s+OBRA/i,
    verDetalleButton: /Ver detalle/i
  }
};
