(function () {
  "use strict";

  var viewport = document.getElementById("viewport");
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  scene.fog = new THREE.Fog(0x0b0d10, 60, 220);

  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewport.appendChild(renderer.domElement);

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

  // --- generated geometry group ---
  var genGroup = new THREE.Group();
  scene.add(genGroup);

  function clearGroup(g) {
    while (g.children.length) {
      var c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function rectOutline(w, d, y, color) {
    var pts = [
      new THREE.Vector3(-w / 2, y, -d / 2),
      new THREE.Vector3(w / 2, y, -d / 2),
      new THREE.Vector3(w / 2, y, d / 2),
      new THREE.Vector3(-w / 2, y, d / 2),
      new THREE.Vector3(-w / 2, y, -d / 2),
    ];
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = new THREE.LineBasicMaterial({ color: color });
    return new THREE.Line(geo, mat);
  }

  var els = {};
  ["lotW", "lotD", "setF", "setS", "setR", "maxH", "floorH", "far"].forEach(function (id) {
    els[id] = document.getElementById(id);
  });
  var statsEl = document.getElementById("stats");
  var lastStats = null; // populated by regenerate(), read by the reviewer AI call

  function fmt(n, unit) {
    return (Math.round(n * 10) / 10) + (unit || "");
  }

  function regenerate() {
    var lotW = parseFloat(els.lotW.value);
    var lotD = parseFloat(els.lotD.value);
    var setF = parseFloat(els.setF.value);
    var setS = parseFloat(els.setS.value);
    var setR = parseFloat(els.setR.value);
    var maxH = parseFloat(els.maxH.value);
    var floorH = parseFloat(els.floorH.value);
    var far = parseFloat(els.far.value);

    document.getElementById("v-lotW").textContent = fmt(lotW, " m");
    document.getElementById("v-lotD").textContent = fmt(lotD, " m");
    document.getElementById("v-setF").textContent = fmt(setF, " m");
    document.getElementById("v-setS").textContent = fmt(setS, " m");
    document.getElementById("v-setR").textContent = fmt(setR, " m");
    document.getElementById("v-maxH").textContent = fmt(maxH, " m");
    document.getElementById("v-floorH").textContent = fmt(floorH, " m");
    document.getElementById("v-far").textContent = fmt(far, "");

    var footprintW = Math.max(0, lotW - 2 * setS);
    var footprintD = Math.max(0, lotD - setF - setR);
    var footprintArea = footprintW * footprintD;
    var lotArea = lotW * lotD;

    var floorsByHeight = Math.max(0, Math.floor(maxH / floorH));
    var maxGFA = far * lotArea;
    var floorsByFAR = footprintArea > 0 ? Math.floor(maxGFA / footprintArea) : 0;
    var floors = Math.max(0, Math.min(floorsByHeight, floorsByFAR));
    var builtHeight = floors * floorH;
    var gfa = floors * footprintArea;
    var farAchieved = lotArea > 0 ? gfa / lotArea : 0;
    var limitedBy = floors === 0 ? "no buildable envelope" : (floorsByHeight <= floorsByFAR ? "height limit" : "FAR limit");

    clearGroup(genGroup);

    // lot boundary
    genGroup.add(rectOutline(lotW, lotD, 0.02, 0x3a4148));
    // buildable footprint outline
    genGroup.add(rectOutline(footprintW, footprintD, 0.04, 0xe07b5a));

    if (floors > 0 && footprintW > 0 && footprintD > 0) {
      var massGeo = new THREE.BoxGeometry(footprintW, builtHeight, footprintD);
      var massMat = new THREE.MeshStandardMaterial({
        color: 0xd8dadd, roughness: 0.85, metalness: 0.02,
        transparent: true, opacity: 0.92,
      });
      var mass = new THREE.Mesh(massGeo, massMat);
      mass.position.y = builtHeight / 2;
      genGroup.add(mass);

      var edges = new THREE.EdgesGeometry(massGeo);
      var edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a1e23 }));
      edgeLines.position.y = builtHeight / 2;
      genGroup.add(edgeLines);

      // floor division lines
      for (var i = 1; i < floors; i++) {
        genGroup.add(rectOutline(footprintW, footprintD, i * floorH, 0x555c64));
        var line2 = rectOutline(footprintW, footprintD, i * floorH, 0x555c64);
        // reposition to sit on the box surface (already at correct y via rectOutline's y param)
      }
    }

    target.set(0, builtHeight / 2, 0);
    updateCamera();

    // Envelope compactness: exterior surface area (walls + flat roof) per m2
    // of floor area. A simple, honest architectural performance proxy, lower
    // means less exposed surface per unit of floor area to gain/lose heat
    // through, not a certified energy model.
    var wallArea = 2 * (footprintW + footprintD) * builtHeight;
    var roofArea = footprintW * footprintD;
    var envelopeArea = wallArea + roofArea;
    var compactness = gfa > 0 ? envelopeArea / gfa : 0;

    statsEl.innerHTML =
      "Buildable footprint: <b>" + fmt(footprintArea) + " m&sup2;</b><br>" +
      "Floors: <b>" + floors + "</b> (" + floorsByHeight + " by height, " + floorsByFAR + " by FAR)<br>" +
      "Built height: <b>" + fmt(builtHeight, " m") + "</b> of " + fmt(maxH, " m") + " max<br>" +
      "Gross floor area: <b>" + fmt(gfa) + " m&sup2;</b><br>" +
      "FAR achieved: <b>" + fmt(farAchieved) + "</b> of " + fmt(far) + " max<br>" +
      "Envelope ratio: <b>" + fmt(compactness) + "</b> m&sup2; surface / m&sup2; floor<br>" +
      "<span class=\"" + (floors === 0 ? "warn" : "ok") + "\">Limited by: " + limitedBy + "</span>";

    lastStats = {
      footprintArea: footprintArea, floors: floors, floorsByHeight: floorsByHeight,
      floorsByFAR: floorsByFAR, builtHeight: builtHeight, maxHeight: maxH,
      gfa: gfa, farAchieved: farAchieved, maxFAR: far, limitedBy: limitedBy,
      envelopeRatio: compactness,
    };
  }

  Object.keys(els).forEach(function (id) {
    els[id].addEventListener("input", regenerate);
  });

  // --- AI-assisted parsing: plain-English zoning description -> slider parameters ---
  // Uses the visitor's own Anthropic API key, sent directly from the browser to
  // Anthropic's API. The key is kept in localStorage only, never sent anywhere
  // else, and never touches any server this project controls (there is none;
  // this is a static site).
  var aiText = document.getElementById("ai-text");
  var aiKey = document.getElementById("ai-key");
  var aiBtn = document.getElementById("ai-parse-btn");
  var aiStatus = document.getElementById("ai-status");
  var aiCitations = document.getElementById("ai-citations");
  var aiReview = document.getElementById("ai-review");

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
    "Rules: all lengths are in meters, maxFAR is a unitless ratio. \"value\" is your best numeric estimate, " +
    "or null if you cannot find or reasonably infer it. \"source\" is a short quote (under 15 words) from the " +
    "input text that justifies the value, or null if value is null. \"confidence\" is \"high\" if the text " +
    "states the value directly, \"medium\" if inferred from context, \"low\" if it's a rough guess, \"none\" if " +
    "value is null. Do not guess wildly: prefer null with low/none confidence over fabricated precision.";

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
  // check compliance on generated proposals. ---
  var REVIEW_SYSTEM = "You are an independent reviewer checking whether a generated building massing is " +
    "consistent with the zoning description it was derived from. You will get the original text, the " +
    "parameters extracted from it, and the resulting generated massing. Respond with a single JSON object " +
    "only, no prose, in this exact shape: " +
    "{\"verdict\": \"consistent\"|\"concerns\", \"notes\": string}. " +
    "\"notes\" is one or two short sentences. Flag it as \"concerns\" if a stated constraint was not " +
    "reflected in the result, if a value had to be guessed with low confidence, or if the achieved FAR or " +
    "height differs meaningfully from what was asked for.";

  function runReview(key, originalText, fields, stats) {
    aiReview.style.display = "block";
    aiReview.className = "busy";
    aiReview.innerHTML = "<div class=\"rev-title\">Reviewer check</div>Checking the massing against the description…";

    var summary = "ORIGINAL DESCRIPTION:\n" + originalText + "\n\nEXTRACTED PARAMETERS:\n" +
      JSON.stringify(fields, null, 2) + "\n\nGENERATED RESULT:\n" +
      "Floors: " + stats.floors + " (" + stats.floorsByHeight + " allowed by height, " + stats.floorsByFAR + " allowed by FAR)\n" +
      "Built height: " + fmt(stats.builtHeight) + "m of " + fmt(stats.maxHeight) + "m max\n" +
      "Gross floor area: " + fmt(stats.gfa) + "m2\n" +
      "FAR achieved: " + fmt(stats.farAchieved) + " of " + fmt(stats.maxFAR) + " max\n" +
      "Limited by: " + stats.limitedBy;

    return callClaude(key, REVIEW_SYSTEM, summary, 250)
      .then(function (review) {
        var verdict = review.verdict === "concerns" ? "concerns" : "consistent";
        aiReview.className = verdict;
        aiReview.innerHTML = "<div class=\"rev-title\">Reviewer check: " +
          (verdict === "concerns" ? "⚠ concerns" : "✓ consistent") + "</div>" +
          (review.notes || "");
      })
      .catch(function (err) {
        aiReview.className = "";
        aiReview.style.display = "none";
        // Reviewer failing shouldn't hide the already-applied parse results.
        console.error("Reviewer check failed:", err.message);
      });
  }

  aiBtn.addEventListener("click", function () {
    var text = aiText.value.trim();
    var key = aiKey.value.trim();

    if (!key) { setStatus("Enter your Anthropic API key first.", "err"); return; }
    if (!text) { setStatus("Describe the lot or paste a bylaw excerpt first.", "err"); return; }

    try { localStorage.setItem("pmg_anthropic_key", key); } catch (e) { /* ignore */ }

    aiBtn.disabled = true;
    aiCitations.innerHTML = "";
    aiReview.style.display = "none";
    setStatus("Asking Claude to read the description…", "busy");

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
