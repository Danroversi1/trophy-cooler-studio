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

**Render still:** path-traces the current camera at full resolution (2400 px tall, 256 samples) on your GPU and shows it beside the live 3D model. Click the still to view it at 100 %, or download it as a PNG.

**Brand:** the enclosure and bottle labels use the supplied Michelob ULTRA logo (`src/assets/`). An uploaded logo replaces it.

**Rendering:** **Photoreal** mode path-traces the scene with a studio HDRI and softbox area lights, and refines whenever the view is still. On by default in the studio view. Orbiting uses the real-time renderer.

All dimensions are parametric. **Keep the render's proportions** scales the cup with the enclosure width. The freezer fit is checked live, and the box can't be made smaller than the freezer.

## Files
| Path | What |
|---|---|
| `src/trophy.js` | Parametric geometry (inches, +Y up, +Z front) |
| `src/index.html` | Studio UI |
| `scripts/build.mjs` | Bundles everything into a single `dist/index.html` (deployed by Vercel) |
| `scripts/export-models.mjs` | Writes GLB (meters) and STL (inches): the whole trophy and each section |

```bash
npm install && npm run build      # dist/index.html
npm run export-models             # models/glb, models/stl
```

> Visual concept, not a fabrication model. Weights and clearances are estimates. The front-panel lockup is a placeholder until approved logo artwork is uploaded in the studio.
