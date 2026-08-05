const fs = require("fs/promises");
const path = require("path");

class ExtraccionCodigosFeature {
  constructor(screen) {
    this.screen = screen;
  }

  async ejecutarExtraccion({ departamento, rutaSalida }) {
    await fs.mkdir(path.dirname(rutaSalida), { recursive: true });

    await this.screen.abrirSitio();
    await this.screen.irAZonaBusquedaAvanzada();
    await this.screen.activarBusquedaAvanzada();
    await this.screen.seleccionarDepartamento(departamento);
    await this.screen.esperarDespuesDeSeleccionDepartamento(1000);
    await this.screen.buscarCodigosPorDepartamento();
    await this.screen.exportarCsvBusquedaAvanzada(rutaSalida);

    return {
      departamento,
      rutaSalida,
      completado: true
    };
  }
}

module.exports = { ExtraccionCodigosFeature };