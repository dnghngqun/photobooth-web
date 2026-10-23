/**
 * Thư viện sticker vector vẽ hoàn toàn bằng Canvas 2D (không dùng emoji/icon font).
 *
 * Mỗi sticker vẽ trong hệ toạ độ tâm (0,0) với bán kính r = size / 2,
 * nên có thể phóng to bao nhiêu cũng nét khi in 300 DPI.
 *
 *   draw(ctx, r, color?)  — color dùng để đổi màu chủ đạo (tuỳ sticker).
 */

/* ------------------------------------------------------------------ */
/* Tiện ích vẽ                                                          */
/* ------------------------------------------------------------------ */

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function radial(ctx, cx, cy, r0, r1, stops) {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function blob(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [cx1, cy1, x, y] = points[i];
    ctx.quadraticCurveTo(cx1, cy1, x, y);
  }
  ctx.closePath();
}

function starPath(ctx, r, inner = 0.42, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / points;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function sparklePath(ctx, r, k = 0.24) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * k, -r * k, r, 0);
  ctx.quadraticCurveTo(r * k, r * k, 0, r);
  ctx.quadraticCurveTo(-r * k, r * k, -r, 0);
  ctx.quadraticCurveTo(-r * k, -r * k, 0, -r);
  ctx.closePath();
}

function heartPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.74);
  ctx.bezierCurveTo(-r * 1.3, -r * 0.04, -r * 0.6, -r * 1.06, 0, -r * 0.34);
  ctx.bezierCurveTo(r * 0.6, -r * 1.06, r * 1.3, -r * 0.04, 0, r * 0.74);
  ctx.closePath();
}

function shine(ctx, x, y, rx, ry, rot, alpha = 0.72) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Sticker: yêu thương                                                  */
/* ------------------------------------------------------------------ */

const heart = (ctx, r, color = '#ff3f7d') => {
  heartPath(ctx, r);
  ctx.fillStyle = linear(ctx, 0, -r, 0, r, ['#ff9ec4', color, '#e01b5a']);
  ctx.fill();
  shine(ctx, -r * 0.42, -r * 0.33, r * 0.17, r * 0.11, -0.6, 0.75);
  shine(ctx, -r * 0.2, -r * 0.55, r * 0.07, r * 0.05, -0.6, 0.6);
};

const heartOutline = (ctx, r, color = '#ffffff') => {
  heartPath(ctx, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.lineJoin = 'round';
  ctx.stroke();
};

const doubleHeart = (ctx, r) => {
  ctx.save();
  ctx.translate(r * 0.34, -r * 0.3);
  ctx.scale(0.56, 0.56);
  heartPath(ctx, r);
  ctx.fillStyle = linear(ctx, 0, -r, 0, r, ['#e0d0ff', '#8b5cf6']);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-r * 0.16, r * 0.1);
  ctx.scale(0.82, 0.82);
  heartPath(ctx, r);
  ctx.fillStyle = linear(ctx, 0, -r, 0, r, ['#ffb3cf', '#f02c68']);
  ctx.fill();
  ctx.restore();
  shine(ctx, -r * 0.36, -r * 0.1, r * 0.12, r * 0.07, -0.6, 0.7);
};

