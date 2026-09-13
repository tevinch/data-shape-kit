export function makeSamplePages(count, { format = 'JPEG', byteArray = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1191; canvas.height = 1461;
  const ctx = canvas.getContext('2d');
  const pages = [];
  for (let page = 1; page <= count; page++) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f5f7fb'); gradient.addColorStop(1, '#dce6f8');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1f2937'; ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`Raster report - page ${page}`, 60, 100);
    ctx.font = '26px sans-serif';
    for (let row = 0; row < 28; row++) ctx.fillText(`Sample row ${row + 1}: page ${page}`, 60, 170 + row * 42);
    const url = canvas.toDataURL(format === 'PNG' ? 'image/png' : 'image/jpeg', 0.92);
    const image = byteArray ? Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0)) : url;
    pages.push({ image, format });
  }
  canvas.width = canvas.height = 0;
  return pages;
}
