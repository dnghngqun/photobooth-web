import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STICKERS } from '../lib/frames.js';
import { drawScene, drawSticker } from '../lib/render.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Chip sticker dạng shape — vẽ bằng chính hàm của render engine. */
function ShapeChip({ def }) {
  const ref = useRef(null);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const size = 40;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    drawSticker(
      ctx,
      { type: 'shape', value: def.value, color: def.color, x: 0.5, y: 0.5, size: 0.78, rot: 0, scale: 1 },
      size,
      size
    );
  }, [def]);
  return <canvas ref={ref} width={40} height={40} />;
}

export default function DecorateScreen({
  frame,
  shots,
  stickers,
  onStickersChange,
  onBack,
  onFinish,
}) {
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [size, setSize] = useState(14);
  const [rot, setRot] = useState(0);
  const nextId = useRef(1);

  // Kích thước canvas xem trước: giới hạn chiều cao để vẽ mượt trên mobile.
  const previewScale = useMemo(() => {
    const maxW = 720;
    const maxH = 1000;
    return Math.min(1, maxW / frame.w, maxH / frame.h);
  }, [frame]);

  const selected = stickers.find((s) => s.id === selectedId) || null;

  // Vẽ lại preview mỗi khi ảnh/sticker thay đổi.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(frame.w * previewScale);
    canvas.height = Math.round(frame.h * previewScale);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScene(ctx, frame, shots, stickers, { scale: previewScale });
  }, [frame, shots, stickers, previewScale]);

  // Đồng bộ tool với sticker đang chọn.
  useEffect(() => {
    if (selected) {
      setSize(Math.round(selected.size * 100));
      setRot(Math.round((selected.rot * 180) / Math.PI));
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointerToDesign = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * frame.w,
        y: ((event.clientY - rect.top) / rect.height) * frame.h,
      };
    },
    [frame]
  );

  const hitSticker = useCallback(
    (point) => {
      for (let i = stickers.length - 1; i >= 0; i--) {
        const st = stickers[i];
        const r = (st.size * frame.w) / 2;
        const dx = point.x - st.x * frame.w;
        const dy = point.y - st.y * frame.h;
        if (dx * dx + dy * dy <= r * r) return st;
      }
      return null;
    },
    [frame, stickers]
  );

  const dragRef = useRef(null);

  const handlePointerDown = (event) => {
    const point = pointerToDesign(event);
    const st = hitSticker(point);
    if (!st) {
      setSelectedId(null);
      return;
    }
    setSelectedId(st.id);
    dragRef.current = {
      id: st.id,
      offsetX: point.x - st.x * frame.w,
      offsetY: point.y - st.y * frame.h,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointerToDesign(event);
    onStickersChange(
      stickers.map((st) =>
        st.id === drag.id
          ? {
              ...st,
              x: clamp((point.x - drag.offsetX) / frame.w, 0.02, 0.98),
              y: clamp((point.y - drag.offsetY) / frame.h, 0.02, 0.98),
            }
          : st
      )
    );
  };

  const endDrag = (event) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const addSticker = (def) => {
    const st = {
      id: nextId.current++,
      type: def.type,
      value: def.value,
      color: def.color,
      x: 0.5,
      y: 0.5,
      size: def.type === 'emoji' ? 0.13 : 0.1,
      rot: 0,
      scale: 1,
    };
    onStickersChange([...stickers, st]);
    setSelectedId(st.id);
  };

  const updateSelected = (patch) => {
    onStickersChange(stickers.map((st) => (st.id === selectedId ? { ...st, ...patch } : st)));
  };

  const deleteSelected = () => {
    onStickersChange(stickers.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <section className="screen screen--decorate">
      <div className="decorate">
        <div className="decorate__stage">
          <canvas
            ref={canvasRef}
            className="decorate__canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-label="Khung ảnh xem trước — chạm vào sticker để chọn, kéo để đổi vị trí"
          />
        </div>
        <div className="decorate__panel">
          <h2 className="panel__title">Trang trí</h2>
          <p className="panel__hint">
            {selected
              ? 'Kéo sticker để đổi vị trí, dùng thanh trượt bên dưới để chỉnh kích thước và góc xoay.'
              : 'Chạm một sticker để thêm vào ảnh, rồi kéo để đặt vị trí.'}
          </p>

          <div className="sticker-palette">
            {STICKERS.map((def, i) => (
              <button
                key={`${def.value}-${i}`}
                type="button"
                className="sticker-chip"
                title={def.label}
                aria-label={`Thêm sticker ${def.label}`}
                onClick={() => addSticker(def)}
              >
                {def.type === 'emoji' ? def.value : <ShapeChip def={def} />}
              </button>
            ))}
          </div>

          {selected && (
            <div className="sticker-tools">
              <label className="tool">
                <span>Size</span>
                <input
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  value={size}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSize(v);
                    updateSelected({ size: v / 100 });
                  }}
                />
              </label>
              <label className="tool">
                <span>Xoay</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rot}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRot(v);
                    updateSelected({ rot: (v * Math.PI) / 180 });
                  }}
                />
              </label>
              <button type="button" className="btn btn--danger btn--sm" onClick={deleteSelected}>
                Xoá sticker
              </button>
            </div>
          )}

          <div className="screen__actions">
            <button type="button" className="btn btn--ghost" onClick={onBack}>
              Quay lại
            </button>
            <button type="button" className="btn btn--primary" onClick={onFinish}>
              Hoàn tất
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
