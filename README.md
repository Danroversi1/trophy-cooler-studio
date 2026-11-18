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
