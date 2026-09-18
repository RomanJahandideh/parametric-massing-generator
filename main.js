(function () {
  "use strict";

  var viewport = document.getElementById("viewport");
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  scene.fog = new THREE.Fog(0x0b0d10, 60, 220);

  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewport.insertBefore(renderer.domElement, viewport.firstChild);

  // --- lights ---
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(40, 60, 20);
  scene.add(sun);
  var fill = new THREE.DirectionalLight(0x88aaff, 0.25);
  fill.position.set(-30, 20, -40);
  scene.add(fill);

  // --- ground ---
  var grid = new THREE.GridHelper(300, 60, 0x2a3138, 0x1a1e23);
  scene.add(grid);
  var groundGeo = new THREE.PlaneGeometry(300, 300);
  var groundMat = new THREE.MeshStandardMaterial({ color: 0x0e1114, roughness: 1 });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  // --- simple manual orbit controls ---
  var target = new THREE.Vector3(0, 6, 0);
  var radius = 55, azimuth = Math.PI * 0.22, elevation = 0.55;
  var dragging = false, lastX = 0, lastY = 0;

  function updateCamera() {
    var ce = Math.cos(elevation), se = Math.sin(elevation);
    var ca = Math.cos(azimuth), sa = Math.sin(azimuth);
    camera.position.set(
      target.x + radius * ce * sa,
      target.y + radius * se,
      target.z + radius * ce * ca
    );
    camera.lookAt(target);
  }

  renderer.domElement.addEventListener("pointerdown", function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener("pointerup", function () { dragging = false; });
  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    azimuth -= dx * 0.006;
    elevation = Math.max(0.08, Math.min(1.4, elevation + dy * 0.006));
    updateCamera();
  });
  renderer.domElement.addEventListener("wheel", function (e) {
    e.preventDefault();
    radius = Math.max(12, Math.min(160, radius + e.deltaY * 0.04));
    updateCamera();
  }, { passive: false });

  // ==========================================================================
  // Polygon geometry: inward offset by (possibly different) per-edge setbacks,
  // via half-plane intersection (Sutherland-Hodgman clipping against each
  // inward-shifted edge in turn). Correct for any convex polygon, including
  // the plain rectangle used in "simple" mode. Verified against known
  // rectangle/triangle test cases before wiring into the app.
  // ==========================================================================

  function signedArea(poly) {
    var a = 0;
    for (var i = 0; i < poly.length; i++) {
      var p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      a += p1.x * p2.z - p2.x * p1.z;
    }
    return a / 2;
  }

  function shoelaceArea(poly) {
    return Math.abs(signedArea(poly));
  }

  function polygonPerimeter(poly) {
    var p = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      p += Math.hypot(b.x - a.x, b.z - a.z);
    }
    return p;
  }

  function intersectEdgeHalfPlane(p1, p2, ox, oz, nx, nz) {
    var dx = p2.x - p1.x, dz = p2.z - p1.z;
    var denom = dx * nx + dz * nz;
    var t = denom !== 0 ? (((ox - p1.x) * nx + (oz - p1.z) * nz) / denom) : 0;
    t = Math.max(0, Math.min(1, t));
    return { x: p1.x + dx * t, z: p1.z + dz * t };
  }

  function clipPolygonHalfPlane(poly, ox, oz, nx, nz) {
    if (poly.length === 0) return [];
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var curr = poly[i], prev = poly[(i - 1 + poly.length) % poly.length];
      var currIn = ((curr.x - ox) * nx + (curr.z - oz) * nz) >= -1e-9;
      var prevIn = ((prev.x - ox) * nx + (prev.z - oz) * nz) >= -1e-9;
      if (currIn) {
        if (!prevIn) out.push(intersectEdgeHalfPlane(prev, curr, ox, oz, nx, nz));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersectEdgeHalfPlane(prev, curr, ox, oz, nx, nz));
      }
    }
    return out;
  }

  function offsetPolygonInward(poly, setbacks) {
    var inwardSign = signedArea(poly) > 0 ? -1 : 1;
    var current = poly.slice();
    for (var i = 0; i < poly.length; i++) {
      if (current.length === 0) break;
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var setback = setbacks[i] || 0;
      var dx = b.x - a.x, dz = b.z - a.z;
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-9) continue;
      dx /= len; dz /= len;
      var nx = inwardSign * dz, nz = -inwardSign * dx;
      var ox = a.x + nx * setback, oz = a.z + nz * setback;
      current = clipPolygonHalfPlane(current, ox, oz, nx, nz);
    }
    return current;
  }

  // ==========================================================================
  // Parcel presets: irregular, convex parcel shapes, each with per-edge
  // setbacks and labels. Vertices are CCW in the x-z (ground) plane.
  // ==========================================================================

  var PRESETS = {
    corner: {
      name: "Corner lot (chamfered street corner)",
      poly: [
        { x: -9, z: -12 }, { x: 6, z: -12 }, { x: 9, z: -9 },
        { x: 9, z: 12 }, { x: -9, z: 12 },
      ],
      setbacks: [4.5, 3, 3, 6, 1.5],
      labels: ["Front (main street)", "Corner chamfer (sightline)", "Flanking street side", "Rear", "Interior side"],
    },
    flag: {
      name: "Narrow-frontage lot",
      poly: [
        { x: -5, z: -15 }, { x: 5, z: -15 }, { x: 10, z: 15 }, { x: -10, z: 15 },
      ],
      setbacks: [4.5, 1.5, 6, 1.5],
      labels: ["Front (narrow)", "Side", "Rear (wide)", "Side"],
    },
    triangle: {
      name: "Triangular corner lot (diagonal intersection)",
      poly: [
        { x: -10, z: -10 }, { x: 14, z: -10 }, { x: -10, z: 14 },
      ],
      setbacks: [4.5, 3, 1.5],
      labels: ["Front (main street)", "Flanking street (diagonal)", "Interior side"],
    },
  };

  // ==========================================================================
  // 3D mesh + outline helpers, generalized to arbitrary convex polygons
  // (a plain rectangle in "simple" mode is just a 4-point polygon).
  // ==========================================================================

  var genGroup = new THREE.Group();
  scene.add(genGroup);

  function clearGroup(g) {
    while (g.children.length) {
      var c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function polygonOutline(poly, y, color) {
    if (poly.length < 2) return new THREE.Group();
    var pts = poly.map(function (p) { return new THREE.Vector3(p.x, y, p.z); });
    pts.push(pts[0]);
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = new THREE.LineBasicMaterial({ color: color });
    return new THREE.Line(geo, mat);
  }

  // Manually triangulated extrusion (fan triangulation, valid for convex
  // polygons) rather than THREE.Shape/ExtrudeGeometry, so the x/y/z mapping
  // is explicit and matches the rest of the file's ground-plane convention
  // (x-z is the ground plane, y is height) with no coordinate-space guessing.
  function buildExtrudedPolygonMesh(poly, height, material) {
    var n = poly.length;
    if (n < 3) return null;
    var positions = [];
    for (var i = 0; i < n; i++) positions.push(poly[i].x, 0, poly[i].z);
    for (i = 0; i < n; i++) positions.push(poly[i].x, height, poly[i].z);
    var indices = [];
    for (i = 1; i < n - 1; i++) indices.push(0, i, i + 1);
    for (i = 1; i < n - 1; i++) indices.push(n, n + i + 1, n + i);
    for (i = 0; i < n; i++) {
      var a = i, b = (i + 1) % n, aTop = n + i, bTop = n + ((i + 1) % n);
      indices.push(a, b, bTop);
      indices.push(a, bTop, aTop);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  function polygonBounds(poly) {
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    poly.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    return { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  }

  // ==========================================================================
  // 2D plan view (multi-view rendering): a live top-down SVG showing the
  // parcel boundary and the buildable (setback) footprint, alongside the
  // 3D view rather than instead of it.
  // ==========================================================================

  var planContainer = document.getElementById("plan-svg-container");

  function polyToSvgPoints(poly, toSvg) {
    return poly.map(function (p) {
      var s = toSvg(p);
      return s.x.toFixed(1) + "," + s.y.toFixed(1);
    }).join(" ");
  }

  function renderPlanView(parcelPoly, footprintPoly) {
    var b = polygonBounds(parcelPoly);
    var w = Math.max(1, b.maxX - b.minX), d = Math.max(1, b.maxZ - b.minZ);
    var pad = Math.max(w, d) * 0.12;
    var viewW = w + pad * 2, viewH = d + pad * 2;
    function toSvg(p) {
      // x -> right, z -> down the page (a schematic plan, not compass-oriented)
      return { x: p.x - b.minX + pad, y: p.z - b.minZ + pad };
    }
    var parcelPts = polyToSvgPoints(parcelPoly, toSvg);
    var footPts = footprintPoly.length >= 3 ? polyToSvgPoints(footprintPoly, toSvg) : "";
    var svg = "<svg viewBox=\"0 0 " + viewW.toFixed(1) + " " + viewH.toFixed(1) + "\" xmlns=\"http://www.w3.org/2000/svg\">" +
      "<polygon points=\"" + parcelPts + "\" fill=\"none\" stroke=\"#3a4148\" stroke-width=\"" + (viewW * 0.01) + "\" />" +
      (footPts ? "<polygon points=\"" + footPts + "\" fill=\"rgba(224,123,90,0.18)\" stroke=\"#e07b5a\" stroke-width=\"" + (viewW * 0.012) + "\" />" : "") +
      "</svg>";
    planContainer.innerHTML = svg;
  }

  // ==========================================================================
  // Controls, state, and the unified regenerate() pipeline
  // ==========================================================================

  var els = {};
  ["lotW", "lotD", "setF", "setS", "setR", "maxH", "floorH", "far"].forEach(function (id) {
    els[id] = document.getElementById(id);
  });
  var statsEl = document.getElementById("stats");
  var perfNotesEl = document.getElementById("perf-notes");
  var presetSelect = document.getElementById("preset-select");
  var presetSetbacksEl = document.getElementById("preset-setbacks");
  var simpleControls = document.getElementById("simple-controls");
  var irregularControls = document.getElementById("irregular-controls");
  var modeSimpleBtn = document.getElementById("mode-simple");
  var modeIrregularBtn = document.getElementById("mode-irregular");
  var zoningPresetSelect = document.getElementById("zoning-preset");
  var vancouverPanel = document.getElementById("vancouver-panel");
  var vancouverRentalBonus = document.getElementById("vancouver-rental-bonus");
  var vancouverEligibilityEl = document.getElementById("vancouver-eligibility");

  var mode = "simple"; // "simple" | "irregular"
  var lastStats = null;      // populated by regenerate(), read by the reviewer AI call
  var lastFootprint = null;  // last buildable footprint polygon, for the plan view / history

  function fmt(n, unit) {
    return (Math.round(n * 10) / 10) + (unit || "");
  }

  function buildSimpleParcel() {
    var w = parseFloat(els.lotW.value), d = parseFloat(els.lotD.value);
    var poly = [
      { x: -w / 2, z: -d / 2 }, { x: w / 2, z: -d / 2 },
      { x: w / 2, z: d / 2 }, { x: -w / 2, z: d / 2 },
    ];
    var setbacks = [
      parseFloat(els.setF.value), parseFloat(els.setS.value),
      parseFloat(els.setR.value), parseFloat(els.setS.value),
    ];
    return { poly: poly, setbacks: setbacks };
  }

  function renderPresetSetbacks(preset) {
    presetSetbacksEl.innerHTML = preset.labels.map(function (label, i) {
      return "<div>" + label + ": <b style=\"color:#e07b5a\">" + fmt(preset.setbacks[i]) + " m</b></div>";
    }).join("");
  }

  function currentParcel() {
    if (mode === "simple") return buildSimpleParcel();
    var preset = PRESETS[presetSelect.value];
    return { poly: preset.poly, setbacks: preset.setbacks };
  }

  // ==========================================================================
  // Vancouver R1-1 (Residential Inclusive) zoning preset: the district that
  // replaced single-family-only RS zoning citywide in November 2023. Unlike
  // the other presets, this one has real conditional rules baked into the
  // bylaw itself, floor space ratio depends on whether a unit is secured
  // rental/below-market, and the number of units (and whether a lot even
  // qualifies for a multiplex at all) depends on frontage and lot area
  // thresholds, structuring conditional rules the way an actual bylaw does,
  // rather than a single flat number.
  // ==========================================================================

  var VANCOUVER_R1_1 = {
    setF: 4.9, setS: 1.2, setR: 10.7, maxH: 11.5, floorH: 3.83,
    farBase: 0.70, farRentalBonus: 1.00,
    tiers: [
      { minFrontage: 15.1, minArea: 557, units: "6–8 units (6 strata, or 8 with secured rental)" },
      { minFrontage: 13.4, minArea: 464, units: "4–5 units" },
      { minFrontage: 10.0, minArea: 306, units: "3–4 units" },
    ],
  };

  function applyVancouverPreset() {
    els.setF.value = VANCOUVER_R1_1.setF;
    els.setS.value = VANCOUVER_R1_1.setS;
    els.setR.value = VANCOUVER_R1_1.setR;
    els.maxH.value = VANCOUVER_R1_1.maxH;
    els.floorH.value = VANCOUVER_R1_1.floorH;
    els.far.value = vancouverRentalBonus.checked ? VANCOUVER_R1_1.farRentalBonus : VANCOUVER_R1_1.farBase;
  }

  function renderVancouverEligibility() {
    var w = parseFloat(els.lotW.value), d = parseFloat(els.lotD.value);
    var area = w * d;
    var tier = VANCOUVER_R1_1.tiers.find(function (t) { return w >= t.minFrontage && area >= t.minArea; });
    if (tier) {
      vancouverEligibilityEl.innerHTML = "<span class=\"elig-ok\">✓ Qualifies for " + tier.units +
        "</span> at this frontage (" + fmt(w) + "m) and area (" + fmt(area) + "m²).";
    } else {
      vancouverEligibilityEl.innerHTML = "<span class=\"elig-warn\">⚠ Below the multiplex minimum</span> " +
        "(needs at least 10.0m frontage and 306m²); a duplex or single-family provision would apply instead " +
        "of the full R1-1 multiplex schedule at this size.";
    }
  }

  zoningPresetSelect.addEventListener("change", function () {
    var isVancouver = zoningPresetSelect.value === "vancouver-r1-1";
    vancouverPanel.style.display = isVancouver ? "block" : "none";
    if (isVancouver) {
      applyVancouverPreset();
      renderVancouverEligibility();
    }
    regenerate();
  });
  vancouverRentalBonus.addEventListener("change", function () {
    if (zoningPresetSelect.value !== "vancouver-r1-1") return;
    els.far.value = vancouverRentalBonus.checked ? VANCOUVER_R1_1.farRentalBonus : VANCOUVER_R1_1.farBase;
    regenerate();
  });

  function regenerate() {
    var maxH = parseFloat(els.maxH.value);
    var floorH = parseFloat(els.floorH.value);
    var far = parseFloat(els.far.value);

    document.getElementById("v-lotW").textContent = fmt(parseFloat(els.lotW.value), " m");
    document.getElementById("v-lotD").textContent = fmt(parseFloat(els.lotD.value), " m");
    document.getElementById("v-setF").textContent = fmt(parseFloat(els.setF.value), " m");
    document.getElementById("v-setS").textContent = fmt(parseFloat(els.setS.value), " m");
    document.getElementById("v-setR").textContent = fmt(parseFloat(els.setR.value), " m");
    document.getElementById("v-maxH").textContent = fmt(maxH, " m");
    document.getElementById("v-floorH").textContent = fmt(floorH, " m");
    document.getElementById("v-far").textContent = fmt(far, "");

    var parcel = currentParcel();
    var parcelPoly = parcel.poly, setbacks = parcel.setbacks;
    var lotArea = shoelaceArea(parcelPoly);
    var footprint = offsetPolygonInward(parcelPoly, setbacks);
    var footprintArea = footprint.length >= 3 ? shoelaceArea(footprint) : 0;
    var footprintPerimeter = footprint.length >= 3 ? polygonPerimeter(footprint) : 0;

    var floorsByHeight = Math.max(0, Math.floor(maxH / floorH));
    var maxGFA = far * lotArea;
    var floorsByFAR = footprintArea > 0 ? Math.floor(maxGFA / footprintArea) : 0;
    var floors = Math.max(0, Math.min(floorsByHeight, floorsByFAR));
    var builtHeight = floors * floorH;
    var gfa = floors * footprintArea;
    var farAchieved = lotArea > 0 ? gfa / lotArea : 0;
    var limitedBy = floors === 0 ? "no buildable envelope" : (floorsByHeight <= floorsByFAR ? "height limit" : "FAR limit");

    clearGroup(genGroup);
    genGroup.add(polygonOutline(parcelPoly, 0.02, 0x3a4148));
    if (footprint.length >= 3) genGroup.add(polygonOutline(footprint, 0.04, 0xe07b5a));

    if (floors > 0 && footprint.length >= 3) {
      var massMat = new THREE.MeshStandardMaterial({
        color: 0xd8dadd, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide,
        transparent: true, opacity: 0.92,
      });
      var mass = buildExtrudedPolygonMesh(footprint, builtHeight, massMat);
      if (mass) genGroup.add(mass);
      for (var i = 1; i < floors; i++) {
        genGroup.add(polygonOutline(footprint, i * floorH, 0x555c64));
      }
    }

    var b = polygonBounds(parcelPoly);
    target.set((b.minX + b.maxX) / 2, builtHeight / 2, (b.minZ + b.maxZ) / 2);
    updateCamera();
    renderPlanView(parcelPoly, footprint.length >= 3 ? footprint : []);

    // Envelope compactness: exterior surface area (walls + flat roof) per m2
    // of floor area. A simple, honest architectural performance proxy, lower
    // means less exposed surface per unit of floor area to gain/lose heat
    // through, not a certified energy model.
    var wallArea = footprintPerimeter * builtHeight;
    var roofArea = footprintArea;
    var envelopeArea = wallArea + roofArea;
    var compactness = gfa > 0 ? envelopeArea / gfa : 0;

    statsEl.innerHTML =
      "Parcel area: <b>" + fmt(lotArea) + " m&sup2;</b><br>" +
      "Buildable footprint: <b>" + fmt(footprintArea) + " m&sup2;</b><br>" +
      "Floors: <b>" + floors + "</b> (" + floorsByHeight + " by height, " + floorsByFAR + " by FAR)<br>" +
      "Built height: <b>" + fmt(builtHeight, " m") + "</b> of " + fmt(maxH, " m") + " max<br>" +
      "Gross floor area: <b>" + fmt(gfa) + " m&sup2;</b><br>" +
      "FAR achieved: <b>" + fmt(farAchieved) + "</b> of " + fmt(far) + " max<br>" +
      "Envelope ratio: <b>" + fmt(compactness) + "</b> m&sup2; surface / m&sup2; floor<br>" +
      "<span class=\"" + (floors === 0 ? "warn" : "ok") + "\">Limited by: " + limitedBy + "</span>";

    // Simplified, clearly-labeled performance/code heuristics (Human-AI
    // Co-Design's "performance into the generative loop" theme, at a scale
    // that's honest about being a rule of thumb, not code-compliance advice).
    var notes = [];
    if (builtHeight > 18 || floors > 6) {
      notes.push({ flag: true, text: "Over ~18m / 6 storeys: in BC this typically moves from Part 9 (combustible, wood-frame) to Part 3 construction, a materially different, costlier building type. Worth checking early." });
    }
    var shortestFootprintDim = footprint.length >= 3 ? Math.min(
      polygonBounds(footprint).maxX - polygonBounds(footprint).minX,
      polygonBounds(footprint).maxZ - polygonBounds(footprint).minZ
    ) : 0;
    if (shortestFootprintDim > 16) {
      notes.push({ flag: true, text: "Floor plate over ~16m in its shortest dimension: interior daylighting typically suffers without a courtyard or light well." });
    }
    if (floors > 0 && shortestFootprintDim > 0 && builtHeight / shortestFootprintDim > 3) {
      notes.push({ flag: true, text: "Height-to-footprint ratio is high (a slender tower): structural feasibility and wind loading deserve early engineering input." });
    }
    perfNotesEl.innerHTML = notes.map(function (n) {
      return "<div class=\"pn-row" + (n.flag ? " pn-flag" : "") + "\">⚠ " + n.text + "</div>";
    }).join("");

    lastStats = {
      lotArea: lotArea, footprintArea: footprintArea, floors: floors, floorsByHeight: floorsByHeight,
      floorsByFAR: floorsByFAR, builtHeight: builtHeight, maxHeight: maxH,
      gfa: gfa, farAchieved: farAchieved, maxFAR: far, limitedBy: limitedBy,
      envelopeRatio: compactness,
    };
    lastFootprint = footprint;

    if (mode === "simple" && zoningPresetSelect.value === "vancouver-r1-1") {
      renderVancouverEligibility();
    }
  }

  Object.keys(els).forEach(function (id) {
    els[id].addEventListener("input", regenerate);
  });
  presetSelect.addEventListener("change", function () {
    renderPresetSetbacks(PRESETS[presetSelect.value]);
    regenerate();
  });

  function setMode(next) {
    mode = next;
    modeSimpleBtn.classList.toggle("active", mode === "simple");
    modeIrregularBtn.classList.toggle("active", mode === "irregular");
    simpleControls.style.display = mode === "simple" ? "" : "none";
    irregularControls.style.display = mode === "irregular" ? "" : "none";
    if (mode !== "simple") vancouverPanel.style.display = "none";
    else if (zoningPresetSelect.value === "vancouver-r1-1") vancouverPanel.style.display = "block";
    regenerate();
  }
  modeSimpleBtn.addEventListener("click", function () { setMode("simple"); });
  modeIrregularBtn.addEventListener("click", function () { setMode("irregular"); });
  renderPresetSetbacks(PRESETS[presetSelect.value]);

  // ==========================================================================
  // Generation history: a visible, traceable record of every parse + review
  // run this session (not persisted between visits, this is a demo, not a
  // real project file).
  // ==========================================================================

  var historyLogEl = document.getElementById("history-log");
  var historyEntries = [];

  function logHistory(sourceLabel, stats) {
    var entry = {
      time: new Date(),
      source: sourceLabel,
      floors: stats.floors, gfa: Math.round(stats.gfa), far: fmt(stats.farAchieved),
    };
    historyEntries.unshift(entry);
    if (historyEntries.length > 12) historyEntries.pop();
    historyLogEl.innerHTML = historyEntries.map(function (e) {
      var hh = e.time.getHours().toString().padStart(2, "0");
      var mm = e.time.getMinutes().toString().padStart(2, "0");
      var ss = e.time.getSeconds().toString().padStart(2, "0");
      return "<div class=\"hist-row\"><span class=\"hist-time\">" + hh + ":" + mm + ":" + ss + "</span> &middot; " +
        "<span class=\"hist-src\">" + e.source + "</span> &middot; " +
        e.floors + " floors, " + e.gfa + " m&sup2; GFA, FAR " + e.far + "</div>";
    }).join("");
  }

  // ==========================================================================
  // AI-assisted parsing: plain-English zoning description -> slider
  // parameters (simple-mode fields only; irregular parcel shapes are chosen
  // via the presets above, a deterministic geometry capability kept separate
  // from free-text parsing). Uses the visitor's own Anthropic API key, sent
  // directly from the browser to Anthropic's API. The key is kept in
  // localStorage only, never sent anywhere else, and never touches any
  // server this project controls (there is none; this is a static site).
  // ==========================================================================

  var aiText = document.getElementById("ai-text");
  var aiKey = document.getElementById("ai-key");
  var aiBtn = document.getElementById("ai-parse-btn");
  var exampleBtn = document.getElementById("example-btn");
  var aiStatus = document.getElementById("ai-status");
  var aiCitations = document.getElementById("ai-citations");
  var aiReview = document.getElementById("ai-review");
  var applyFixBtn = document.getElementById("apply-fix-btn");

  // Based on the City of Vancouver's R1-1 (Residential Inclusive) district
  // schedule, adopted citywide in November 2023, replacing the old
  // single-family-only RS zoning. Numbers verified via the district's public
  // provisions as of this writing; a real bylaw excerpt would cite the
  // schedule directly rather than paraphrasing it like this.
  var VANCOUVER_EXAMPLE = "R1-1 multiplex lot in Vancouver, 15.2m by 37m (about 50 ft by 122 ft), zoned " +
    "under the City's 2023 citywide multiplex zoning that replaced single-family RS-1. Front yard setback " +
    "4.9m, side yards 1.2m each, rear yard 10.7m for a single building. Maximum height 11.5m over 3 storeys " +
    "for the front or single building. Base floor space ratio 0.70, rising to 1.00 if a unit is secured " +
    "rental or below-market housing. Assume 3.2m floor-to-floor height.";

  exampleBtn.addEventListener("click", function () {
    aiText.value = VANCOUVER_EXAMPLE;
  });

  var FIELD_LABELS = {
    lotWidth: "Lot width", lotDepth: "Lot depth",
    setbackFront: "Front setback", setbackSide: "Side setback", setbackRear: "Rear setback",
    maxHeight: "Max height", floorHeight: "Floor-to-floor height", maxFAR: "Max FAR",
  };
  var FIELD_MAP = {
    lotWidth: "lotW", lotDepth: "lotD",
    setbackFront: "setF", setbackSide: "setS", setbackRear: "setR",
    maxHeight: "maxH", floorHeight: "floorH", maxFAR: "far",
  };
  var FIELD_KEYS = Object.keys(FIELD_MAP);

  try {
    var savedKey = localStorage.getItem("pmg_anthropic_key");
    if (savedKey) aiKey.value = savedKey;
  } catch (e) { /* localStorage unavailable (private mode, etc.) - ignore */ }

  function setStatus(msg, kind) {
    aiStatus.textContent = msg;
    aiStatus.className = kind || "";
  }

  function clampToSlider(id, value) {
    var el = els[id];
    var min = parseFloat(el.min), max = parseFloat(el.max);
    return Math.max(min, Math.min(max, value));
  }

  function callClaude(key, systemPrompt, userContent, maxTokens) {
    // Anthropic's API blocks direct browser requests unless this header opts
    // in. It's meant for exactly this pattern: a visitor's own key, used only
    // in their own browser session, never seen by this site or any server it
    // runs (there is no server; this is a static site).
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: "{" }, // prefill forces a bare JSON object back
        ],
      }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (body) {
          var msg = (body && body.error && body.error.message) || (res.status + " " + res.statusText);
          throw new Error(msg);
        });
      }
      return res.json();
    }).then(function (data) {
      var block = data.content && data.content[0];
      var content = block && block.text;
      if (!content) throw new Error("No content in response.");
      try { return JSON.parse("{" + content); } catch (e) { throw new Error("Model did not return valid JSON."); }
    });
  }

  // --- Step 1: parse plain-English text into cited, confidence-scored fields ---
  var PARSE_SYSTEM = "You extract zoning envelope parameters from a text description of a building lot, " +
    "citing your source for each value you find. Respond with a single JSON object only, no prose, " +
    "in this exact shape (all 8 keys always present):\n" +
    "{\"lotWidth\": {\"value\": number|null, \"source\": string|null, \"confidence\": \"high\"|\"medium\"|\"low\"|\"none\"}, " +
    "\"lotDepth\": {...}, \"setbackFront\": {...}, \"setbackSide\": {...}, \"setbackRear\": {...}, " +
    "\"maxHeight\": {...}, \"floorHeight\": {...}, \"maxFAR\": {...}}\n" +
    "Rules: all lengths are in meters, convert feet if the source uses feet. maxFAR is a unitless ratio. " +
    "\"value\" is your best numeric estimate, or null if you cannot find or reasonably infer it. \"source\" is " +
    "a short quote (under 15 words) from the input text that justifies the value, or null if value is null. " +
    "\"confidence\" is \"high\" if the text states the value directly, \"medium\" if inferred from context, " +
    "\"low\" if it's a rough guess, \"none\" if value is null. Do not guess wildly: prefer null with low/none " +
    "confidence over fabricated precision.";

  function applyParsedFields(fields) {
    var applied = [];
    FIELD_KEYS.forEach(function (key) {
      var f = fields[key];
      var v = f && f.value;
      if (typeof v === "number" && isFinite(v)) {
        var sliderId = FIELD_MAP[key];
        els[sliderId].value = clampToSlider(sliderId, v);
        applied.push(key);
      }
    });
    regenerate();
    return applied;
  }

  function renderCitations(fields) {
    var rows = FIELD_KEYS.filter(function (key) {
      return fields[key] && typeof fields[key].value === "number";
    }).map(function (key) {
      var f = fields[key];
      var confClass = (f.confidence === "low" || f.confidence === "medium") ? " conf-low" : "";
      var quote = f.source ? "“" + f.source + "”" : "no direct source";
      return "<div class=\"cite-row\"><span class=\"cite-field" + confClass + "\">" + FIELD_LABELS[key] +
        "</span> (" + f.confidence + "): <span class=\"cite-quote\">" + quote + "</span></div>";
    });
    aiCitations.innerHTML = rows.join("");
  }

  // --- Step 2: an independent reviewer pass checks the generated massing
  // against the original text, mirroring the reviewer-agent pattern used to
  // check compliance on generated proposals, and can suggest a correction. ---
  var REVIEW_SYSTEM = "You are an independent reviewer checking whether a generated building massing is " +
    "consistent with the zoning description it was derived from. You will get the original text, the " +
    "parameters extracted from it, and the resulting generated massing. Respond with a single JSON object " +
    "only, no prose, in this exact shape: " +
    "{\"verdict\": \"consistent\"|\"concerns\", \"notes\": string, " +
    "\"suggestedFix\": {\"field\": \"lotWidth\"|\"lotDepth\"|\"setbackFront\"|\"setbackSide\"|\"setbackRear\"|" +
    "\"maxHeight\"|\"floorHeight\"|\"maxFAR\"|null, \"value\": number|null, \"reason\": string|null}}. " +
    "\"notes\" is one or two short sentences. Flag it as \"concerns\" if a stated constraint was not " +
    "reflected in the result, if a value had to be guessed with low confidence, or if the achieved FAR or " +
    "height differs meaningfully from what was asked for. If you flag \"concerns\" and can identify a single " +
    "specific field whose corrected value would resolve it, fill in \"suggestedFix\" with that field, its " +
    "corrected value, and a short reason; otherwise leave suggestedFix's fields null.";

  var pendingFix = null;

  function runReview(key, originalText, fields, stats) {
    aiReview.style.display = "block";
    aiReview.className = "busy";
    aiReview.innerHTML = "<div class=\"rev-title\">Reviewer check</div>Checking the massing against the description…";
    applyFixBtn.style.display = "none";
    pendingFix = null;

    var summary = "ORIGINAL DESCRIPTION:\n" + originalText + "\n\nEXTRACTED PARAMETERS:\n" +
      JSON.stringify(fields, null, 2) + "\n\nGENERATED RESULT:\n" +
      "Floors: " + stats.floors + " (" + stats.floorsByHeight + " allowed by height, " + stats.floorsByFAR + " allowed by FAR)\n" +
      "Built height: " + fmt(stats.builtHeight) + "m of " + fmt(stats.maxHeight) + "m max\n" +
      "Gross floor area: " + fmt(stats.gfa) + "m2\n" +
      "FAR achieved: " + fmt(stats.farAchieved) + " of " + fmt(stats.maxFAR) + " max\n" +
      "Limited by: " + stats.limitedBy;

    return callClaude(key, REVIEW_SYSTEM, summary, 350)
      .then(function (review) {
        var verdict = review.verdict === "concerns" ? "concerns" : "consistent";
        aiReview.className = verdict;
        aiReview.innerHTML = "<div class=\"rev-title\">Reviewer check: " +
          (verdict === "concerns" ? "⚠ concerns" : "✓ consistent") + "</div>" +
          (review.notes || "");

        var fix = review.suggestedFix;
        if (verdict === "concerns" && fix && fix.field && FIELD_MAP[fix.field] && typeof fix.value === "number") {
          pendingFix = fix;
          applyFixBtn.textContent = "Apply reviewer's fix: " + FIELD_LABELS[fix.field] + " → " + fmt(fix.value);
          applyFixBtn.style.display = "block";
        }

        logHistory(mode === "simple" ? "AI parse + review" : "AI parse + review (irregular parcel)", lastStats);
      })
      .catch(function (err) {
        aiReview.className = "";
        aiReview.style.display = "none";
        // Reviewer failing shouldn't hide the already-applied parse results.
        logHistory("AI parse (reviewer unavailable)", lastStats);
        console.error("Reviewer check failed:", err.message);
      });
  }

  applyFixBtn.addEventListener("click", function () {
    if (!pendingFix) return;
    var sliderId = FIELD_MAP[pendingFix.field];
    els[sliderId].value = clampToSlider(sliderId, pendingFix.value);
    regenerate();
    logHistory("Reviewer fix applied: " + FIELD_LABELS[pendingFix.field], lastStats);
    applyFixBtn.style.display = "none";
    pendingFix = null;
  });

  aiBtn.addEventListener("click", function () {
    var text = aiText.value.trim();
    var key = aiKey.value.trim();

    if (!key) { setStatus("Enter your Anthropic API key first.", "err"); return; }
    if (!text) { setStatus("Describe the lot or paste a bylaw excerpt first.", "err"); return; }

    try { localStorage.setItem("pmg_anthropic_key", key); } catch (e) { /* ignore */ }

    aiBtn.disabled = true;
    aiCitations.innerHTML = "";
    aiReview.style.display = "none";
    applyFixBtn.style.display = "none";
    setStatus("Asking Claude to read the description…", "busy");

    if (mode !== "simple") setMode("simple"); // AI parsing targets the simple rectangular model
    if (zoningPresetSelect.value !== "custom") {
      zoningPresetSelect.value = "custom";
      vancouverPanel.style.display = "none";
    }

    callClaude(key, PARSE_SYSTEM, text, 500)
      .then(function (fields) {
        var applied = applyParsedFields(fields);
        if (applied.length === 0) {
          setStatus("Couldn't find any zoning values in that text. Try being more specific.", "err");
          aiBtn.disabled = false;
          return;
        }
        setStatus("Applied " + applied.length + " value" + (applied.length === 1 ? "" : "s") + " from the description.", "ok");
        renderCitations(fields);
        aiBtn.disabled = false;
        // Kick off the reviewer pass against the freshly computed stats.
        runReview(key, text, fields, lastStats);
      })
      .catch(function (err) {
        setStatus("Couldn't parse that: " + err.message, "err");
        aiBtn.disabled = false;
      });
  });

  function resize() {
    var w = viewport.clientWidth, h = viewport.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", resize);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  resize();
  updateCamera();
  regenerate();
  animate();
})();
