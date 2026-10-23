/**
 * Canvas rendering engine cho photobooth.
 *
 * Mọi hàm vẽ dùng "design pixel" (300 DPI). Khi render ra file cuối cùng,
 * nhân toàn bộ thao tác vẽ với `scale` để đổi tỉ lệ sang khổ in thật.
 */

import { computeLayout, PAGE_W, PAGE_H, STRIP_W } from './frames.js';

export { computeLayout };

/* ------------------------------------------------------------------ */
/* Tiện ích                                                             */
/* ------------------------------------------------------------------ */

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
  ctx.beginPath();
  if (!rr) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Vẽ ảnh phủ kín (cover) vào hình chữ nhật, cắt giữa khung. */
function drawCover(ctx, img, x, y, w, h) {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const imgRatio = iw / ih;
  const boxRatio = w / h;
  let sw, sh, sx, sy;
  if (imgRatio > boxRatio) {
    sh = ih;
    sw = sh * boxRatio;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    sw = iw;
    sh = sw / boxRatio;
    sx = 0;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** PRNG tất định để họa tiết trang trí không nhảy giữa các lần render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Hình dạng sticker                                                    */
/* ------------------------------------------------------------------ */

function heartPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.78);
  ctx.bezierCurveTo(-r * 1.25, -r * 0.08, -r * 0.62, -r * 1.05, 0, -r * 0.38);
  ctx.bezierCurveTo(r * 0.62, -r * 1.05, r * 1.25, -r * 0.08, 0, r * 0.78);
  ctx.closePath();
}

function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function sparklePath(ctx, r) {
  const k = r * 0.26;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0);
  ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0);
  ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Vẽ sticker                                                           */
/* ------------------------------------------------------------------ */

/**
 * Sticker:
 *   { type:'emoji'|'shape', value, color?, x, y, size, rot, scale }
 *   x, y  : toạ độ chuẩn hoá 0..1 theo bề rộng/cao canvas
 *   size  : chiều cao sticker tính theo tỉ lệ bề rộng canvas
 */
export function drawSticker(ctx, st, W, H) {
  const size = (st.size || 0.12) * W;
  const x = st.x * W;
  const y = st.y * H;
  ctx.save();
  ctx.translate(x, y);
  if (st.rot) ctx.rotate(st.rot);
  if (st.scale && st.scale !== 1) ctx.scale(st.scale, st.scale);

  if (st.type === 'emoji') {
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.value, 0, 0);
  } else {
    const r = size / 2;
    const color = st.color || '#ffffff';
    switch (st.value) {
      case 'heart':
        heartPath(ctx, r);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case 'heartOutline':
        heartPath(ctx, r);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, r * 0.16);
        ctx.stroke();
        break;
      case 'star':
        starPath(ctx, r);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case 'sparkle':
        sparklePath(ctx, r);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case 'ring':
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, r * 0.18);
        ctx.stroke();
        break;
      default:
        break;
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Vẽ nền + trang trí + tiêu đề frame                                  */
/* ------------------------------------------------------------------ */

