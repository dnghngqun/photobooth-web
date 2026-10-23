/**
 * Dữ liệu frame + layout engine cho photobooth 4-cut / 6-cut / 8-cut.
 *
 * Toàn bộ kích thước tính theo đơn vị "design pixel" = 300 DPI.
 *   4 inch = 1200 px, 6 inch = 1800 px, 1 inch = 300 px
 *
 * Hai kiểu in:
 *   sheet: 'strip' -> canvas là dải 2x6 inch (600x1800), in ra 2 dải trên 1 tờ 4x6
 *   sheet: 'page'  -> canvas là nguyên tờ 4x6 inch (1200x1800)
 */

export const INCH = 300;
export const PAGE_W = 4 * INCH;   // 1200
export const PAGE_H = 6 * INCH;   // 1800
export const STRIP_W = 2 * INCH;  // 600

export const FRAMES = [
  {
    id: 'strip4',
    name: 'Dải 4-cut',
    desc: 'Dải trắng tối giản, in 2 dải trên tờ 4×6',
    cuts: 4, cols: 1, rows: 4, sheet: 'strip',
    w: 600, h: 1800, pad: 0, gap: 0, header: 0, footer: 0,
    bg: { type: 'linear', angle: 90, stops: ['#ffffff', '#f4f5f9'] },
    cell: { border: 0, borderColor: '#ffffff', radius: 0, shadow: null },
    title: null,
    decor: null,
  },
  {
    id: 'classic4',
    name: 'Classic 4-cut',
    desc: 'Viền trắng, tiêu đề MEMORY',
    cuts: 4, cols: 1, rows: 4, sheet: 'strip',
    w: 600, h: 1800, pad: 22, gap: 12, header: 116, footer: 0,
    bg: { type: 'linear', angle: 180, stops: ['#ffffff', '#e9ebf3'] },
    cell: { border: 6, borderColor: '#ffffff', radius: 8, shadow: 'rgba(15,18,35,.20)' },
    title: { text: 'MEMORY', color: '#23233a', size: 52, weight: 800, y: 0.58, spacing: 4 },
    decor: null,
  },
  {
    id: 'pink4',
    name: 'Pink 4-cut',
    desc: 'Hồng pastel, hình trái tim',
    cuts: 4, cols: 1, rows: 4, sheet: 'strip',
    w: 600, h: 1800, pad: 22, gap: 12, header: 116, footer: 0,
    bg: { type: 'linear', angle: 180, stops: ['#ffe0ec', '#ffb2cd'] },
    cell: { border: 6, borderColor: '#ffffff', radius: 12, shadow: 'rgba(180,30,90,.28)' },
    title: { text: 'LOVE', color: '#a3125a', size: 50, weight: 800, y: 0.58, spacing: 6 },
    decor: { type: 'hearts', color: '#ffffff', alpha: 0.72, count: 14 },
  },
  {
    id: 'retro6',
    name: 'Retro 6-cut',
    desc: 'Giấy ảnh cũ, 6 ô trên tờ 4×6',
    cuts: 6, cols: 2, rows: 3, sheet: 'page',
    w: 1200, h: 1800, pad: 40, gap: 16, header: 156, footer: 0,
    bg: { type: 'linear', angle: 180, stops: ['#fff6e5', '#ffd8a5'] },
    cell: { border: 14, borderColor: '#ffffff', radius: 4, shadow: 'rgba(80,45,10,.24)' },
    title: { text: 'GOOD TIMES', color: '#7a4a12', size: 78, weight: 800, y: 0.56, spacing: 8 },
    decor: { type: 'stars', color: '#c98b3a', alpha: 0.5, count: 18 },
  },
  {
    id: 'modern6',
    name: 'Modern 6-cut',
    desc: 'Nền tối, bo góc mềm',
    cuts: 6, cols: 2, rows: 3, sheet: 'page',
    w: 1200, h: 1800, pad: 44, gap: 18, header: 156, footer: 0,
    bg: { type: 'linear', angle: 160, stops: ['#1b1b2f', '#2c2c55'] },
    cell: { border: 0, borderColor: '#ffffff', radius: 20, shadow: 'rgba(0,0,0,.5)' },
    title: { text: 'TODAY', color: '#ffffff', size: 86, weight: 800, y: 0.56, spacing: 14 },
    decor: { type: 'sparkles', color: '#8ea2ff', alpha: 0.6, count: 20 },
  },
  {
    id: 'gold8',
    name: 'Gold 8-cut',
    desc: 'Đen-vàng, 8 ô trên tờ 4×6',
    cuts: 8, cols: 2, rows: 4, sheet: 'page',
    w: 1200, h: 1800, pad: 40, gap: 14, header: 136, footer: 0,
    bg: { type: 'linear', angle: 180, stops: ['#2c2013', '#120d07'] },
    cell: { border: 4, borderColor: '#d9b36a', radius: 8, shadow: 'rgba(0,0,0,.55)' },
    title: { text: '8 CUT', color: '#e8c98a', size: 68, weight: 800, y: 0.52, spacing: 12 },
    decor: { type: 'sparkles', color: '#d9b36a', alpha: 0.5, count: 22 },
  },
  {
    id: 'mint8',
    name: 'Mint 8-cut',
    desc: 'Xanh mint tươi, 8 ô',
    cuts: 8, cols: 2, rows: 4, sheet: 'page',
    w: 1200, h: 1800, pad: 40, gap: 14, header: 136, footer: 0,
    bg: { type: 'linear', angle: 200, stops: ['#dcfff6', '#8ae9d4'] },
    cell: { border: 6, borderColor: '#ffffff', radius: 14, shadow: 'rgba(10,80,70,.24)' },
    title: { text: 'FRESH', color: '#0d5a4c', size: 68, weight: 800, y: 0.52, spacing: 12 },
    decor: { type: 'hearts', color: '#ffffff', alpha: 0.6, count: 18 },
  },
];

