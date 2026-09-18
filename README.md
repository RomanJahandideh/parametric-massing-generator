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

## AI-assisted parsing

Instead of setting sliders by hand, you can paste a bylaw excerpt or describe a lot in plain English, and Claude reads it and fills in the parameters directly. This uses **your own Anthropic API key**, entered in the browser and sent directly from your browser to Anthropic's API. It is never sent to, stored by, or visible to this site, there is no backend here at all, this is a static site with no server.

This only works because Anthropic's API explicitly supports direct browser requests via an opt-in `anthropic-dangerous-direct-browser-access` header, meant for exactly this "bring your own key" pattern. Most LLM APIs (OpenAI included) block this by design, since an embedded key in client code is trivially stealable; the point here is that no key is ever embedded, each visitor supplies and uses only their own.

## Tech

- Plain JavaScript and [Three.js](https://threejs.org/) (loaded via CDN, no build step)
- A hand-rolled minimal orbit control (drag to rotate, scroll to zoom)
- All the massing logic (footprint, floor count, FAR check) lives in `main.js`'s `regenerate()` function
- The AI parsing calls Claude directly from the browser, with a prompt prefill to force a bare JSON object back, then maps and clamps the result onto the sliders

## Why I built this

I work across architecture, landscape architecture, and interactive systems, and I wanted a small, concrete demonstration of computational and parametric design: turning written constraints, whether set by hand or read out of a bylaw by an LLM, into a generated 3D form. That's the same basic move behind a lot of generative and agentic design tools working on zoning and massing today, just at a much smaller scale: one parsing call instead of a full multi-agent pipeline that retrieves clauses, checks compliance, and revises a design.

## Run it locally

No build step. Serve the folder and open `index.html`:

```
npx serve .
```
