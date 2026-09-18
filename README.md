# Parametric Massing Generator

A small computational design tool that generates a buildable massing envelope from lot dimensions and zoning constraints: setbacks, height limit, floor-to-floor height, and floor area ratio (FAR).

**Try it live:** open `index.html` in a browser, or serve the folder with any static file server.

## What it does

Instead of drawing a massing model by hand, this tool derives it directly from the numbers a zoning bylaw already gives you:

- The **lot** is defined by width and depth.
- **Setbacks** (front, side, rear) carve out the buildable footprint inside the lot.
- The number of **floors** is capped by whichever constraint binds first: the height limit, or the maximum floor area ratio (FAR).
- The generated envelope, floor count, gross floor area, and achieved FAR update live as any parameter changes.

It's a first-pass generative check, the kind of thing you'd want before spending time on a detailed design that turns out to not fit the envelope at all.

## Tech

- Plain JavaScript and [Three.js](https://threejs.org/) (loaded via CDN, no build step)
- A hand-rolled minimal orbit control (drag to rotate, scroll to zoom)
- All the massing logic (footprint, floor count, FAR check) lives in `main.js`'s `regenerate()` function

## Why I built this

I work across architecture, landscape architecture, and interactive systems, and I wanted a small, concrete demonstration of computational and parametric design: turning written constraints (setbacks, height, FAR) into a generated 3D form, the same basic move behind a lot of generative and agentic design tools working on zoning and massing today.

## Run it locally

No build step. Serve the folder and open `index.html`:

```
npx serve .
```
