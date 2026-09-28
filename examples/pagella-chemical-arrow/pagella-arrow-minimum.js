function setPagellaArrowMinimum(math) {
  let changed = 0;
  math.root.walkTree(node => {
    if (node.kind !== 'mo' || node.getText() !== '\uE409') return;
    const attributes = node.attributes;
    const stretchy = attributes.get('stretchy');
    if (stretchy !== true && stretchy !== 'true') return;
    if (attributes.isSet('minsize') || attributes.isSet('maxsize')) return;
    attributes.set('minsize', '2em');
    changed++;
  });
  return changed;
}