export function getFrame(id) {
  return FRAMES.find((f) => f.id === id) || FRAMES[0];
}

/**
 * Tính hình chữ nhật của từng ô ảnh trong frame.
 * Trả về { cells, inner } — cell theo thứ tự hàng trên xuống, trái sang phải.
 */
export function computeLayout(frame) {
  const pad = frame.pad ?? 0;
  const head = frame.header ?? 0;
  const foot = frame.footer ?? 0;
  const gap = frame.gap ?? 0;

  const x0 = pad;
  const y0 = pad + head;
  const innerW = frame.w - pad * 2;
  const innerH = frame.h - pad * 2 - head - foot;

  const cw = (innerW - gap * (frame.cols - 1)) / frame.cols;
  const ch = (innerH - gap * (frame.rows - 1)) / frame.rows;

  const cells = [];
  for (let r = 0; r < frame.rows; r++) {
    for (let c = 0; c < frame.cols; c++) {
      cells.push({
        x: x0 + c * (cw + gap),
        y: y0 + r * (ch + gap),
        w: cw,
        h: ch,
      });
    }
  }
  return { cells, inner: { x: x0, y: y0, w: innerW, h: innerH }, head, foot, pad };
}

/**
 * Catalogue sticker.
 *   type 'emoji'  -> value là ký tự emoji
 *   type 'shape'  -> value là tên shape vẽ bằng path: heart | star | sparkle | circle | ring | heartOutline
 *   size: chiều cao của sticker tính theo tỉ lệ bề rộng canvas
 */
export const STICKERS = [
  { type: 'emoji', value: '🎉', label: 'Party' },
  { type: 'emoji', value: '🥳', label: 'Celebrate' },
  { type: 'emoji', value: '💖', label: 'Heart' },
  { type: 'emoji', value: '✨', label: 'Sparkle' },
  { type: 'emoji', value: '🌸', label: 'Flower' },
  { type: 'emoji', value: '🥂', label: 'Cheers' },
  { type: 'emoji', value: '🎈', label: 'Balloon' },
  { type: 'emoji', value: '👑', label: 'Crown' },
  { type: 'emoji', value: '🕶️', label: 'Cool' },
  { type: 'emoji', value: '😎', label: 'Sunglasses' },
  { type: 'emoji', value: '🐻', label: 'Bear' },
  { type: 'emoji', value: '🐱', label: 'Cat' },
  { type: 'emoji', value: '🦄', label: 'Unicorn' },
  { type: 'emoji', value: '🌈', label: 'Rainbow' },
  { type: 'emoji', value: '🍭', label: 'Candy' },
  { type: 'emoji', value: '🍦', label: 'Ice cream' },
  { type: 'emoji', value: '⭐️', label: 'Star' },
  { type: 'emoji', value: '🎂', label: 'Cake' },
  { type: 'emoji', value: '💐', label: 'Bouquet' },
  { type: 'emoji', value: '🔥', label: 'Fire' },
  { type: 'emoji', value: '🏆', label: 'Trophy' },
  { type: 'emoji', value: '👰', label: 'Bride' },
  { type: 'emoji', value: '🥳', label: 'Party face' },
  { type: 'shape', value: 'heart', color: '#ff4d6d', label: 'Trái tim' },
  { type: 'shape', value: 'heartOutline', color: '#ffffff', label: 'Tim rỗng' },
  { type: 'shape', value: 'star', color: '#ffc93c', label: 'Ngôi sao' },
  { type: 'shape', value: 'sparkle', color: '#8ea2ff', label: 'Lấp lánh' },
  { type: 'shape', value: 'circle', color: '#22d3ee', label: 'Tròn' },
  { type: 'shape', value: 'ring', color: '#ffffff', label: 'Vòng tròn' },
];
