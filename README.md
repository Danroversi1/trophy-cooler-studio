# Trophy Cooler Studio

Interactive 3D concept studio for an oversize, trophy-style beer cooler: a Meling DW-XL90 medical freezer hidden in the base, 12 beers on ice in the cup, and a UHMW-PE sliding base for NHL ice. Built for a Michelob ULTRA on-ice activation.

- **5 concepts.** Cathedral, Halo, Prism, Hat Trick, Monolith. Every cup, enclosure and base is interchangeable.
- **Inputs.** Upload brand assets (logo, font, colors) and design references (palette → glass, finish → metal/facets, silhouette → lathed cup, image → skin).
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

## Design references (Google Slides)
References live in a Google Slides deck, not in this repo, Vercel or Supabase.
1. Share the deck as **Anyone with the link can view**.
2. In the studio, paste the deck link → **Connect deck**, select a concept, then click thumbnails to pin them **to that concept**.
3. Each concept (Cathedral, Halo, Prism, Hat Trick, Monolith) has its own pins and its own look (modules, finish, skin, palette, ★ cup). Brand assets are shared by all concepts. Badges on thumbnails show which other concepts use a slide.
4. In **Module**, pick a reference thumbnail for each element of the concept:
   - **Cup:** shape from its silhouette and/or a skin.
   - **Enclosure:** a skin and/or glass/LED colors.
   - **Base:** a skin.
   - **Bottles:** label art and/or the bottle shape.
5. Pins are saved in your browser as slide **object IDs**, so they stay fixed when slides are reordered, inserted or edited. The `p.N` badge only shows the slide's current position.

`api/slides.js` is a pass-through. It reads the deck's slide list and streams slide images from Google on request, and stores nothing.

## Section workshop (Cup · Enclosure · Sliding base)
Each concept has three independently designed sections. Select one in **Scene objects** or the workshop tabs:
- **References:** use **Choose reference…** to browse the connected Google Slides treatment (page number + title) and assign one or more slides to this section only. If the deck can't be loaded, import slide images, pasted screenshots or a **PDF export** of the deck instead (File → Download → PDF). The primary reference can drive shape, skin, palette or bottle label, but only when you tick that option. To use only part of a slide (or of an imported image), hover it, click **✂ Crop** and drag a rectangle. Each crop becomes its own reference, stored as the slide ID plus the crop rectangle, and is rebuilt live from the slide.
- **Design prompt → Generate iteration:** creates an iteration for this section only. The iteration previews in the viewport.
- **Iterations:** rename, preview, compare side by side, apply to the trophy, or delete. **Save current** stores manual parameter edits as an iteration.
- **Design parameters:** variant, finish and section sliders (manual, no generation).

Prompts and iteration history are stored per concept and per section, in this browser.

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
