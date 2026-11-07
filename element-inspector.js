(() => {
  const api = (window.__circleToFix = window.__circleToFix || {});
  const SAFE_STYLE_PROPERTIES = [
    "width", "height", "backgroundColor", "color", "fontSize", "fontWeight",
    "padding", "margin", "border", "borderRadius", "display", "position"
  ];
  const INTERACTIVE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
  const SENSITIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

  function safeText(element) {
    if (SENSITIVE_TAGS.has(element.tagName) || element.isContentEditable) {
      return "";
    }
    const text = (element.innerText || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    return text
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
      .replace(/\b\+?\d[\d\s().-]{7,}\d\b/g, "[redacted phone]")
      .slice(0, 160);
  }

  function selectorFor(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const classes = Array.from(current.classList).slice(0, 3)
        .map((name) => `.${CSS.escape(name)}`).join("");
      let part = `${current.tagName.toLowerCase()}${classes}`;
      if (current.parentElement) {
        const sameTagSiblings = Array.from(current.parentElement.children)
          .filter((child) => child.tagName === current.tagName);
        if (sameTagSiblings.length > 1) {
          part += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
        }
      }
      parts.unshift(part);
      const candidate = parts.join(" > ");
      if (document.querySelectorAll(candidate).length === 1) {
        return candidate;
      }
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function elementDetails(element) {
    const rect = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    const styles = {};
    for (const property of SAFE_STYLE_PROPERTIES) {
      styles[property] = computed[property];
    }

    const attributes = {};
    for (const name of ["role", "type", "title", "alt", "aria-label", "data-testid"]) {
      const value = element.getAttribute(name);
      if (value) {
        attributes[name] = value.slice(0, 120);
      }
    }

    const parent = element.parentElement;
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || "",
      classes: Array.from(element.classList).slice(0, 8),
      text: safeText(element),
      attributes,
      selector: selectorFor(element),
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.left),
        y: Math.round(rect.top)
      },
      styles,
      parent: parent ? {
        tag: parent.tagName.toLowerCase(),
        id: parent.id || "",
        classes: Array.from(parent.classList).slice(0, 5)
      } : null
    };
  }

  function findBestElement(x, y) {
    let element = document.elementFromPoint(x, y);
    if (!element || element === document.documentElement || element === document.body) {
      return element ? elementDetails(element) : null;
    }

    let best = element;
    let current = element;
    for (let depth = 0; current && current !== document.body && depth < 4; depth += 1) {
      const rect = current.getBoundingClientRect();
      if (INTERACTIVE_TAGS.has(current.tagName)) {
        best = current;
        break;
      }
      if (rect.width >= 24 && rect.height >= 18) {
        best = current;
      }
      current = current.parentElement;
    }
    return elementDetails(best);
  }

  api.inspectElement = findBestElement;
})();
