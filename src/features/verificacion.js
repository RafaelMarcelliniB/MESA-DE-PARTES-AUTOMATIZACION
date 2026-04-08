const fs = require("fs/promises");
const path = require("path");
const { nombreEvidencia } = require("../core/reporte-monitoreo");

class VerificacionFeature {
  constructor(screen) {
    this.screen = screen;
  }

  async ejecutarRegistro(registro) {
    const rutaEvidencias = path.join(process.cwd(), "tests", "evidencias");
    const codigo = registro.codigo_infobras;
    const evidenciaDatosEjecucion = path.join(rutaEvidencias, nombreEvidencia("captura-01-datos-ejecucion", codigo));
    const evidenciaAvancesObra = path.join(rutaEvidencias, nombreEvidencia("captura-02-avances-obra", codigo));

    await fs.mkdir(rutaEvidencias, { recursive: true });

    await this.screen.abrirSitio();
    await this.screen.irAZonaBusqueda();
    await this.screen.buscarPorCodigoInfobras(codigo);
    await this.screen.abrirFichaPublica();
    await this.screen.irADatosEjecucion();
    await this.screen.capturarDatosEjecucion(evidenciaDatosEjecucion);
    await this.screen.capturarAvancesObra(evidenciaAvancesObra);
    await this.screen.cerrarFichaPublicaSiAplica();

    return {
      codigoInfobras: codigo,
      codigoEntidadNombre: registro.codigo_entidad_nombre,
      reporteMcc: registro.reporte_mcc,
      evidenciaDatosEjecucion,
      evidenciaAvancesObra,
      completado: true
    };
  }
}

module.exports = { VerificacionFeature };
