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

## Datos de entrada

El archivo base es `src/input/codigos_infobras.csv`.

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
