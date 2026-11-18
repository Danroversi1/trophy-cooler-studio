# Michelob ULTRA Trophy Cooler

An interactive 3D model of the trophy cooler, built from the reference render. A chrome bowl with spiral flutes sits on a stepped pedestal, on top of a wide Michelob-blue enclosure that houses a **Meling DW-XL90** freezer.

**Live:** https://trophy-cooler-studio.vercel.app

## The model
- **Enclosure:** 61 × 30 × 36.5 in body on 4.5 in casters, sized for the freezer (23.6 × 32.0 × 24.6 in).
  - About 17.9 in clear on each side, 2.2 in behind and 1.5 in above.
  - The front panel lifts off by its two handles.
  - The bottom vent band lines up with the freezer's front vent.
  - Optional UHMW ice skids replace the casters for on-ice use.
- **Cup:** 61 in bowl (as wide as the box, as in the render) with 28 twisted flutes and a polished rim band, on a five-step 22.9 in pedestal.
- **Bottles + ice:** 12 Michelob ULTRA long-necks leaning out of a heaped ice bed (adjustable to 36).
- **Overall:** about 7′9″ tall.

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