const bow = (ctx, r, color = '#ff5fa2') => {
  const g = linear(ctx, -r, -r * 0.8, r, r * 0.8, ['#ffa6cf', color, '#d81b6a']);
  ctx.fillStyle = g;

  // tai trái
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-r * 0.5, -r * 0.8, -r * 1.08, -r * 0.52, -r * 0.94, -r * 0.06);
  ctx.bezierCurveTo(-r * 0.86, r * 0.42, -r * 0.34, r * 0.32, 0, 0);
  ctx.closePath();
  ctx.fill();

  // tai phải
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(r * 0.5, -r * 0.8, r * 1.08, -r * 0.52, r * 0.94, -r * 0.06);
  ctx.bezierCurveTo(r * 0.86, r * 0.42, r * 0.34, r * 0.32, 0, 0);
  ctx.closePath();
  ctx.fill();

  // đuôi nơ
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.45, r * 0.62, -r * 0.62, r * 0.86);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.74, 0, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.1, r * 0.05);
  ctx.quadraticCurveTo(r * 0.45, r * 0.62, r * 0.62, r * 0.86);
  ctx.quadraticCurveTo(r * 0.2, r * 0.74, 0, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // nút thắt
  ctx.beginPath();
  ctx.ellipse(0, r * 0.02, r * 0.19, r * 0.23, 0, 0, Math.PI * 2);
  ctx.fillStyle = linear(ctx, -r * 0.2, -r * 0.2, r * 0.2, r * 0.2, ['#ffd6e8', '#ff6fae']);
  ctx.fill();

  shine(ctx, -r * 0.55, -r * 0.42, r * 0.16, r * 0.07, -0.5, 0.55);
  shine(ctx, r * 0.55, -r * 0.42, r * 0.16, r * 0.07, 0.5, 0.55);
};

const lips = (ctx, r, color = '#ff2f6a') => {
  const g = linear(ctx, 0, -r * 0.45, 0, r * 0.7, ['#ff8aa8', color, '#b80a3c']);
  ctx.fillStyle = g;

  // môi trên: hai đỉnh nhỏ ở giữa tạo cupid's bow
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, -r * 0.06);
  ctx.quadraticCurveTo(-r * 0.58, -r * 0.52, -r * 0.26, -r * 0.22);
  ctx.quadraticCurveTo(-r * 0.1, -r * 0.36, 0, -r * 0.16);
  ctx.quadraticCurveTo(r * 0.1, -r * 0.36, r * 0.26, -r * 0.22);
  ctx.quadraticCurveTo(r * 0.58, -r * 0.52, r * 0.92, -r * 0.06);
  ctx.quadraticCurveTo(0, r * 0.08, -r * 0.92, -r * 0.06);
  ctx.closePath();
  ctx.fill();

  // môi dưới: bầu tròn
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, -r * 0.04);
  ctx.quadraticCurveTo(0, r * 0.88, r * 0.92, -r * 0.04);
  ctx.quadraticCurveTo(0, r * 0.2, -r * 0.92, -r * 0.04);
  ctx.closePath();
  ctx.fill();

  shine(ctx, -r * 0.22, r * 0.36, r * 0.2, r * 0.08, -0.15, 0.55);
  shine(ctx, -r * 0.42, -r * 0.24, r * 0.12, r * 0.05, -0.35, 0.4);
};

/* ------------------------------------------------------------------ */
/* Sticker: thiên nhiên                                                 */
/* ------------------------------------------------------------------ */

const star = (ctx, r, color = '#ffc247') => {
  starPath(ctx, r);
  ctx.fillStyle = linear(ctx, 0, -r, 0, r, ['#ffe89a', color, '#f59300']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
  shine(ctx, -r * 0.18, -r * 0.42, r * 0.1, r * 0.06, -0.4, 0.7);
};

const sparkle = (ctx, r, color = '#a78bfa') => {
  sparklePath(ctx, r);
  ctx.fillStyle = linear(ctx, -r, -r, r, r, ['#ffffff', color]);
  ctx.fill();
};

const sparkleBig = (ctx, r) => {
  ctx.save();
  ctx.scale(0.62, 0.62);
  ctx.translate(r * 0.9, -r * 0.55);
  sparklePath(ctx, r * 0.62);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fill();
  ctx.restore();
  sparklePath(ctx, r * 0.86);
  ctx.fillStyle = linear(ctx, -r, -r, r, r, ['#fff6ff', '#c084fc']);
  ctx.fill();
};

const flower = (ctx, r, color = '#ff8fc7') => {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const cx = Math.cos(a) * r * 0.46;
    const cy = Math.sin(a) * r * 0.46;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.38, r * 0.3, a, 0, Math.PI * 2);
    ctx.fillStyle = linear(ctx, cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3, ['#ffffff', color]);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, 0, 0, 0, r * 0.28, ['#fff3b0', '#ffb020']);
  ctx.fill();
};

