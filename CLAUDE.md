# AVBible — brief

> Cerebro del proyecto. Idea nº3 de `~/Proyectos/IDEAS.md`.

## Qué es
Referencia audiovisual interactiva para alumnado de FP y profesionales.
20 módulos en 5 categorías (Image & Signal, Color Science, Artifacts & Defects,
Optics & Sensor, Narrative & Camera). Rigor técnico según EBU, SMPTE, ITU-R, DCI.

- **Web**: https://ondarrupeasu.github.io/av-bible/
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
Pages sirve desde la rama `gh-pages`. No hay tokens manuales: usa `GITHUB_TOKEN`.

**No commitear `dist/`**: el build se genera en CI. `main` contiene solo el fuente.
`package-lock.json` sí va versionado — sin él, `npm ci` falla en el workflow.

Local: `npm install` → `npm run dev` (5173) → `npm run build`.

## Decidido
- **(b) mejorar el HTML, no hacer ejecutable.** Camino: PWA (multiplataforma,
  sin instalar, offline).
- Fusión con Cinemafilmak (idea nº4): pendiente de valorar.

## Pendiente
- **PWA**: `manifest.json` + service worker para uso offline en el aula.
- **i18n**: `STRINGS.en` ya está centralizado al inicio de `App.jsx`; falta `es` y `eu`.
- **Módulo RAW**: la simulación de headroom es aproximada, mejorable.
- **Histograma**: añadir vectorscope.
- Módulos candidatos: Vectorscope, Dynamic Range, Codec comparison,
  White balance interactivo, Exposure triangle.
- **Accesibilidad**: las cards del hub son `div` con `onClick` — no son
  navegables por teclado ni salen en el árbol de accesibilidad. Convertir a `button`.

## Cómo trabajamos
Español y sencillo; Claude lleva el git; probar antes de dar por bueno.
