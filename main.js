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

    statsEl.innerHTML =
      "Buildable footprint: <b>" + fmt(footprintArea) + " m&sup2;</b><br>" +
      "Floors: <b>" + floors + "</b> (" + floorsByHeight + " by height, " + floorsByFAR + " by FAR)<br>" +
      "Built height: <b>" + fmt(builtHeight, " m") + "</b> of " + fmt(maxH, " m") + " max<br>" +
      "Gross floor area: <b>" + fmt(gfa) + " m&sup2;</b><br>" +
      "FAR achieved: <b>" + fmt(farAchieved) + "</b> of " + fmt(far) + " max<br>" +
      "<span class=\"" + (floors === 0 ? "warn" : "ok") + "\">Limited by: " + limitedBy + "</span>";
  }

  Object.keys(els).forEach(function (id) {
    els[id].addEventListener("input", regenerate);
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