const daisy = (ctx, r) => {
  ctx.save();
  ctx.fillStyle = linear(ctx, 0, -r, 0, r, ['#ffffff', '#e6e8f5']);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.58, r * 0.17, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, 0, -r * 0.05, 0, r * 0.24, ['#ffe680', '#f5a300']);
  ctx.fill();
};

const cherry = (ctx, r) => {
  ctx.strokeStyle = '#4a8a3c';
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, r * 0.18);
  ctx.quadraticCurveTo(-r * 0.2, -r * 0.55, r * 0.24, -r * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.32, r * 0.26);
  ctx.quadraticCurveTo(r * 0.36, -r * 0.3, r * 0.24, -r * 0.72);
  ctx.stroke();

  // lá
  ctx.beginPath();
  ctx.ellipse(r * 0.46, -r * 0.74, r * 0.24, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = linear(ctx, 0, -r * 0.9, 0, -r * 0.5, ['#8ee07a', '#3f8f34']);
  ctx.fill();

  [
    [-r * 0.36, r * 0.32],
    [r * 0.34, r * 0.4],
  ].forEach(([cx, cy], idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = radial(ctx, cx - r * 0.1, cy - r * 0.12, r * 0.04, r * 0.34, [
      idx ? '#ff6b81' : '#ff9aa9',
      idx ? '#c8102e' : '#d81b3d',
    ]);
    ctx.fill();
    shine(ctx, cx - r * 0.12, cy - r * 0.14, r * 0.08, r * 0.05, -0.6, 0.7);
  });
};

const strawberry = (ctx, r) => {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.92);
  ctx.bezierCurveTo(-r * 0.58, r * 0.62, -r * 0.84, r * 0.12, -r * 0.74, -r * 0.34);
  ctx.bezierCurveTo(-r * 0.64, -r * 0.7, r * 0.64, -r * 0.7, r * 0.74, -r * 0.34);
  ctx.bezierCurveTo(r * 0.84, r * 0.12, r * 0.58, r * 0.62, 0, r * 0.92);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -r * 0.6, 0, r * 0.92, ['#ff8b96', '#e01b3c', '#a80f2c']);
  ctx.fill();

  // lá: chùm 5 lá nhỏ ở đỉnh
  ctx.save();
  ctx.translate(0, -r * 0.56);
  ctx.fillStyle = linear(ctx, 0, -r * 0.24, 0, r * 0.24, ['#9ce87f', '#2f7d32']);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.17, r * 0.1, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // cuống
  ctx.strokeStyle = '#2f7d32';
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.6);
  ctx.lineTo(r * 0.04, -r * 0.9);
  ctx.stroke();

  // hạt
  ctx.fillStyle = 'rgba(255, 240, 200, .85)';
  [
    [-0.3, -0.1],
    [0.05, -0.18],
    [0.36, -0.05],
    [-0.16, 0.24],
    [0.22, 0.3],
    [0, 0.55],
  ].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.ellipse(sx * r, sy * r, r * 0.045, r * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  shine(ctx, -r * 0.32, -r * 0.18, r * 0.1, r * 0.16, -0.5, 0.35);
};

const sun = (ctx, r, color = '#ffb703') => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, r * 0.14);
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
    ctx.lineTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, -r * 0.15, -r * 0.18, 0, r * 0.55, ['#fff3a8', color, '#f08c00']);
  ctx.fill();
};

const moon = (ctx, r, color = '#a78bfa') => {
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, Math.PI * 0.32, Math.PI * 1.68, false);
  ctx.arc(r * 0.38, 0, r * 0.72, Math.PI * 1.6, Math.PI * 0.36, true);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, -r * 0.6, -r * 0.6, r * 0.6, r * 0.6, ['#fff6c9', color]);
  ctx.fill();
  shine(ctx, -r * 0.32, -r * 0.3, r * 0.1, r * 0.06, -0.5, 0.5);
};

