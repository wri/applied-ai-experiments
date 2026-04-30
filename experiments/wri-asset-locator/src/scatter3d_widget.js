function render({ model, el }) {
  // ── DOM setup ──────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "s3d-root";

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "s3d-canvas-wrap";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const hud = document.createElement("div");
  hud.className = "s3d-hud";
  hud.innerHTML = `
    <div class="s3d-hud-row">
      <span id="s3d-mode-label">Mode: 2D</span>
      <button id="s3d-toggle-mode">Toggle 3D</button>
    </div>
    <div class="s3d-instructions" id="s3d-hint-2d">2D: drag to pan · scroll to zoom</div>
    <div class="s3d-instructions" id="s3d-hint-3d" style="opacity:0.4">3D: drag to rotate · ctrl+drag to pan</div>
    <div class="s3d-instructions">Shift+drag to select · click empty to deselect</div>
    <div id="s3d-count" class="s3d-count"></div>
  `;

  canvasWrap.appendChild(canvas);
  canvasWrap.appendChild(hud);
  root.appendChild(canvasWrap);
  el.appendChild(root);

  // ── View state ─────────────────────────────────────────────────────────────
  const view2d = { scale: 1, offsetX: 0, offsetY: 0 };
  const view3d = { rotateX: 0.35, rotateY: -0.6, zoom: 1.2, offsetX: 0, offsetY: 0 };

  const state = {
    mode: "2d",
    dragging: false,
    dragMode: null,
    dragStart: { x: 0, y: 0 },
    mouseDownPos: { x: 0, y: 0 },
    selecting: false,
    addToSelection: false,
    selectRect: null,
    selected: new Set(),
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const getCanvasPoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const worldToScreen2d = (p) => ({
    x: p[0] * canvas.clientWidth  * view2d.scale + view2d.offsetX,
    y: p[1] * canvas.clientHeight * view2d.scale + view2d.offsetY,
  });

  const project3d = (p) => {
    const x = (p[0] - 0.5) * view3d.zoom;
    const y = (p[1] - 0.5) * view3d.zoom;
    const z = (p[2] - 0.5) * view3d.zoom;

    const cosY = Math.cos(view3d.rotateY), sinY = Math.sin(view3d.rotateY);
    const cosX = Math.cos(view3d.rotateX), sinX = Math.sin(view3d.rotateX);

    const x1 =  x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y1 =  y * cosX - z1 * sinX;
    const z2 =  y * sinX + z1 * cosX;

    if (z2 < -0.9) return { x: -9999, y: -9999, depth: z2, culled: true };

    const persp = 1 / (1 + z2 * 0.9);
    return {
      x: x1 * persp * canvas.clientWidth  * 0.7 + canvas.clientWidth  * 0.5 + view3d.offsetX,
      y: y1 * persp * canvas.clientHeight * 0.7 + canvas.clientHeight * 0.5 + view3d.offsetY,
      depth: z2,
      culled: false,
    };
  };

  const getScreen = (i) => {
    const pts2d = model.get("points_2d");
    const pts3d = model.get("points_3d");
    if (state.mode === "3d") return project3d(pts3d[i] || [0, 0, 0]);
    return { ...worldToScreen2d(pts2d[i] || [0, 0]), depth: 0, culled: false };
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  let rafPending = false;
  const scheduleRender = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; render(); });
  };

  const render = () => {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    const pts2d  = model.get("points_2d")  || [];
    const pts3d  = model.get("points_3d")  || [];
    const colors = model.get("colors")     || [];
    const synced = new Set(model.get("selected_indices") || []);

    const n = pts2d.length;
    const projected = [];
    for (let i = 0; i < n; i++) {
      const sc = getScreen(i);
      if (!sc.culled) projected.push({ i, sc });
    }

    if (state.mode === "3d") projected.sort((a, b) => a.sc.depth - b.sc.depth);

    for (const { i, sc } of projected) {
      const isSel = synced.has(i) || state.selected.has(i);
      const r = isSel ? 5 : 3;
      ctx.fillStyle = isSel ? "#f59e0b" : (colors[i] || "#94a3b8");
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.selectRect) {
      const { x0, y0, x1, y1 } = state.selectRect;
      const l = Math.min(x0, x1), r = Math.max(x0, x1);
      const t = Math.min(y0, y1), b = Math.max(y0, y1);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(l, t, r - l, b - t);
      ctx.setLineDash([]);
    }

    const total = state.selected.size;
    hud.querySelector("#s3d-count").textContent = `${n} points · ${total} selected`;
  };

  // ── Resize ─────────────────────────────────────────────────────────────────
  const resize = () => {
    const w = el.clientWidth || 800;
    const h = Math.round(w * 0.6);
    canvas.width  = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    scheduleRender();
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const commitSelection = () => {
    model.set("selected_indices", Array.from(state.selected));
    model.save_changes();
  };

  const selectInRect = () => {
    if (!state.selectRect) return;
    const { x0, y0, x1, y1 } = state.selectRect;
    const l = Math.min(x0, x1), r = Math.max(x0, x1);
    const t = Math.min(y0, y1), b = Math.max(y0, y1);

    if (!state.addToSelection) state.selected.clear();

    const n = (model.get("points_2d") || []).length;
    for (let i = 0; i < n; i++) {
      const sc = getScreen(i);
      if (sc.x >= l && sc.x <= r && sc.y >= t && sc.y <= b) state.selected.add(i);
    }
    commitSelection();
  };

  // ── Mouse events ───────────────────────────────────────────────────────────
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const pt = getCanvasPoint(e);
    const ctrl = e.ctrlKey || e.metaKey;
    state.mouseDownPos = { ...pt };

    if (e.shiftKey) {
      state.selecting = true;
      state.addToSelection = ctrl;
      state.selectRect = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      scheduleRender();
      return;
    }

    state.dragging = true;
    if (state.mode === "3d" && ctrl) {
      state.dragMode = "pan3d";
    } else if (state.mode === "3d") {
      state.dragMode = "rotate";
    } else {
      state.dragMode = "pan2d";
    }
    state.dragStart = { ...pt };
    canvas.classList.add("s3d-grabbing");
  });

  const onMouseMove = (e) => {
    const pt = getCanvasPoint(e);
    if (state.dragging) {
      const dx = pt.x - state.dragStart.x;
      const dy = pt.y - state.dragStart.y;
      if (state.dragMode === "pan2d") {
        view2d.offsetX += dx; view2d.offsetY += dy;
      } else if (state.dragMode === "rotate") {
        view3d.rotateY += dx * 0.005;
        view3d.rotateX  = clamp(view3d.rotateX + dy * 0.005, -1.5, 1.5);
      } else if (state.dragMode === "pan3d") {
        view3d.offsetX += dx; view3d.offsetY += dy;
      }
      state.dragStart = { ...pt };
      scheduleRender();
    } else if (state.selecting && state.selectRect) {
      state.selectRect.x1 = pt.x;
      state.selectRect.y1 = pt.y;
      scheduleRender();
    }
  };

  const onMouseUp = (e) => {
    const pt = getCanvasPoint(e);
    const dist = Math.hypot(pt.x - state.mouseDownPos.x, pt.y - state.mouseDownPos.y);
    const wasSelecting = state.selecting;

    if (state.dragging) {
      state.dragging = false;
      state.dragMode = null;
      canvas.classList.remove("s3d-grabbing");
    }
    if (state.selecting) {
      state.selecting = false;
      selectInRect();
      state.selectRect = null;
      state.addToSelection = false;
      scheduleRender();
    }

    if (!wasSelecting && dist < 3) {
      state.selected.clear();
      commitSelection();
      scheduleRender();
    }
  };

  canvas.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.001);
    if (state.mode === "3d") {
      view3d.zoom = clamp(view3d.zoom * f, 0.3, 6);
    } else {
      const pt = getCanvasPoint(e);
      const prev = view2d.scale;
      view2d.scale = clamp(view2d.scale * f, 0.1, 20);
      const sc = view2d.scale / prev;
      view2d.offsetX = pt.x - (pt.x - view2d.offsetX) * sc;
      view2d.offsetY = pt.y - (pt.y - view2d.offsetY) * sc;
    }
    scheduleRender();
  }, { passive: false });

  // ── Mode toggle ────────────────────────────────────────────────────────────
  const setMode = (m) => {
    state.mode = m;
    model.set("mode", m);
    model.save_changes();
    hud.querySelector("#s3d-mode-label").textContent = m === "3d" ? "Mode: 3D" : "Mode: 2D";
    hud.querySelector("#s3d-toggle-mode").textContent = m === "3d" ? "Toggle 2D" : "Toggle 3D";
    hud.querySelector("#s3d-hint-2d").style.opacity = m === "2d" ? "1" : "0.4";
    hud.querySelector("#s3d-hint-3d").style.opacity = m === "3d" ? "1" : "0.4";
    scheduleRender();
  };

  hud.querySelector("#s3d-toggle-mode").addEventListener("click", () => {
    setMode(state.mode === "2d" ? "3d" : "2d");
  });

  // ── React to model changes ─────────────────────────────────────────────────
  model.on("change:points_2d",        scheduleRender);
  model.on("change:points_3d",        scheduleRender);
  model.on("change:colors",           scheduleRender);
  model.on("change:selected_indices", scheduleRender);

  // ── Init ───────────────────────────────────────────────────────────────────
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
}

export default { render };
