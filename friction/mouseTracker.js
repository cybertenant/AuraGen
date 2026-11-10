// DOM click listener. It uses one delegated "click" listener on the document and
// only reports clicks that land on an element carrying data-field / data-section.
// It deliberately does NOT listen to mousemove, so mouse movement is never a signal.

export function resolveTarget(element) {
  if (!element || typeof element.closest !== "function") return null;
  const node = element.closest("[data-field]");
  if (!node) return null;
  const fieldId = node.getAttribute("data-field");
  const sectionId = node.getAttribute("data-section");
  if (!fieldId || !sectionId) return null;
  return { sectionId, fieldId };
}

export function attachMouseTracker(doc, onClick) {
  if (!doc) return () => {};
  const handler = (event) => {
    const target = resolveTarget(event.target);
    if (target) onClick(target);
  };
  doc.addEventListener("click", handler, true);
  return () => doc.removeEventListener("click", handler, true);
}