const cloud = (ctx, r) => {
  ctx.fillStyle = linear(ctx, 0, -r * 0.6, 0, r * 0.6, ['#ffffff', '#d8e2f2']);
  ctx.beginPath();
  ctx.arc(-r * 0.34, r * 0.06, r * 0.32, 0, Math.PI * 2);
  ctx.arc(0, -r * 0.16, r * 0.42, 0, Math.PI * 2);
  ctx.arc(r * 0.38, r * 0.04, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(-r * 0.56, r * 0.02, r * 1.12, r * 0.34, r * 0.17)
    : ctx.rect(-r * 0.56, r * 0.02, r * 1.12, r * 0.34);
  ctx.fill();
  shine(ctx, -r * 0.3, -r * 0.32, r * 0.16, r * 0.09, -0.4, 0.75);
};

const rainbow = (ctx, r) => {
  const bands = ['#ff5f6d', '#ffa63d', '#ffe066', '#5ed67a', '#4cc3f5', '#a78bfa'];
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  bands.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(0, r * 0.45, r * (0.9 - i * 0.14), Math.PI, Math.PI * 2);
    ctx.strokeStyle = c;
    ctx.stroke();
  });
};

const lightning = (ctx, r, color = '#ffd23f') => {
  ctx.beginPath();
  ctx.moveTo(r * 0.18, -r * 0.9);
  ctx.lineTo(-r * 0.42, r * 0.08);
  ctx.lineTo(-r * 0.02, r * 0.08);
  ctx.lineTo(-r * 0.2, r * 0.9);
  ctx.lineTo(r * 0.46, -r * 0.14);
  ctx.lineTo(r * 0.04, -r * 0.14);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -r, 0, r, ['#fff5b0', color, '#f59e0b']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
};

const butterfly = (ctx, r) => {
  const wing = (sx, sy, rx, ry, rot, c1, c2) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = linear(ctx, 0, -ry, 0, ry, [c1, c2]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 30, 110, .35)';
    ctx.lineWidth = Math.max(0.8, r * 0.035);
    ctx.stroke();
    ctx.restore();
  };
  // cánh dưới trước, cánh trên sau để chồng lớp tự nhiên
  wing(-r * 0.46, r * 0.36, r * 0.28, r * 0.24, 0.55, '#fbcfe8', '#e0399a');
  wing(r * 0.46, r * 0.36, r * 0.28, r * 0.24, -0.55, '#fbcfe8', '#e0399a');
  wing(-r * 0.5, -r * 0.24, r * 0.32, r * 0.4, -0.3, '#f3e8ff', '#a855f7');
  wing(r * 0.5, -r * 0.24, r * 0.32, r * 0.4, 0.3, '#f3e8ff', '#a855f7');

  // thân
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.1, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4a3459';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 0.52, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#3b2a4a';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.18, -r * 0.78, -r * 0.34, -r * 0.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.quadraticCurveTo(r * 0.18, -r * 0.78, r * 0.34, -r * 0.82);
  ctx.stroke();
};

/* ------------------------------------------------------------------ */
/* Sticker: mặt cười                                                    */
/* ------------------------------------------------------------------ */

const faceBase = (ctx, r, colors) => {
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, -r * 0.25, -r * 0.3, 0, r, colors);
  ctx.fill();
};

const smiley = (ctx, r) => {
  faceBase(ctx, r, ['#fff2a8', '#ffd23f', '#f0a800']);
  ctx.fillStyle = '#3a2a12';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.12, r * 0.08, r * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.3, -r * 0.12, r * 0.08, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2a12';
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r * 0.04, r * 0.42, 0.28 * Math.PI, 0.72 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 120, 150, .38)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.54, r * 0.16, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.54, r * 0.16, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
};

