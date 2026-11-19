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

## Second design: the cooler

Switch with **Design → Cooler** at the top of the panel. A brushed-stainless chest cooler after the client's reference: blue faceted trim around the rim and the lid, clear crystal lid corners, a front latch, side handles with blue faceted grips, a drain plug, and the Michelob ULTRA logo on the front with a faceted red ribbon.

- **Freezer:** the Meling DW-XL90 stands upright inside, behind a **front door** (hinged on the left, flush pull, vent slots at the bottom for the freezer's front vent). Default 64 × 32 × 43 in body: 18.7 in each side, 0.8 in under the ice well, 3.4 in behind. The fit is checked live.
- **Ice well:** the top 8 in of the body; bottles stand in staggered rows in big clear cubes, labels to the front. The count follows the well size (36 at the default size, 28 at 48 in long, 48 at 80 in long).
- **Proportions:** length about 1.5 × the body height, like a classic steel-belted cooler. The body has to be about 43 in tall to fit the freezer under the well, which sets the overall size.
- **Base:** UHMW-PE ice runners, no wheels.
- Controls: length, depth, height, ice-well depth, lid angle, front door, X-ray, trim colour. Part keys match the trophy, so layers, export and the render worker work the same way.

## Reference window

The top-left of the viewport shows the image each design was modelled from; click it to see it full size (Esc or *Close* to go back), or minimize it with *–*. The images live in `src/refs/` (`trophy.jpg`, `cooler.jpg`) and are embedded in every build, so anyone with the link sees them. To change one, replace the file and push. A visitor can also swap in their own image with *Replace image*; that copy stays in their browser only (IndexedDB `trophy-cooler-refs`) and *Use original* goes back.

## Rendering pipeline

Everything is real-time WebGL (three.js): no path tracing, no cloud. The viewer detects whether WebGL runs on a hardware GPU (integrated graphics count) or in **software** (SwiftShader, llvmpipe, Microsoft Basic Render — i.e. on the CPU) and adapts. The readout in the bottom-right corner shows the preview mode, frame rate, render resolution and scale, and hardware vs software rendering.

| | Fast preview (default) | High quality | Detail render |
|---|---|---|---|
| Reflections | precomputed environment map (PMREM) | same + mirror floor | same + mirror floor |
| Shadows | key-light shadow computed once per model change + cached contact-shadow decal | same | same |
| Ice / glass | glossy non-transmissive materials | see-through (transmission) | see-through (transmission) |
| Ambient occlusion | baked into vertex colours (bowl grooves, pedestal coves) | + screen-space AO that fades in when still | baked |
| Resolution | adaptive (below) | adaptive | 1200–3200 px tall, supersampled 1.25–2× |
| When | live, redraws only on change | live | one frame, in a background worker |

**Detail render** (header button) renders the framed view once with full materials, the mirror floor and supersampling, and shows it beside the live view with *Download PNG*. It runs in a background worker, so the live view keeps working. Measured: about 1 s on a hardware GPU; in software (2-core test machine) about 4–5 s at 1200 px (the software default) and 8 s at 1600 px (12 s the first time, while shaders compile). Size: *View settings → Detail render*.

**Adaptive quality.** Rendering is on demand: a still view costs nothing. The canvas pixel ratio starts at 1 on a GPU (0.6 in software), drops while you drag (tuned to the measured frame rate, never below 0.3) and steps back up in small increments once you stop, so the image sharpens without popping. Screen-space AO (High quality) fades in the same way. The cup has two levels of detail (about 115k and 23k triangles); the low one is used while a shape slider is dragged and when the cup is small on screen (with hysteresis).

**Geometry is built once.** Meshes are generated only when a shape parameter changes; camera moves only change transforms. The fluted bowl uses curvature-adaptive rows (more rows where the profile bends and where the flutes start and end, fewer on the smooth band) and a fixed number of samples per flute. Measured: a full cold build is about 100 ms; a colour or material change reuses every cached mesh (about 4 ms).

**CPU fallback: cached turntable.** On software rendering (or if dragging stays under 6 fps at the lowest resolution) the viewer renders a ring of 36 views around the current target, at the current elevation and distance, in the background worker. While you drag, the nearest two cached views are cross-faded; zoom and pan are applied in 2D while the ring still covers the view. When you let go, the live 3D render takes over, so the real geometry and materials stay the source of truth. Progress shows in the readout; you can keep working while it renders. Toggle: *View settings → Cached turntable while dragging*.

Measured in headless Chrome with SwiftShader (software rendering, 2 CPU cores), 1300 × 900 window:

| | before | after |
|---|---|---|
| idle (nothing moving) | renders continuously, 0.3 fps | no redraws |
| dragging, live view | 0.3–0.5 fps | 14 fps (Fast preview, 0.3× resolution) |
| dragging, cached turntable | — | 60 fps (first cache ≈ 30 s, then loaded from disk) |
| colour change | ≈ 100 ms rebuild + texture redraw | ≈ 4 ms |
| presentation still | minutes (path traced) | 4–8 s Detail render (≈ 1 s on a GPU) |

### Where things are stored and when they are invalidated

| What | Where | Invalidated when |
|---|---|---|
| Geometry (vertices, indices, normals, UVs, baked AO colours) | in memory, `cachedGeometry()` in `src/trophy.js`: an LRU of 600 entries keyed by the shape numbers only (the main thread and the worker each have one) | a shape parameter changes (new key); least-recently-used entries are disposed. Colour, material, visibility, exploded view and camera never rebuild geometry |
| Brand textures (front logo, bottle label, neck foil) | in memory (`TX` in `index.html`; sent to the worker once as ImageBitmaps) | a logo is uploaded or removed |
| Environment maps, roughness detail map, contact-shadow texture | in memory, built once per session | never |
| Key-light shadow map | GPU memory | model, visibility, exploded view or panel position changes |
| Cached turntable views | IndexedDB `trophy-cooler-cache` → store `turntables`: 36 WebP frames + camera metadata per record; the current ring is also held as ImageBitmaps | any object state (all parameters, visibility, explode, panel, environment, preview mode, logo), the frame size, or a camera elevation, distance or target outside the ring's range: a new key is rendered. The newest 4 rings are kept. Clear the site data to remove them |
| Detail render | in memory (PNG blob) until you render again or close the pane | — |
| Settings | `localStorage` (`trophy-cooler-model-v6`, `-mode`, `-tt`, `-detail`, `-hq`) | — |

Limitations of CPU-only rendering: everything still runs on the processor, so turntable generation or a Detail render in the worker shares the CPU with the live view (the viewer stays responsive, but individual frames can stall briefly). The cached turntable only covers orbiting around the current elevation; tilting far up or down or zooming a lot shows the live (low-resolution) view until a new ring is cached. Fast preview's ice and glass are not see-through; use High quality or the Detail render for that.

## Files
| Path | What |
|---|---|
| `src/cooler.js` | Cooler design: body, front door, lid, trim, handles, ice well, bottle grid, fit check, weights |
| `src/trophy.js` | Parametric geometry (inches, +Y up, +Z front), geometry cache, LOD, baked AO, materials (fast + full) |
| `src/stage.js` | Scene pieces shared by the viewer and the worker: environment, lights, ground, model assembly |
| `src/render-worker.js` | Background worker: cached turntable and Detail render on an OffscreenCanvas |
| `src/index.html` | Studio UI, adaptive render loop, preview modes, turntable display, performance readout |
| `scripts/build.mjs` | Bundles everything into a single `dist/index.html`, with the worker embedded (deployed by Vercel) |
| `scripts/export-models.mjs` | Writes GLB (meters) and STL (inches): the whole trophy and each section |

```bash
npm install && npm run build      # dist/index.html
npm run export-models             # models/glb, models/stl
```

> Visual concept, not a fabrication model. Weights and clearances are estimates. The front-panel lockup is a placeholder until approved logo artwork is uploaded in the studio.
