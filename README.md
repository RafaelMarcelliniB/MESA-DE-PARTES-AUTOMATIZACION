# RPA Contaloria con Cucumber y JavaScript

Esta base organiza el robot en tres capas:

- `src/locators`: selectores y referencias de la interfaz
- `src/screens`: acciones de cada pantalla
- `src/features`: orquestación del flujo de negocio

Además, Cucumber vive en `features/` con el archivo Gherkin del flujo principal.

## Estructura

```text
RPA Contaloria/
├─ cucumber.js
├─ features/
│  └─ verificacion.feature
├─ src/
│  ├─ core/
│  ├─ features/
│  ├─ input/
│  ├─ locators/
│  ├─ screens/
│  ├─ steps/
│  └─ support/
└─ package.json
```

## Flujo de verificación

1. Abrir INFOBRAS.
2. Ir a la zona de búsqueda.
3. Buscar por `código_infobras`.
4. Abrir la ficha pública.
5. Entrar a `Datos de ejecución`.
6. Validar que la ruta completa se ejecutó.

## Flujo de extracción de códigos

1. Abrir INFOBRAS.
2. Entrar a `Mapa/Index` desde `¡Busca ahora!`.
3. Activar la búsqueda avanzada con el switch `filter-type-search`.
4. Seleccionar el `Departamento` en mayusculas y sin tildes.
5. Presionar `BUSCAR`.
6. Exportar el resultado en CSV con `EXPORTAR CSV`.

Ejemplo de ejecucion:

```powershell
$env:DEPARTAMENTO="HUANUCO"; npm run extract:codigos
```

Por defecto, el archivo se guarda en `tests/evidencias/extraccion-codigos/`.

## App web (extracción + reportes)

La app web ahora tiene un diseño unificado tipo dashboard y permite controlar todo desde el navegador:

1. Selector de los 25 departamentos del Perú en la barra superior.
2. Extracción individual por departamento con modo oculto o visible.
3. Extracción masiva de los 25 departamentos con barra de progreso y monitoreo.
4. Programación diaria de la extracción desde la misma interfaz.
5. Lista completa de obras extraídas desde el CSV, con filtros y búsqueda.
6. Generación de reportes y PDFs desde un CSV.

Iniciar la app:

```powershell
npm run app
```

Abrir en navegador:

```text
http://localhost:3080
```

Pantallas disponibles:

1. `/` - Panel principal para extracción, programación y revisión de obras.
2. `/dashboard.html` - Dashboard de análisis con visualización y tablas.

Flujos disponibles desde el panel principal:

1. `Ejecutar oculto` y `Ejecutar visible` para un departamento puntual.
2. `Descargar (oculto)` y `Descargar (visible)` para lanzar la extracción masiva.
3. `Programar` para dejar una extracción diaria automática.
4. Tabla completa con todos los registros leídos desde el CSV del departamento seleccionado.

Comandos directos adicionales:

```powershell
# Extracción por departamento
$env:DEPARTAMENTO="HUANUCO"; npm run extract:codigos

# Flujo de reportes sin Cucumber
$env:CSV_INPUT="src/input/codigos_infobras.csv"; npm run reportes
```

## Datos de entrada

El archivo base es `src/input/codigos_infobras.csv`.

Los CSV generados por extracción se guardan en `tests/evidencias/extraccion-codigos/` con el nombre del departamento, por ejemplo `huanuco.csv`.

La API web expone esos datos en `GET /api/csv-data?departamento=HUÁNUCO` para alimentar el dashboard y la lista completa de obras.

## Documentación

- Guía de reporte de monitoreo (generada automáticamente al correr la feature): `docs/reporte-monitoreo.md`
- Evidencias de capturas completas por registro: `tests/evidencias/`
- Informes PDF por obra con formato `codigo-informe.pdf`: `docs/informes/`

Al ejecutar `npm run test:feature`, el flujo recorre cada código del CSV, toma las capturas completas de la ficha pública y genera automáticamente el PDF de informe en `docs/informes/`.

## Ejecución (Windows)

1. Abrir PowerShell en la carpeta del proyecto.
2. Instalar dependencias:

```powershell
npm install
```

3. Instalar navegadores de Playwright (solo la primera vez):

```powershell
npx playwright install
```

4. Ejecutar el flujo principal:

```powershell
npm run test:feature
```

5. Ejecutar todas las features (opcional):

```powershell
npm test
```

## Ejecución visible y pasos en consola

Ahora el proyecto abre el navegador en modo visible por defecto y muestra cada paso de Cucumber en la terminal con prefijo ` [STEP] `.
El retardo entre acciones (`SLOW_MO`) viene en `0` por defecto para evitar demoras innecesarias.
El timeout global de Cucumber puede ajustarse con `CUCUMBER_TIMEOUT_MS` si el sitio responde lento.

Comandos útiles:

```powershell
# Visible (por defecto) + pasos en consola
npm run test:feature

# Modo oculto (headless)
$env:HEADED="false"; npm run test:feature

# Visible y más lento para observar mejor
$env:SLOW_MO="700"; npm run test:feature

# Extender timeout global de Cucumber (ejemplo: 45 min)
$env:CUCUMBER_TIMEOUT_MS="2700000"; npm run test:feature
```

## Troubleshooting

Si `npm install` falla:

1. Verificar versión de Node.js:

```powershell
node -v
npm -v
```

2. Se recomienda usar Node 20 o superior.

3. Limpiar e instalar de nuevo:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm cache verify
npm install
```

4. Si falla por red/certificados corporativos, probar:

```powershell
npm config set strict-ssl false
npm install
```

Nota: usa esta opción solo si tu red corporativa intercepta SSL.

## Observación

Los selectores de la pantalla son provisionales y probablemente deban ajustarse cuando se pruebe contra el sitio real.
