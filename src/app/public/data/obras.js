/**
 * data/obras.js
 * Lista de departamentos del Perú para el selector
 */

const DEPARTAMENTOS = [
  "AMAZONAS",
  "ANCASH",
  "APURÍMAC",
  "AREQUIPA",
  "AYACUCHO",
  "CAJAMARCA",
  "CALLAO",
  "CUSCO",
  "HUANCAVELICA",
  "HUÁNUCO",
  "ICA",
  "JUNÍN",
  "LA LIBERTAD",
  "LAMBAYEQUE",
  "LIMA",
  "LORETO",
  "MADRE DE DIOS",
  "MOQUEGUA",
  "PASCO",
  "PIURA",
  "PUNO",
  "SAN MARTÍN",
  "TACNA",
  "TUMBES",
  "UCAYALI"
];

// Estado del dashboard
let dashboardState = {
  departamentoActual: "HUÁNUCO",
  filtroEstado: "todos",
  datosActuales: [],
  chartInstances: {}
};
