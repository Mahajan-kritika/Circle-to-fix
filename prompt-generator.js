(() => {
  const api = (window.__circleToFix = window.__circleToFix || {});

  api.generatePrompt = (record) => {
    const element = record.element || {};
    const dimensions = element.dimensions || {};
    const styles = element.styles || {};
    const styleSummary = Object.entries(styles)
      .map(([name, value]) => `- ${name}: ${value}`)
      .join("\n");
    const attributeSummary = Object.entries(element.attributes || {})
      .map(([name, value]) => `- ${name}: ${value}`)
      .join("\n");
    const parent = element.parent
      ? `${element.parent.tag}${element.parent.id ? `#${element.parent.id}` : ""}${element.parent.classes?.length ? `.${element.parent.classes.join(".")}` : ""}`
      : "Not available";

    return [
      "I identified a visual issue on this webpage and marked it in the attached screenshot.",
      "",
      "PROJECT CONTEXT",
      `- Page URL: ${record.url}`,
      "",
      "USER INSTRUCTION",
      record.note || "[Add the requested change here]",
      "",
      "SELECTED ELEMENT",
      `- HTML tag: ${element.tag || "Not available"}`,
      `- ID: ${element.id || "None"}`,
      `- CSS classes: ${element.classes?.join(" ") || "None"}`,
      `- Selector: ${element.selector || "Not available"}`,
      `- Text/accessible label: ${element.text || "Not collected"}`,
      `- Relevant attributes:\n${attributeSummary || "- None"}`,
      `- Parent: ${parent}`,
      `- Viewport dimensions and coordinates: ${dimensions.width ?? "?"} x ${dimensions.height ?? "?"} px at (${dimensions.x ?? "?"}, ${dimensions.y ?? "?"})`,
      `- Computed styles:\n${styleSummary || "- Not available"}`,
      "",
      "ANNOTATION",
      `- Type: ${record.annotation?.type || "Not available"}`,
      `- Marked area in viewport: ${formatRect(record.annotation?.rect)}`,
      "",
      "SCREENSHOT",
      `- Local screenshot filename: ${record.filename}`,
      "- The screenshot is not embedded in this text. Save it using Circle to Fix, then attach that PNG manually to your coding agent.",
      "",
      "REPAIR INSTRUCTIONS",
      "- Inspect the existing project and identify the component that renders the selected element.",
      "- Review the relevant HTML and CSS before making changes.",
      "- Fix only the issue described above; preserve unrelated functionality and responsive behavior.",
      "- Test the result at desktop and mobile viewport sizes, and report the files changed."
    ].join("\n");
  };

  function formatRect(rect) {
    if (!rect) {
      return "Not available";
    }
    return `x=${Math.round(rect.x)}, y=${Math.round(rect.y)}, width=${Math.round(rect.width)}, height=${Math.round(rect.height)} px`;
  }
})();