function paintBackground(ctx, frame, W, H) {
  const bg = frame.bg || { type: 'solid', color: '#ffffff' };
  if (bg.type === 'linear') {
    const angle = ((bg.angle || 0) * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = Math.abs(W * Math.sin(angle)) + Math.abs(H * Math.cos(angle));
    const dx = (Math.sin(angle) * len) / 2;
    const dy = (Math.cos(angle) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    bg.stops.forEach((c, i) => grad.addColorStop(bg.stops.length === 1 ? 0 : i / (bg.stops.length - 1), c));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg.color || '#ffffff';
  }
  ctx.fillRect(0, 0, W, H);
}

function paintDecor(ctx, frame) {
  const decor = frame.decor;
  if (!decor) return;
  const pad = frame.pad ?? 0;
  const head = frame.header ?? 0;
  if (!head) return;

  const rng = mulberry32(frame.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 7));
  const bandX = pad;
  const bandY = pad;
  const bandW = frame.w - pad * 2;
  const bandH = head;
  const count = decor.count || 14;
  const base = Math.min(bandH * 0.3, bandW * 0.06);

  for (let i = 0; i < count; i++) {
    const x = bandX + rng() * bandW;
    const y = bandY + rng() * bandH;
    const s = base * (0.5 + rng() * 0.9);
    ctx.save();
    ctx.globalAlpha = decor.alpha ?? 0.6;
    ctx.translate(x, y);
    ctx.rotate((rng() - 0.5) * 0.8);
    ctx.fillStyle = decor.color || '#ffffff';
    if (decor.type === 'hearts') {
      heartPath(ctx, s / 2);
      ctx.fill();
    } else if (decor.type === 'stars') {
      starPath(ctx, s / 2);
      ctx.fill();
    } else {
      sparklePath(ctx, s / 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function paintTitle(ctx, frame) {
  const t = frame.title;
  if (!t) return;
  const pad = frame.pad ?? 0;
  const head = frame.header ?? 0;
  const y = pad + head * (t.y ?? 0.55);
  ctx.save();
  ctx.fillStyle = t.color || '#000000';
  ctx.font = `${t.weight || 800} ${t.size}px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t.spacing) {
    const chars = [...t.text];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + t.spacing * (chars.length - 1);
    let cx = frame.w / 2 - total / 2;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => {
      ctx.fillText(c, cx, y);
      cx += widths[i] + t.spacing;
    });
  } else {
    ctx.fillText(t.text, frame.w / 2, y);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Vẽ toàn cảnh                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} frame
 * @param {Array<HTMLCanvasElement|null>} shots  ảnh đã chụp, theo thứ tự ô
 * @param {Array} stickers
 * @param {{scale?:number, offsetX?:number, offsetY?:number}} opts
 */
export function drawScene(ctx, frame, shots, stickers, opts = {}) {
  const scale = opts.scale ?? 1;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  paintBackground(ctx, frame, frame.w, frame.h);
  paintDecor(ctx, frame);

  const { cells } = computeLayout(frame);
  const cellStyle = frame.cell || {};

  cells.forEach((cell, i) => {
    // nền + đổ bóng
    ctx.save();
    if (cellStyle.shadow) {
      ctx.shadowColor = cellStyle.shadow;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
    }
    roundRect(ctx, cell.x, cell.y, cell.w, cell.h, cellStyle.radius || 0);
    ctx.fillStyle = '#e9eaf0';
    ctx.fill();
    ctx.restore();

    // ảnh
    ctx.save();
    roundRect(ctx, cell.x, cell.y, cell.w, cell.h, cellStyle.radius || 0);
    ctx.clip();
    const shot = shots && shots[i];
    if (shot) {
      drawCover(ctx, shot, cell.x, cell.y, cell.w, cell.h);
    } else {
      ctx.fillStyle = '#dcdde6';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.fillStyle = 'rgba(20,20,35,.26)';
      ctx.font = `600 ${Math.round(cell.h * 0.2)}px system-ui,-apple-system,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cell.x + cell.w / 2, cell.y + cell.h / 2);
    }
    ctx.restore();

    // viền
    if (cellStyle.border) {
      ctx.save();
      roundRect(ctx, cell.x, cell.y, cell.w, cell.h, cellStyle.radius || 0);
      ctx.strokeStyle = cellStyle.borderColor || '#ffffff';
      ctx.lineWidth = cellStyle.border;
      ctx.stroke();
      ctx.restore();
    }
  });

  paintTitle(ctx, frame);
  (stickers || []).forEach((st) => drawSticker(ctx, st, frame.w, frame.h));

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Xuất ảnh                                                             */
/* ------------------------------------------------------------------ */

/**
 * Render tờ 4x6 inch (1200x1800 @300dpi).
 * Frame dạng 'strip' -> 2 dải nằm cạnh nhau trên 1 tờ.
 * Frame dạng 'page'  -> dùng nguyên canvas của frame làm tờ.
 */
export function renderSheet(frame, shots, stickers, targetW = PAGE_W) {
  const s = targetW / PAGE_W;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * s);
  canvas.height = Math.round(PAGE_H * s);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (frame.sheet === 'page') {
    drawScene(ctx, frame, shots, stickers, { scale: (PAGE_W / frame.w) * s });
  } else {
    const ss = (STRIP_W / frame.w) * s;
    drawScene(ctx, frame, shots, stickers, { scale: ss, offsetX: 0 });
    drawScene(ctx, frame, shots, stickers, { scale: ss, offsetX: STRIP_W * s });
  }
  return canvas;
}

/** Render riêng dải 2x6 inch (dùng cho frame dạng strip). */
export function renderStrip(frame, shots, stickers, targetW = STRIP_W) {
  const s = targetW / frame.w;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(frame.w * s);
  canvas.height = Math.round(frame.h * s);
  const ctx = canvas.getContext('2d');
  drawScene(ctx, frame, shots, stickers, { scale: s });
  return canvas;
}

/** Ảnh xem trước nhỏ của frame (luôn theo tỉ lệ tờ 4x6). */
export function renderThumb(frame, targetW = 260) {
  return renderSheet(frame, null, [], targetW);
}

export { PAGE_W, PAGE_H, STRIP_W };
