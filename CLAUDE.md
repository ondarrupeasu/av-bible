# AVBible — brief

> Cerebro del proyecto. Idea nº3 de `~/Proyectos/IDEAS.md`.

## Qué es
Referencia audiovisual interactiva para alumnado de FP y profesionales.
Categorías: Image & Signal, Color Science, Artifacts & Defects, Optics & Sensor,
Narrative & Camera, Monitoring & Scopes (y en camino Signals & Connectivity + Lighting).
Rigor técnico según EBU, SMPTE, ITU-R, DCI. En pleno repaso 2026 (ver más abajo).

- **Web**: https://avbible.cinemafilmak.com (github.io/av-bible redirige ahí)
- **Repo**: https://github.com/ondarrupeasu/av-bible

## Stack
React 18 + Vite 5. Sin librerías de UI: canvas nativo, CSS-in-JS inline y Web APIs.
Todo vive en `src/App.jsx` (~2100 líneas, un solo componente `AVBible`).

Paleta: fondo `#060609`, accent amber `#f59e0b`, tipografía system-ui.
Hub con cards por categoría → módulo individual. Upload de imagen global en el
header que se propaga a los módulos; por defecto, un paisaje sintético en canvas.
Responsive, prioridad desktop.

## Cómo se despliega
`push a main` → GitHub Actions (`.github/workflows/deploy.yml`) → build → `gh-pages`.
Pages sirve desde `gh-pages` en el dominio propio **avbible.cinemafilmak.com**
(`public/CNAME` + `vite.config.js` con `base: './'` relativo). Sin tokens manuales.

⚠️ **`public/.nojekyll` es imprescindible.** Sin él, el build de Jekyll (legacy) de
Pages falla con "Page build failed" sobre el bundle SPA y **la web se queda congelada
en la versión anterior aunque el push salga verde**. Si tras un deploy no cambia nada:
`gh api repos/ondarrupeasu/av-bible/pages` (¿status errored?) y, si hace falta,
`gh api -X POST .../pages/builds` para reencolar.

**No commitear `dist/`**: el build se genera en CI. `main` contiene solo el fuente.
`package-lock.json` sí va versionado — sin él, `npm ci` falla en el workflow.

Local: `npm install` → `npm run dev` (5173) → `npm run build`.

## Decidido
- **(b) mejorar el HTML, no hacer ejecutable.** Camino: PWA (multiplataforma,
  sin instalar, offline).
- Fusión con Cinemafilmak (idea nº4): pendiente de valorar.

## Repaso 2026 — estado y backlog
Repaso completo en marcha (agosto 2026), por tandas. Despliegue: `.nojekyll` es
imprescindible (ver más abajo). Orden acordado con el usuario:

**HECHO y en vivo:**
- Grupo 1 (arreglos rápidos): responsive + franja blanca, Banding sin líneas
  amarillas (degradado Gray/Sky/Skin), Color Spaces AP0 bien dibujado, Frame Rate
  a ritmo real (péndulo con estela de muestreo, motion blur retirado).
- **Scopes** (categoría "Monitoring & Scopes"): Histograma/Waveform/Vectorscopio/
  Parade por separado + grading en vivo (lift/gamma/gain/sat/temp). Sustituye al
  viejo "Histogram & Waveform".
- **Escena compartida** `drawScene()` + `SCENE` (faceBox/bodyBox): nueva imagen por
  defecto coherente con figura humana; base para los rediseños de framing/movimiento.

**EN CURSO / siguiente — Grupo 2 (rediseños sobre la escena):**
- Shot Types: encuadres sobre la figura de la escena + recorte resultante.
- Camera Movement: MISMA escena, todos los movimientos encima (dolly vs zoom real).
- Depth of Field: desenfoque por distancia sobre elementos de la escena.
- Aspect Ratio: imagen fija + letterbox semitransparente (mostrar qué se recorta).
- Resolution: imagen dentro de marco que crece proporcional a la resolución.
- Chroma Subsampling: patrón de test con bordes de color (el efecto no se ve hoy).
- Color Temperature: dos ejes (WB de cámara con iconos × fuente de luz) → tinta.
- Timecode: explicación visual del drop-frame.

**Módulos nuevos (Grupo 4, ampliado con ideas del usuario):**
- LUT; False Color; Exposure Triangle (shutter/apertura/ISO sobre imagen real).
- Separar RAW → **Compresión/Codecs** (macrobloques + comparativa: intra/inter,
  DCT/wavelet, grado, calidad, bit depth 8/10/12+, alfa, propietario vs abierto:
  H.264/265, ProRes, DNxHR, AV1, VP9, JPEG2000) y **Rango dinámico/Latitud**.
- **Contenedores/wrappers** (MOV, MXF, MP4, MKV…): qué admiten dentro (vídeo/audio/
  subs/TC/metadatos), propietario vs abierto, cuál conviene. Punto clave: códec ≠ contenedor.
- **Signals & Connectivity** (categoría nueva): HDMI/SDI/fibra/NDI/SRT/XLR/DMX…
  ejes SEPARADOS = interfaz física vs transporte IP (NDI/SRT NO son cables) vs qué
  transporta (vídeo/audio/datos/tally/control/alimentación); conectores (BNC, RJ45,
  LC…); **distancias/límites por cable** (HDMI ~15 m, SDI 3G ~100 m coax, fibra km,
  Cat 100 m…); propietario vs abierto. DESTACAR XLR-3 (audio) vs DMX (XLR-5 estándar/
  XLR-3 común, pero es DATOS RS-485, no audio).
- **Lighting** (categoría nueva): (a) Luz de retrato — modelo + key/fill/back… con
  sombreado por normales (patrones Rembrandt/mariposa/loop/split, ratio, dura/suave,
  temperatura por foco); (b) DMX — universo 512ch, direccionamiento, personalidad de
  fixture, Art-Net/sACN, patch virtual. Fixtures dentro de estos, no módulo aparte.
- Artefactos que faltan: flicker/bandas rodantes (50/60Hz, PWM LED), distorsión de
  lente (barril/cojín), interlazado/combing, halación/bloom, focus breathing.

## Otros pendientes
- **PWA**: `manifest.json` + service worker para uso offline en el aula.
- **i18n**: `STRINGS.en` centralizado al inicio de `App.jsx`; falta `es` y `eu`.
- **Accesibilidad**: las cards del hub son `div` con `onClick` — convertir a `button`
  (no navegables por teclado ni en árbol de accesibilidad).

## Cómo trabajamos
Español y sencillo; Claude lleva el git; probar antes de dar por bueno.
