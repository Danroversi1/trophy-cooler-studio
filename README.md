# Trophy Cooler Studio

Interactive 3D concept studio for an oversize, trophy-style beer cooler: a Meling DW-XL90 medical freezer hidden in the base, 12 beers on ice in the cup, and a UHMW-PE sliding base for NHL ice. Built for a Michelob ULTRA on-ice activation.

- **5 concepts.** Cathedral, Halo, Prism, Hat Trick, Monolith. Every cup, enclosure and base is interchangeable.
- **Brand assets.** Upload a logo, font and colors; they apply to every concept, every label and the Michelob ULTRA bottles.
- **Export.** GLB of the current design from the page; `npm run export-models` writes GLB (meters) + STL (inches) for every module.

## Structure
| Path | What |
|---|---|
| `src/index.html` | Studio UI (loads three.js from a CDN via import map for development) |
| `src/designs.js` | Parametric module library (units: inches, +Y up, +Z front) |
| `scripts/build.mjs` | Bundles everything into a single self-contained `dist/index.html` |
| `scripts/export-models.mjs` | Batch GLB/STL export of all concepts |

## Develop
```bash
npm install
npm run dev     # serves src/ at localhost
npm run build   # → dist/index.html (what Vercel deploys)
```

Deployed on Vercel: `vercel.json` runs `npm run build` and serves `dist/`.

> Visual concept, not a fabrication model or venue-approved installation. Brand marks are placeholders until approved artwork is uploaded.


## Section workshop (Cup · Enclosure · Sliding base)
Each concept has three independently designed sections. Select one in **Scene objects** or the workshop tabs:
- **Design prompt → Generate iteration:** creates an iteration for this section only. The iteration previews in the viewport.
- **Iterations:** rename, preview, compare side by side, apply to the trophy, or delete. **Save current** stores manual parameter edits as an iteration.
- **Design parameters:** variant, finish and section sliders (manual, no generation).

Prompts and iteration history are stored per concept and per section, in this browser. All concepts use Michelob blue with chrome.

### Fixed constraints
- The freezer (23.6 × 32.0 × 24.6 in) never changes. The enclosure can only grow, and always stays 36 in tall.
- The cup always holds 12 bottles plus ice, and a fit check warns if the bowl gets too tight.
- The sled deck stays at 3 in, its footprint auto-grows to carry the enclosure, and ice contact is always UHMW.

## Local generation (no cloud, no tokens)
Engines (panel → **Local generator**):
1. **Built-in procedural:** runs in the page with no model. It interprets the prompt with design rules and explores around the current design.
2. **Ollama:** `ollama pull qwen2.5:7b` (or `llama3.2-vision` to send reference images), then
   `OLLAMA_ORIGINS="https://trophy-cooler-studio.vercel.app" ollama serve` (use `OLLAMA_ORIGINS="*"` for the standalone file).
   On the macOS app: `launchctl setenv OLLAMA_ORIGINS "https://trophy-cooler-studio.vercel.app"`, then restart Ollama.
3. **LM Studio / llama.cpp:** any OpenAI-compatible local server (`http://localhost:1234`, or `llama-server --port 8080`) with CORS enabled.

The model returns **section parameters as JSON**, which are clamped to the allowed ranges and fit constraints before anything is shown.

Only `localhost`, `127.x`, `*.local` and private-network addresses are accepted. If the local engine is unreachable, generation stops with a clear message; it never falls back to a cloud API.

Chrome may ask once for permission to access devices on your local network.

## Rendering
Physically based materials (clear-coat lacquer, chrome, flint glass, frosted ice, UHMW), an arena-style lighting environment, soft shadows, a contact shadow on the ice, and ground-truth ambient occlusion (GTAO) on a multisampled render target. Turn off **View settings → Realistic shading** on slower machines.
