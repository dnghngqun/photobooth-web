/**
 * Xuất ảnh: tải về, in 4×6 inch, chia sẻ qua Web Share API.
 */

export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}

export function downloadCanvas(canvas, name) {
  canvasToBlob(canvas).then((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}

/**
 * In canvas ra đúng khổ 4×6 inch bằng một iframe ẩn.
 * @param {HTMLCanvasElement} canvas
 * @param {(msg: string) => void} [onError]
 */
export function printCanvas(canvas, onError) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const dataUrl = canvas.toDataURL('image/png');
  doc.open();
  doc.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>In</title><style>' +
      '@page{size:4in 6in;margin:0}' +
      'html,body{margin:0;padding:0;background:#fff}' +
      'img{width:4in;height:6in;display:block}' +
      '</style></head><body><img id="print-img" src="' +
      dataUrl +
      '"></body></html>'
  );
  doc.close();

  const go = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      onError?.('Trình duyệt chặn cửa sổ in — hãy tải ảnh rồi in thủ công.');
    }
    setTimeout(() => iframe.remove(), 2000);
  };

  const img = doc.getElementById('print-img');
  if (img && img.complete) setTimeout(go, 300);
  else if (img) img.onload = () => setTimeout(go, 150);
  else setTimeout(go, 400);
}

/**
 * Chia sẻ ảnh. Nếu thiết bị không hỗ trợ chia sẻ file thì tải ảnh xuống.
 * @returns {Promise<'shared'|'downloaded'|'cancelled'|'unsupported'>}
 */
export async function shareCanvas(canvas, name) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return 'unsupported';
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Photobooth' });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  downloadCanvas(canvas, name);
  return 'downloaded';
}
