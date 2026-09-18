# Parametric Massing Generator

A computational design tool that generates a buildable massing envelope from zoning constraints, on a rectangular lot or an irregular parcel, with AI-assisted parsing, source citations, an independent reviewer pass, and a multi-view (3D + plan) output.

**Try it live:** open `index.html` in a browser, or serve the folder with any static file server.

## What it does

Instead of drawing a massing model by hand, this tool derives it directly from the numbers a zoning bylaw already gives you, and it works on more than just a simple rectangle:

- **Simple lot mode:** width, depth, and front/side/rear setbacks, the common case.
- **Irregular parcel mode:** three non-rectangular parcel shapes (a chamfered street-corner lot, a narrow-frontage lot, and a triangular corner lot at a diagonal intersection), each with its own per-edge setbacks. The buildable footprint is computed as a true inward offset of the parcel polygon, not a bounding-box approximation, using half-plane intersection (Sutherland-Hodgman clipping against each inward-shifted edge in turn), which is correct for any convex polygon. This is closer to how modeling agents work directly against real parcel geometry instead of a fixed rectangular typology.
- The number of **floors** is capped by whichever constraint binds first: the height limit, or the maximum floor area ratio (FAR).
- A **plan view** renders alongside the 3D massing (multi-view rendering), a live top-down SVG showing the parcel boundary and the buildable footprint.
- Stats update live: footprint area, floor count, gross floor area, achieved FAR, and an envelope-compactness ratio (exterior surface area per m² of floor area, a simple architectural performance proxy, not a certified energy model).
- A few simplified, clearly-labeled **performance and code heuristics** flag when the massing crosses common thresholds: an approximate BC Building Code Part 9 (wood-frame) vs. Part 3 (non-combustible) construction-type threshold, a floor-plate-depth daylighting note, and a height-to-footprint slenderness note for structural feasibility. These are rules of thumb for an early sanity check, not code-compliance advice.

It's a first-pass generative check, the kind of thing you'd want before spending time on a detailed design that turns out to not fit the envelope at all.

## A real Vancouver zoning district, with its actual conditional rules

Since Vancouver is the test bed for a lot of current zoning-and-AI research, there's a "Zoning preset" dropdown with the City of Vancouver's **R1-1 (Residential Inclusive)** district, the multiplex zoning that replaced single-family-only RS zoning citywide in November 2023. This isn't a rounded-off approximation, it's the district's real base provisions: 4.9m front setback, 1.2m side yards, 10.7m rear yard, 11.5m / 3-storey height limit, and a floor space ratio that is itself conditional (0.70 base, rising to 1.00 if a unit is secured rental or below-market housing, an actual checkbox in the tool, not a static number).

The lot-width and lot-depth sliders also drive a live **unit-count eligibility check** against R1-1's real frontage and lot-area thresholds (10.0m / 306m² for 3–4 units, 13.4m / 464m² for 4–5 units, 15.1m / 557m² for 6–8 units), including a warning when a lot is too small to qualify for a multiplex at all. That's a small, concrete example of the same "structures conditional rules" idea Decoding Urban Form is built around: a real bylaw's numbers aren't one flat figure, they branch on conditions, and the tool represents that branching instead of flattening it into a single value.

## AI-assisted parsing, with citations and a reviewer that can suggest a fix

Instead of setting sliders by hand, you can paste a bylaw excerpt or describe a lot in plain English (there's a "Vancouver example" button that fills in a description based on the real R1-1 provisions above). This runs in two steps, deliberately mirroring how a real regulatory-reading pipeline should behave, not just guessing a number and moving on:

1. **Parse with citations.** Claude extracts each parameter along with the exact phrase in your text it came from, and a confidence level (high / medium / low / none). If it can't find or reasonably infer a value, it says so instead of fabricating one. The extracted values, their sources, and their confidence are all shown, so nothing is a black box.
2. **Independent review, with a suggested fix.** A second, separate call checks the generated massing (floor count, height, FAR achieved) against the original text and the extracted parameters, and flags "concerns" if a stated constraint wasn't reflected, a value had to be guessed with low confidence, or the achieved numbers drift meaningfully from what was asked for. When it can point to a single field that would resolve the concern, it proposes a corrected value, shown as a one-click "apply reviewer's fix" button, rather than just flagging a problem and leaving it there.

Every parse and every applied fix is written to a visible **generation history** log (timestamp, source, and the resulting floor count/GFA/FAR), so there's a traceable record of how the current proposal was arrived at, not just its final state.

This is a small-scale version of the same idea behind traceable, citation-preserving generative design: keep the source, the uncertainty, an independent check, and a record of how a proposal was generated and reviewed, all visible, instead of handing back a single confident-looking number with no way to verify it.

Both AI steps use **your own Anthropic API key**, entered in the browser and sent directly from your browser to Anthropic's API. It is never sent to, stored by, or visible to this site, there is no backend here at all, this is a static site with no server. (AI parsing targets the simple rectangular model; irregular parcel shapes are chosen from the presets, a deterministic geometry capability kept deliberately separate from free-text parsing.)

This only works because Anthropic's API explicitly supports direct browser requests via an opt-in `anthropic-dangerous-direct-browser-access` header, meant for exactly this "bring your own key" pattern. Most LLM APIs (OpenAI included) block this by design, since an embedded key in client code is trivially stealable; the point here is that no key is ever embedded, each visitor supplies and uses only their own.

## Tech

- Plain JavaScript and [Three.js](https://threejs.org/) (loaded via CDN, no build step)
- A hand-rolled minimal orbit control (drag to rotate, scroll to zoom)
- Parcel offsetting is a from-scratch half-plane intersection (Sutherland-Hodgman) implementation, verified against known rectangle and triangle test cases (exact area match) before being wired into the UI
- The 3D massing is a manually triangulated extrusion (explicit fan triangulation of the footprint for the top/bottom caps, plus a quad per edge for the walls) rather than `THREE.ExtrudeGeometry`, so the x/y/z mapping is explicit and matches the rest of the file's ground-plane convention, no coordinate-space guessing
- The plan view is a generated SVG, not a second WebGL context, kept simple and easy to verify
- All the massing logic (footprint, floor count, FAR check, envelope ratio, performance notes) lives in `main.js`'s `regenerate()` function, which now works uniformly on a parcel polygon + per-edge setbacks, whether that polygon came from the simple-mode sliders or an irregular-mode preset
- The AI parsing and review both call Claude directly from the browser, with a prompt prefill to force a bare JSON object back each time, then map and clamp the result onto the sliders

## Why I built this

I work across architecture, landscape architecture, and interactive systems, and I wanted a small, concrete demonstration of computational and parametric design: turning written constraints, whether set by hand or read out of a bylaw by an LLM, into a generated 3D form on real (if simplified) parcel geometry, not just a rectangle, with the source of every value kept visible, a second independent pass checking the result, and a record of how each version came to be. That's a smaller version of the same basic pattern behind generative and agentic design tools working on zoning and massing today: read, structure, generate against real geometry, and verify, rather than just generate.

## A note on the Vancouver numbers

The R1-1 figures above are drawn from the City of Vancouver's public zoning provisions for the district as adopted in November 2023, cross-checked across multiple current sources rather than taken from a single one. They're simplified for a demo (a few conditional provisions, like the separate, shorter rules for a rear building in a courtyard configuration, aren't modeled), and bylaws get amended, so this is a starting point for exploration, not something to design or apply from without checking the current official bylaw and your specific lot.

## Run it locally

No build step. Serve the folder and open `index.html`:

```
npx serve .
```
