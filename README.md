# Parametric Massing Generator

A computational design tool that generates a buildable massing envelope from zoning constraints, from a single rectangular lot up to a whole AI-zoned urban block, with agentic AI-assisted parsing and conversational refinement, source citations, an independent reviewer pass, structured conditional rules, and a multi-view (3D + plan) output.

**Try it live:** [romanjahandideh.github.io/parametric-massing-generator](https://romanjahandideh.github.io/parametric-massing-generator/) (no build step needed to run locally either, see "Run it locally" below).

## How to test it

You'll need your own Anthropic API key for the AI features (entered on the page, sent directly to Anthropic, never to this site, see "AI-assisted parsing" below); the sliders and mode switching work with no key at all.

1. **Simple lot, no AI.** Drag the sliders (lot width, setbacks, height, FAR). The 3D massing and the 2D plan view should update instantly, and the stats panel should show which constraint (height or FAR) is currently binding.
2. **AI parsing with citations.** Click "Vancouver example" to fill in a real bylaw-style description, then "Parse with AI." You should see each field applied with the exact phrase it was read from and a confidence level, followed by an independent reviewer verdict underneath.
3. **Conversational refinement.** After a parse, type something like *"make it one storey taller"* into the refine box. Only the height should change, everything else should hold, and it should show up as a new turn in the conversation log and the generation history.
4. **A real, conditional zoning district.** Switch the "Zoning preset" dropdown to "Vancouver R1-1 multiplex." The setback, height, and FAR sliders should snap to the district's real base provisions. Toggle the rental-bonus checkbox, FAR should jump from 0.70 to 1.00, that's the bylaw's actual conditional rule, not a fixed number. Try shrinking the lot width below 10m and watch the eligibility note change to a warning.
5. **Irregular parcel geometry.** Switch to "Irregular parcel" mode and try each preset (corner, flag, triangular lot). The buildable footprint should follow the parcel's actual shape, not a bounding box.
6. **Urban block, AI-zoned.** Switch to "Urban block" mode, type a zoning instruction like *"commercial along the south edge, a park in the northeast corner,"* and click "Classify zones with AI." Parcels should render in different colors by use, with the north-facing side (top of the plan view) matching whatever you asked for.

## What it does

Instead of drawing a massing model by hand, this tool derives it directly from the numbers a zoning bylaw already gives you, and it works on more than just a simple rectangle:

- **Simple lot mode:** width, depth, and front/side/rear setbacks, the common case.
- **Irregular parcel mode:** three non-rectangular parcel shapes (a chamfered street-corner lot, a narrow-frontage lot, and a triangular corner lot at a diagonal intersection), each with its own per-edge setbacks. The buildable footprint is computed as a true inward offset of the parcel polygon, not a bounding-box approximation, using half-plane intersection (Sutherland-Hodgman clipping against each inward-shifted edge in turn), which is correct for any convex polygon. This is closer to how modeling agents work directly against real parcel geometry instead of a fixed rectangular typology.
- The number of **floors** is capped by whichever constraint binds first: the height limit, or the maximum floor area ratio (FAR).
- A **plan view** renders alongside the 3D massing (multi-view rendering), a live top-down SVG showing the parcel boundary and the buildable footprint.
- Stats update live: footprint area, floor count, gross floor area, achieved FAR, and an envelope-compactness ratio (exterior surface area per m² of floor area, a simple architectural performance proxy, not a certified energy model).
- A few simplified, clearly-labeled **performance and code heuristics** flag when the massing crosses common thresholds: an approximate BC Building Code Part 9 (wood-frame) vs. Part 3 (non-combustible) construction-type threshold, a floor-plate-depth daylighting note, and a height-to-footprint slenderness note for structural feasibility. These are rules of thumb for an early sanity check, not code-compliance advice.

It's a first-pass generative check, the kind of thing you'd want before spending time on a detailed design that turns out to not fit the envelope at all.

## Urban block mode: AI-zoned city blocks, not just one building

This is the biggest step up in scope, from generating a single building's envelope to generating an entire block. A larger site is subdivided into a grid of parcels (with a street/access gap between them), and each parcel gets a functional zone, residential, commercial, administrative, or park, each with its own real setback, height, and FAR rules. Park parcels get no building at all, just open space.

Zoning can be assigned with AI, using directional language the way a planner actually talks: *"commercial along the south edge, a park in the northeast corner, residential everywhere else."* Claude gets each parcel's normalized position in the site (0 to 1 on each axis) and interprets fuzzy relational language against the *other parcels in the set*, "most east" means the highest X among them, not a fixed threshold, mirroring the exact coordinate-and-fuzzy-direction classification approach documented for the Urban Functional Zoning team in this lab's own DigitalFUTURES 2025 workshop paper. The whole block regenerates, with a live 3D scene, a color-coded 2D plan view (correctly north-up), and aggregate stats, total site area, total GFA, block-wide FAR, and a per-zone parcel breakdown.

This moves the tool from a single-building generator to something that actually produces **urban form**, the project's own name, not just one massing envelope in isolation.

## A real Vancouver zoning district, with its actual conditional rules

Since Vancouver is the test bed for a lot of current zoning-and-AI research, there's a "Zoning preset" dropdown with the City of Vancouver's **R1-1 (Residential Inclusive)** district, the multiplex zoning that replaced single-family-only RS zoning citywide in November 2023. This isn't a rounded-off approximation, it's the district's real base provisions: 4.9m front setback, 1.2m side yards, 10.7m rear yard, 11.5m / 3-storey height limit, and a floor space ratio that is itself conditional (0.70 base, rising to 1.00 if a unit is secured rental or below-market housing, an actual checkbox in the tool, not a static number).

The lot-width and lot-depth sliders also drive a live **unit-count eligibility check** against R1-1's real frontage and lot-area thresholds (10.0m / 306m² for 3–4 units, 13.4m / 464m² for 4–5 units, 15.1m / 557m² for 6–8 units), including a warning when a lot is too small to qualify for a multiplex at all. That's a small, concrete example of the same "structures conditional rules" idea Decoding Urban Form is built around: a real bylaw's numbers aren't one flat figure, they branch on conditions, and the tool represents that branching instead of flattening it into a single value.

## AI-assisted parsing, with citations and a reviewer that can suggest a fix

Instead of setting sliders by hand, you can paste a bylaw excerpt or describe a lot in plain English (there's a "Vancouver example" button that fills in a description based on the real R1-1 provisions above). This runs in two steps, deliberately mirroring how a real regulatory-reading pipeline should behave, not just guessing a number and moving on:

1. **Parse with citations.** Claude extracts each parameter along with the exact phrase in your text it came from, and a confidence level (high / medium / low / none). If it can't find or reasonably infer a value, it says so instead of fabricating one. The extracted values, their sources, and their confidence are all shown, so nothing is a black box.
2. **Independent review, with a suggested fix.** A second, separate call checks the generated massing (floor count, height, FAR achieved) against the original text and the extracted parameters, and flags "concerns" if a stated constraint wasn't reflected, a value had to be guessed with low confidence, or the achieved numbers drift meaningfully from what was asked for. When it can point to a single field that would resolve the concern, it proposes a corrected value, shown as a one-click "apply reviewer's fix" button, rather than just flagging a problem and leaving it there.

Every parse and every applied fix is written to a visible **generation history** log (timestamp, source, and the resulting floor count/GFA/FAR), so there's a traceable record of how the current proposal was arrived at, not just its final state.

This is a small-scale version of the same idea behind traceable, citation-preserving generative design: keep the source, the uncertainty, an independent check, and a record of how a proposal was generated and reviewed, all visible, instead of handing back a single confident-looking number with no way to verify it.

## Conversational refinement, not just one-shot parsing

After a parse, a "Refine conversationally" box appears: type a follow-up instruction, like *"make it one storey taller"* or *"switch to the rental bonus"* or *"reduce the front setback to 3m"*, and Claude interprets it as a change against the **current** state, not a fresh parse from scratch. Only the field(s) the instruction actually affects change; everything else holds. Each turn is logged as a visible exchange (the instruction, and exactly what it changed), and the independent reviewer runs again after every turn, so a multi-step conversation stays just as checkable as the first parse.

This is meant to actually behave like a conversation, prompt, see the result, refine, rather than a single request-response. It's a small, single-user version of the same idea behind treating AI as a continuing collaborator in a modeling session, not a one-shot generator you re-prompt from zero every time you want a change.

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
