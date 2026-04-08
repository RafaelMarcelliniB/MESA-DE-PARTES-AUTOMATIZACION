const { setWorldConstructor, World } = require("@cucumber/cucumber");

class InfobrasWorld extends World {
  constructor(options) {
    super(options);
    this.registros = [];
    this.resultados = [];
  }
}

setWorldConstructor(InfobrasWorld);
