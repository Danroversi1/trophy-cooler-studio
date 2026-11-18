# Michelob ULTRA Trophy Cooler

An interactive 3D model of the trophy cooler, built from the reference render. A chrome bowl with spiral flutes sits on a stepped pedestal, on top of a wide Michelob-blue enclosure that houses a **Meling DW-XL90** freezer.

**Live:** https://trophy-cooler-studio.vercel.app

## The model
- **Enclosure:** 32 × 30 × 36.5 in body on a 3 in ice sled, snug around the freezer (23.6 × 32.0 × 24.6 in).
  - About 3.4 in clear on each side, 2.2 in behind and 1.5 in above.
  - The front panel lifts off by its two handles.
  - The bottom vent band lines up with the freezer's front vent.
  - No wheels: a UHMW-PE skid plate with four runners slides on the rink, and no metal touches the ice.
- **Cup:** 32 in bowl (as wide as the box, as in the render), sized for 12 bottles plus ice. It has 28 twisted flutes and a polished rim band, on a five-step 12 in pedestal.
- **Bottles + ice:** 12 Michelob ULTRA long-necks leaning out of a heaped ice bed (adjustable to 36).
- **Overall:** about 6′ tall and about 255 lb loaded (130 lb of that is the freezer).

- **Bottles:** 12 oz amber longnecks with an oval wrap label and a neck foil, pushed into the ice at varied depths and angles.

**Brand:** the enclosure and bottle labels use the supplied Michelob ULTRA logo (`src/assets/`). An uploaded logo replaces it.

See **Rendering pipeline** below for preview modes, the CPU fallback and the final render.

All dimensions are parametric. **Keep the render's proportions** scales the cup with the enclosure width. The freezer fit is checked live, and the box can't be made smaller than the freezer.

## Rendering pipeline

The viewer detects whether WebGL runs on a hardware GPU or in **software** (SwiftShader, llvmpipe, Microsoft Basic Render — i.e. on the CPU) and adapts. The readout in the bottom-right corner shows the preview mode, frame rate, render resolution and scale, and hardware vs software rendering.

| | Fast preview (default) | High quality | Final render |
|---|---|---|---|
| Reflections | precomputed environment map (PMREM) | same + mirror floor | path-traced, studio HDRI + softbox area lights |
| Shadows | key-light shadow computed once per model change + cached contact-shadow decal | same | path-traced |
| Ice / glass | glossy non-transmissive materials | real transmission (extra scene pass) | path-traced refraction |
| Ambient occlusion | baked into vertex colours (bowl grooves, pedestal coves) | + screen-space AO that fades in when still | path-traced |
| Redraws | only when something changes | same; optional progressive path tracing when still | background worker |

**Adaptive quality.** Rendering is on demand: a still view costs nothing. The canvas pixel ratio starts at 1 on a GPU (0.6 in software), drops while you drag (tuned to the measured frame rate, never below 0.3) and steps back up in small increments once you stop, so the image sharpens without popping. Screen-space AO fades in the same way. The cup has two levels of detail (about 115k and 23k triangles); the low one is used while a shape slider is dragged and when the cup is small on screen (with hysteresis).

**Geometry is built once.** Meshes are generated only when a shape parameter changes; camera moves only change transforms. The fluted bowl uses curvature-adaptive rows (more rows where the profile bends and where the flutes start and end, fewer on the smooth band) and a fixed number of samples per flute. Measured: a full cold build is about 100 ms; a colour or material change reuses every cached mesh (about 4 ms).

**CPU fallback: cached turntable.** On software rendering (or if dragging stays under 6 fps at the lowest resolution) the viewer renders a ring of 36 views around the current target, at the current elevation and distance, in a background worker. While you drag, the nearest two cached views are cross-faded; zoom and pan are applied in 2D while the ring still covers the view. When you let go, the live 3D render takes over, so the real geometry and materials stay the source of truth. Progress shows in the readout; you can keep working while it renders. Toggle: *View settings → Cached turntable while dragging*.

**Final render.** *Final render* (header) path-traces the framed view in the background worker at the size set under *View settings → Final render* (1600–3200 px tall, 64–256 samples). A raster preview of the framing appears at once, the still refines in the left pane while the live 3D view stays usable on the right, and *Download PNG* saves it.

Measured in headless Chrome with SwiftShader (software rendering, 2 CPU cores), 1300 × 900 window:

| | before | after |
|---|---|---|
| idle (nothing moving) | renders continuously, 0.3 fps | no redraws |
| dragging, live view | 0.3–0.5 fps | 14 fps (Fast preview, 0.3× resolution) |
| dragging, cached turntable | — | 60 fps (first cache ≈ 30 s, then loaded from disk) |
| colour change | ≈ 100 ms rebuild + texture redraw | ≈ 4 ms |

### Where things are stored and when they are invalidated

| What | Where | Invalidated when |
|---|---|---|
| Geometry (vertices, indices, normals, UVs, baked AO colours) | in memory, `cachedGeometry()` in `src/trophy.js`: an LRU of 600 entries keyed by the shape numbers only (the main thread and the worker each have one) | a shape parameter changes (new key); least-recently-used entries are disposed. Colour, material, visibility, exploded view and camera never rebuild geometry |
| Brand textures (front logo, bottle label, neck foil) | in memory (`TX` in `index.html`; sent to the worker once as ImageBitmaps) | a logo is uploaded or removed |
| Environment maps, detail roughness map, contact-shadow texture | in memory, built once per session | never |
| Key-light shadow map | GPU memory | model, visibility, exploded view or panel position changes |
| Cached turntable views | IndexedDB `trophy-cooler-cache` → store `turntables`: 36 WebP frames + camera metadata per record; the current ring is also held as ImageBitmaps | any object state (all parameters, visibility, explode, panel, environment, preview mode, logo), the frame size, or a camera elevation, distance or target outside the ring's range: a new key is rendered. The newest 4 rings are kept. Clear the site data to remove them |
| Final render | in memory (PNG blob) until you render again or close the pane | — |
| Settings | `localStorage` (`trophy-cooler-model-v6`, `-mode`, `-tt`, `-final`, `-hq`, `-photo2`) | — |

Limitations of CPU-only rendering: everything still runs on the processor, so a final render or turntable generation in the worker shares the CPU with the live view (the viewer stays responsive, but individual frames can stall briefly). The cached turntable only covers orbiting around the current elevation; tilting far up or down or zooming a lot shows the live (low-resolution) view until a new ring is cached. Fast preview's ice and glass are not see-through; use High quality or the final render for refraction. A 2400 px, 256-sample final render can take tens of minutes without a graphics card; 1600 px at 64 samples is the software default.

## Files
| Path | What |
|---|---|
| `src/trophy.js` | Parametric geometry (inches, +Y up, +Z front), geometry cache, LOD, baked AO, materials (fast + full) |
| `src/stage.js` | Scene pieces shared by the viewer and the worker: environment, lights, ground, path-tracer extras, model assembly |
| `src/render-worker.js` | Background worker: cached turntable and final render on an OffscreenCanvas |
| `src/index.html` | Studio UI, adaptive render loop, preview modes, turntable display, performance readout |
| `scripts/build.mjs` | Bundles everything into a single `dist/index.html`, with the worker embedded (deployed by Vercel) |
| `scripts/export-models.mjs` | Writes GLB (meters) and STL (inches): the whole trophy and each section |

```bash
npm install && npm run build      # dist/index.html
npm run export-models             # models/glb, models/stl
```

> Visual concept, not a fabrication model. Weights and clearances are estimates. The front-panel lockup is a placeholder until approved logo artwork is uploaded in the studio.
