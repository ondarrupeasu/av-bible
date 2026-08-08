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

**HECHO — Grupo 2 (rediseños) + correcciones, todo en vivo:**
- Escena compartida por capas (SCENE_LAYERS con depth) + art-dirección + horizonte sin costura.
- Shot Types (encuadres sobre la escena, sin atenuado), Camera Movement (parallax dolly-vs-zoom
  por capas), Depth of Field (desenfoque por distancia + VISTA LATERAL con banda de foco).
- Aspect Ratio (imagen fija + letterbox semitransparente), Resolution (recuadros anidados a escala),
  Chroma (lado a lado luma-sharp/croma-bloques), Color Temperature (dos ejes WB×fuente).
- Timecode (explicación visual drop-frame). Banding sin slider. Rolling Shutter/Moiré responsive.
- Color Spaces: 10 espacios (cámara verificados en colour-science) + auto-escala + responsive.
  Picture Profiles: S-Log2/3 correctos, single-select. Color Science reordenado (Color Temp→…→ACES).
- Scopes: PIP overlay sobre escena + histograma monocromo + Hue. RAW vs Compressed: waveform
  (RAW recupera = spread; H.264 = línea recta clipada).

**HECHO — Grupo 4 (módulos nuevos), todo en vivo (ago 2026):**
- Correcciones ronda 3: RAW = habitación amueblada con ventana (headroom ×6.5, RAW
  recupera / H.264 gris); Chroma rejilla 8×8 con el borde verde→piel del modelo; DoF
  blur suave por reducción progresiva (no pixela, cross-browser sin ctx.filter).
- **LUTs** (Color Science): 6 looks técnico/creativos + split source/LUT; 1D vs 3D.
- **False Color** (Monitoring): luma→IRE a paleta de set + leyenda.
- **Exposure Triangle** (Image): shutter/apertura/ISO con motion blur + grano reales + EV.
- **Compression & Codecs** (Image): macrobloques 8×8 (slider bitrate) + GOP I/P/B con
  flechas + tabla de 8 códecs. **Containers & Wrappers**: códec≠contenedor, matriz de pistas.
- **Signals & Connectivity** (CATEGORÍA nueva, teal): 3 ejes (cable físico / transporte
  IP / qué transporta) + distancias + XLR-audio vs DMX.
- **Lighting** (CATEGORÍA nueva, amarillo): **Portrait Lighting** 2.5D (cara por relieve
  de normales, N·L+especular, key arrastrable cenital, patrones Rembrandt/butterfly/
  loop/split/rim) + **DMX Control** (universo 512ch, patch por dirección, fixtures con
  personalidad, Art-Net/sACN). Módulo educativo, distinto de la app DMXSimulatoR.
- Artefactos: **Lens Distortion** (barrel/pincushion), **Interlacing & Combing**,
  **Halation & Bloom**, **Flicker & Rolling Bands** (animado), **Focus Breathing** (animado).

Total: ~33 módulos, 8 categorías. Fixes helper: ExpRow hoisted (no remontar sliders).

**Ideas originales del Grupo 4 (referencia, ya implementadas):**
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
- **Lighting** (categoría nueva): (a) Luz de retrato — DECIDIDO enfoque **2.5D con
  mapa de normales** (NO 3D real/Three.js: rompe "sin librerías" y no hace falta orbitar
  cámara para enseñar luz). Doble vista: **diagrama cenital** (esquema top-down con
  marcadores de luz arrastrables: azimut 360°, distancia/caída, altura/elevación, temp,
  intensidad, dura/suave, etiquetados key/fill/back/rim/kicker) + **render frontal** del
  busto sombreado en vivo por N·L+especular. Normal map del busto generado por código o
  bakeado y embebido. Empezar por cabeza/busto (patrones Rembrandt/mariposa/loop/split);
  plano medio/cuerpo = ampliación. Pega honesta asumida: cámara frontal fija, back/rim
  simulado por ángulos rasantes. (b) DMX — universo 512ch, direccionamiento, personalidad
  de fixture, Art-Net/sACN, patch virtual. Fixtures dentro de estos, no módulo aparte.
- Artefactos que faltan: flicker/bandas rodantes (50/60Hz, PWM LED), distorsión de
  lente (barril/cojín), interlazado/combing, halación/bloom, focus breathing.

## Otros pendientes
- **PWA**: `manifest.json` + service worker para uso offline en el aula.
- **i18n**: `STRINGS.en` centralizado al inicio de `App.jsx`; falta `es` y `eu`.
- **Accesibilidad**: las cards del hub son `div` con `onClick` — convertir a `button`
  (no navegables por teclado ni en árbol de accesibilidad).

## Cómo trabajamos
Español y sencillo; Claude lleva el git; probar antes de dar por bueno.