const bear = (ctx, r) => {
  // tai
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(s * r * 0.56, -r * 0.56, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#a9713f';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * r * 0.56, -r * 0.56, r * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = '#f4c6a0';
    ctx.fill();
  });
  faceBase(ctx, r, ['#dfa774', '#b9793f', '#8d5524']);
  // mõm
  ctx.beginPath();
  ctx.ellipse(0, r * 0.24, r * 0.42, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f7e3c8';
  ctx.fill();
  // mắt + mũi
  ctx.fillStyle = '#3b2412';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.16, r * 0.075, r * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.28, -r * 0.16, r * 0.075, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 0.12, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b2412';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.24);
  ctx.lineTo(0, r * 0.34);
  ctx.moveTo(0, r * 0.34);
  ctx.quadraticCurveTo(-r * 0.12, r * 0.44, -r * 0.2, r * 0.34);
  ctx.moveTo(0, r * 0.34);
  ctx.quadraticCurveTo(r * 0.12, r * 0.44, r * 0.2, r * 0.34);
  ctx.stroke();
};

const cat = (ctx, r) => {
  // tai
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.72, -r * 0.18);
    ctx.lineTo(s * r * 0.52, -r * 0.86);
    ctx.lineTo(s * r * 0.1, -r * 0.56);
    ctx.closePath();
    ctx.fillStyle = '#f0b27a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * r * 0.62, -r * 0.3);
    ctx.lineTo(s * r * 0.52, -r * 0.7);
    ctx.lineTo(s * r * 0.26, -r * 0.52);
    ctx.closePath();
    ctx.fillStyle = '#ffb6b6';
    ctx.fill();
  });
  faceBase(ctx, r, ['#ffe3c4', '#f6c08a', '#d99657']);
  ctx.fillStyle = '#3b2a1c';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.1, r * 0.08, r * 0.11, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.3, -r * 0.1, r * 0.08, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, r * 0.18);
  ctx.lineTo(r * 0.08, r * 0.18);
  ctx.lineTo(0, r * 0.28);
  ctx.closePath();
  ctx.fillStyle = '#ff8fa3';
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,35,.75)';
  ctx.lineWidth = Math.max(0.8, r * 0.04);
  ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    [-0.06, 0.12].forEach((dy) => {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.34, r * 0.2 + dy * r);
      ctx.lineTo(s * r * 0.86, r * 0.1 + dy * r * 1.6);
      ctx.stroke();
    });
  });
};

const bunny = (ctx, r) => {
  [-1, 1].forEach((s) => {
    ctx.save();
    ctx.translate(s * r * 0.28, -r * 0.44);
    ctx.rotate(s * 0.22);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.19, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fillStyle = linear(ctx, 0, -r * 0.4, 0, r * 0.4, ['#ffffff', '#e3e0ee']);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.02, r * 0.1, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc2d4';
    ctx.fill();
    ctx.restore();
  });
  ctx.save();
  ctx.translate(0, r * 0.12);
  faceBase(ctx, r * 0.9, ['#ffffff', '#f4f2fb', '#dcd8ea']);
  ctx.fillStyle = '#3a3145';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.06, r * 0.075, r * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.28, -r * 0.06, r * 0.075, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.24, r * 0.09, r * 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8fab';
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 150, 180, .4)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.52, r * 0.2, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.52, r * 0.2, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/* ------------------------------------------------------------------ */
/* Sticker: tiệc tùng / retro                                           */
/* ------------------------------------------------------------------ */

const crown = (ctx, r) => {
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, r * 0.5);
  ctx.lineTo(-r * 0.7, -r * 0.42);
  ctx.lineTo(-r * 0.28, r * 0.02);
  ctx.lineTo(0, -r * 0.62);
  ctx.lineTo(r * 0.28, r * 0.02);
  ctx.lineTo(r * 0.7, -r * 0.42);
  ctx.lineTo(r * 0.8, r * 0.5);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -r * 0.6, 0, r * 0.5, ['#ffe9a8', '#f5c542', '#c98b14']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  // đá quý
  const gems = [
    [-r * 0.42, r * 0.2, '#ff5f8f'],
    [0, r * 0.14, '#4cc3f5'],
    [r * 0.42, r * 0.2, '#a78bfa'],
  ];
  gems.forEach(([x, y, c]) => {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    shine(ctx, x - r * 0.03, y - r * 0.04, r * 0.03, r * 0.02, -0.5, 0.8);
  });
};

