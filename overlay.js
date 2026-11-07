(() => {
  const api = (window.__circleToFix = window.__circleToFix || {});

  function createOverlay(onAction) {
    const host = document.createElement("div");
    host.id = "circle-to-fix-host";
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("styles.css");
    shadow.append(stylesheet);

    const stage = document.createElement("div");
    stage.className = "ctf-stage";
    const canvas = document.createElement("canvas");
    canvas.className = "ctf-canvas";
    stage.append(canvas);
    shadow.append(stage);

    const toolbar = document.createElement("div");
    toolbar.className = "ctf-toolbar";
    toolbar.innerHTML = `
      <div class="ctf-brand"><span class="ctf-mark">C</span><strong>Circle to Fix</strong></div>
      <div class="ctf-tools" role="group" aria-label="Drawing tools">
        <button type="button" data-tool="rectangle" title="Draw rectangle">Box</button>
        <button type="button" data-tool="circle" title="Draw circle">Circle</button>
        <button type="button" data-tool="arrow" title="Draw arrow">Arrow</button>
      </div>
      <button type="button" data-action="undo">Undo</button>
      <button type="button" data-action="clear">Clear</button>
      <button type="button" data-action="exit" class="ctf-exit">Done</button>`;
    shadow.append(toolbar);

    const history = document.createElement("div");
    history.className = "ctf-history";
    history.setAttribute("aria-label", "Annotation history");
    shadow.append(history);

    const notePanel = document.createElement("section");
    notePanel.className = "ctf-note-panel";
    notePanel.setAttribute("aria-label", "Annotation details");
    shadow.append(notePanel);
    document.documentElement.append(host);

    const context = canvas.getContext("2d");
    const state = {
      tool: "rectangle",
      drawings: [],
      active: null,
      viewportWidth: 0,
      viewportHeight: 0,
      ratio: 1
    };

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      state.viewportWidth = window.innerWidth;
      state.viewportHeight = window.innerHeight;
      state.ratio = ratio;
      canvas.width = Math.round(state.viewportWidth * ratio);
      canvas.height = Math.round(state.viewportHeight * ratio);
      canvas.style.width = `${state.viewportWidth}px`;
      canvas.style.height = `${state.viewportHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      render();
    }

    function drawShape(item, preview = false) {
      const { x, y, endX, endY, type } = item;
      context.save();
      context.strokeStyle = "#ff6b35";
      context.fillStyle = "rgba(255, 107, 53, 0.12)";
      context.lineWidth = preview ? 3 : 4;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.setLineDash(preview ? [7, 5] : []);
      context.beginPath();
      if (type === "rectangle") {
        context.rect(x, y, endX - x, endY - y);
        context.fill();
        context.stroke();
      } else if (type === "circle") {
        const radiusX = Math.abs(endX - x) / 2;
        const radiusY = Math.abs(endY - y) / 2;
        context.arc(x + (endX - x) / 2, y + (endY - y) / 2, Math.max(Math.min(radiusX, radiusY), 1), 0, Math.PI * 2);
        context.fill();
        context.stroke();
      } else {
        context.moveTo(x, y);
        context.lineTo(endX, endY);
        context.stroke();
        const angle = Math.atan2(endY - y, endX - x);
        const head = 14;
        context.beginPath();
        context.moveTo(endX, endY);
        context.lineTo(endX - head * Math.cos(angle - Math.PI / 6), endY - head * Math.sin(angle - Math.PI / 6));
        context.moveTo(endX, endY);
        context.lineTo(endX - head * Math.cos(angle + Math.PI / 6), endY - head * Math.sin(angle + Math.PI / 6));
        context.stroke();
      }
      context.restore();
    }

    function render() {
      context.clearRect(0, 0, state.viewportWidth, state.viewportHeight);
      for (const item of state.drawings) {
        drawShape(item);
      }
      if (state.active) {
        drawShape(state.active, true);
      }
      history.replaceChildren();
      state.drawings.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ctf-history-item";
        button.textContent = `${index + 1}. ${item.type}`;
        button.title = "Open annotation details";
        button.addEventListener("click", () => onAction({ type: "open-record", index }));
        history.append(button);
      });
    }

    function point(event) {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    }

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const start = point(event);
      state.active = { type: state.tool, x: start.x, y: start.y, endX: start.x, endY: start.y };
      render();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.active) {
        return;
      }
      event.preventDefault();
      const end = point(event);
      state.active.endX = end.x;
      state.active.endY = end.y;
      render();
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!state.active) {
        return;
      }
      const end = point(event);
      state.active.endX = end.x;
      state.active.endY = end.y;
      const drawing = state.active;
      state.active = null;
      const rect = {
        x: Math.min(drawing.x, drawing.endX),
        y: Math.min(drawing.y, drawing.endY),
        width: Math.abs(drawing.endX - drawing.x),
        height: Math.abs(drawing.endY - drawing.y)
      };
      if (Math.hypot(rect.width, rect.height) < 6) {
        render();
        return;
      }
      drawing.rect = rect;
      drawing.center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      state.drawings.push(drawing);
      render();
      onAction({ type: "annotation-created", drawing, index: state.drawings.length - 1 });
    });
    canvas.addEventListener("pointercancel", () => {
      state.active = null;
      render();
    });

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      if (button.dataset.tool) {
        state.tool = button.dataset.tool;
        toolbar.querySelectorAll("[data-tool]").forEach((item) => item.classList.toggle("is-active", item === button));
        return;
      }
      const action = button.dataset.action;
      if (action === "undo") {
        state.drawings.pop();
        render();
        onAction({ type: "undo" });
      } else if (action === "clear") {
        state.drawings = [];
        render();
        onAction({ type: "clear" });
      } else if (action === "exit") {
        onAction({ type: "exit" });
      }
    });

    resize();
    toolbar.querySelector('[data-tool="rectangle"]').classList.add("is-active");
    window.addEventListener("resize", resize);
    return {
      host,
      shadow,
      canvas,
      toolbar,
      notePanel,
      state,
      render,
      destroy() {
        window.removeEventListener("resize", resize);
        host.remove();
      }
    };
  }

  api.createOverlay = createOverlay;
})();
