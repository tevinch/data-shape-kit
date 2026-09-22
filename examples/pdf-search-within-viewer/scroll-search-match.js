// Scroll the selected PDF search span inside its explicit viewer container.
function scrollSearchMatch(element, container) {
  if (!container || !container.contains(element)) {
    throw new Error("Search match must belong to the PDF viewer container");
  }
  const target = element.getBoundingClientRect();
  const viewport = container.getBoundingClientRect();
  if (!container.offsetWidth || !container.offsetHeight) {
    return;
  }
  const scaleX = viewport.width / container.offsetWidth;
  const scaleY = viewport.height / container.offsetHeight;
  if (!scaleX || !scaleY) {
    return;
  }
  const targetStyle = getComputedStyle(element);
  const containerStyle = getComputedStyle(container);
  const pixels = value => Number.parseFloat(value) || 0;
  const padding = (value, size) => {
    if (value === "auto") return 0;
    if (value.endsWith("%")) return pixels(value) * size / 100;
    if (/^-?[\d.]+px$/.test(value)) return pixels(value);
    const box = element.ownerDocument.createElement("div");
    const probe = element.ownerDocument.createElement("div");
    box.style.cssText = `all:initial;position:fixed;top:0;left:0;width:${size}px;height:${size}px;visibility:hidden;pointer-events:none;contain:strict;`;
    box.setAttribute("aria-hidden", "true");
    probe.style.cssText = "all:initial;position:absolute;left:0;width:0;height:0;";
    probe.style.top = value;
    box.append(probe);
    element.ownerDocument.body.append(box);
    try {
      return pixels(getComputedStyle(probe).top);
    } finally {
      box.remove();
    }
  };
  const paddingLeft = padding(containerStyle.scrollPaddingLeft, container.clientWidth);
  const paddingRight = padding(containerStyle.scrollPaddingRight, container.clientWidth);
  const top = container.scrollTop +
    (target.top - viewport.top) / scaleY - container.clientTop -
    pixels(targetStyle.scrollMarginTop) - padding(containerStyle.scrollPaddingTop, container.clientHeight);
  const left = container.scrollLeft +
    (target.left + target.right - 2 * viewport.left) / (2 * scaleX) -
    container.clientLeft - container.clientWidth / 2 +
    (pixels(targetStyle.scrollMarginRight) - pixels(targetStyle.scrollMarginLeft) - paddingLeft + paddingRight) / 2;
  container.scrollTo({ top, left, behavior: "auto" });
}