const diamond = (ctx, r) => {
  const g = linear(ctx, 0, -r * 0.7, 0, r * 0.7, ['#eaf6ff', '#8ecbff', '#4f89e8']);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.66);
  ctx.lineTo(r * 0.72, -r * 0.16);
  ctx.lineTo(0, r * 0.74);
  ctx.lineTo(-r * 0.72, -r * 0.16);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.16);
  ctx.lineTo(r * 0.72, -r * 0.16);
  ctx.moveTo(0, -r * 0.66);
  ctx.lineTo(0, r * 0.74);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.stroke();
  sparklePath(ctx, r * 0.16);
  ctx.save();
  ctx.translate(r * 0.36, -r * 0.34);
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.fill();
  ctx.restore();
};

const camera = (ctx, r) => {
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(-r * 0.86, -r * 0.5, r * 1.72, r * 1.14, r * 0.2)
    : ctx.rect(-r * 0.86, -r * 0.5, r * 1.72, r * 1.14);
  ctx.fillStyle = linear(ctx, 0, -r * 0.5, 0, r * 0.64, ['#4b4b60', '#22222e']);
  ctx.fill();
  // kính
  ctx.beginPath();
  ctx.arc(0, r * 0.06, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#111119';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, r * 0.06, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, -r * 0.1, -r * 0.05, 0, r * 0.32, ['#9be7ff', '#2b6f9c', '#122c40']);
  ctx.fill();
  shine(ctx, -r * 0.1, -r * 0.06, r * 0.09, r * 0.06, -0.6, 0.65);
  // đèn flash + nút
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(r * 0.44, -r * 0.4, r * 0.28, r * 0.16, r * 0.05)
    : ctx.rect(r * 0.44, -r * 0.4, r * 0.28, r * 0.16);
  ctx.fillStyle = '#ffe9a8';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(-r * 0.7, -r * 0.68, r * 0.5, r * 0.2, r * 0.06)
    : ctx.rect(-r * 0.7, -r * 0.68, r * 0.5, r * 0.2);
  ctx.fillStyle = '#3a3a4c';
  ctx.fill();
};

const film = (ctx, r) => {
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(-r * 0.9, -r * 0.62, r * 1.8, r * 1.24, r * 0.1)
    : ctx.rect(-r * 0.9, -r * 0.62, r * 1.8, r * 1.24);
  ctx.fillStyle = '#1b1b22';
  ctx.fill();
  ctx.fillStyle = '#0a0a0e';
  ctx.fillRect(-r * 0.52, -r * 0.42, r * 1.04, r * 0.84);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 4; i++) {
    const y = -r * 0.5 + i * r * 0.3;
    ctx.fillRect(-r * 0.82, y, r * 0.14, r * 0.18);
    ctx.fillRect(r * 0.68, y, r * 0.14, r * 0.18);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = Math.max(0.7, r * 0.03);
  ctx.strokeRect(-r * 0.52, -r * 0.42, r * 1.04, r * 0.84);
};

const music = (ctx, r) => {
  ctx.fillStyle = linear(ctx, 0, -r * 0.7, 0, r * 0.7, ['#c4b5fd', '#7c3aed']);
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.42, r * 0.42, r * 0.24, r * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(s * r * 0.42 + r * 0.16, -r * 0.5, r * 0.1, r * 0.9, r * 0.05)
      : ctx.rect(s * r * 0.42 + r * 0.16, -r * 0.5, r * 0.1, r * 0.9);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(-r * 0.58, -r * 0.54, r * 1.16, r * 0.16, r * 0.07)
    : ctx.rect(-r * 0.58, -r * 0.54, r * 1.16, r * 0.16);
  ctx.fill();
};

const balloon = (ctx, r, color = '#ff5f8f') => {
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.2, r * 0.58, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, -r * 0.2, -r * 0.45, 0, r * 0.8, ['#ffd0e0', color, '#c81e55']);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.46);
  ctx.lineTo(-r * 0.1, r * 0.58);
  ctx.lineTo(r * 0.1, r * 0.58);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.58);
  ctx.quadraticCurveTo(r * 0.22, r * 0.78, -r * 0.04, r * 0.96);
  ctx.stroke();
  shine(ctx, -r * 0.24, -r * 0.46, r * 0.12, r * 0.2, -0.5, 0.6);
};

/* ------------------------------------------------------------------ */
/* Catalogue                                                            */
/* ------------------------------------------------------------------ */

export const STICKER_GROUPS = [
  { id: 'love', name: 'Yêu thương' },
  { id: 'nature', name: 'Thiên nhiên' },
  { id: 'cute', name: 'Mặt cười' },
  { id: 'party', name: 'Tiệc tùng' },
  { id: 'retro', name: 'Retro' },
];

export const STICKERS = [
  { type: 'vector', value: 'heart', group: 'love', label: 'Trái tim' },
  { type: 'vector', value: 'heartOutline', group: 'love', label: 'Tim rỗng' },
  { type: 'vector', value: 'doubleHeart', group: 'love', label: 'Hai trái tim' },
  { type: 'vector', value: 'bow', group: 'love', label: 'Nơ hồng' },
  { type: 'vector', value: 'lips', group: 'love', label: 'Môi' },

  { type: 'vector', value: 'flower', group: 'nature', label: 'Hoa hồng' },
  { type: 'vector', value: 'daisy', group: 'nature', label: 'Hoa cúc' },
  { type: 'vector', value: 'cherry', group: 'nature', label: 'Anh đào' },
  { type: 'vector', value: 'strawberry', group: 'nature', label: 'Dâu tây' },
  { type: 'vector', value: 'sun', group: 'nature', label: 'Mặt trời' },
  { type: 'vector', value: 'moon', group: 'nature', label: 'Trăng' },
  { type: 'vector', value: 'cloud', group: 'nature', label: 'Mây' },
  { type: 'vector', value: 'rainbow', group: 'nature', label: 'Cầu vồng' },
  { type: 'vector', value: 'butterfly', group: 'nature', label: 'Bướm' },

  { type: 'vector', value: 'smiley', group: 'cute', label: 'Mặt cười' },
  { type: 'vector', value: 'bear', group: 'cute', label: 'Gấu' },
  { type: 'vector', value: 'cat', group: 'cute', label: 'Mèo' },
  { type: 'vector', value: 'bunny', group: 'cute', label: 'Thỏ' },

  { type: 'vector', value: 'star', group: 'party', label: 'Ngôi sao' },
  { type: 'vector', value: 'sparkle', group: 'party', label: 'Lấp lánh' },
  { type: 'vector', value: 'sparkleBig', group: 'party', label: 'Sao lấp lánh' },
  { type: 'vector', value: 'balloon', group: 'party', label: 'Bóng bay' },
  { type: 'vector', value: 'crown', group: 'party', label: 'Vương miện' },
  { type: 'vector', value: 'diamond', group: 'party', label: 'Kim cương' },
  { type: 'vector', value: 'lightning', group: 'party', label: 'Tia chớp' },

  { type: 'vector', value: 'camera', group: 'retro', label: 'Máy ảnh' },
  { type: 'vector', value: 'film', group: 'retro', label: 'Cuộn phim' },
  { type: 'vector', value: 'music', group: 'retro', label: 'Nốt nhạc' },
];

const REGISTRY = {
  heart,
  heartOutline,
  doubleHeart,
  bow,
  lips,
  flower,
  daisy,
  cherry,
  strawberry,
  sun,
  moon,
  cloud,
  rainbow,
  butterfly,
  smiley,
  bear,
  cat,
  bunny,
  star,
  sparkle,
  sparkleBig,
  balloon,
  crown,
  diamond,
  lightning,
  camera,
  film,
  music,
};

/** Vẽ một sticker vector với tâm tại (0,0). */
export function drawVectorSticker(ctx, value, size, color) {
  const fn = REGISTRY[value];
  if (!fn) return false;
  fn(ctx, size / 2, color);
  return true;
}
