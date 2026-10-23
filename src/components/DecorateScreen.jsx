import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STICKERS, STICKER_GROUPS } from '../lib/stickers.js';
import { drawScene, drawSticker } from '../lib/render.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Chip sticker vẽ bằng chính render engine để khớp 100% với ảnh in. */
function StickerChip({ def, size = 46 }) {
  const ref = useRef(null);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    drawSticker(
      ctx,
      { type: 'vector', value: def.value, x: 0.5, y: 0.5, size: 0.82, rot: 0, scale: 1 },
      size,
      size
    );
  }, [def, size]);
  return <canvas ref={ref} width={size} height={size} aria-hidden="true" />;
}

export default function DecorateScreen({ frame, shots, stickers, onStickersChange, onBack, onFinish }) {
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [group, setGroup] = useState('love');
  const [size, setSize] = useState(14);
  const [rot, setRot] = useState(0);
  const nextId = useRef(1);

  const previewScale = useMemo(() => {
    const maxW = 760;
    const maxH = 1040;
    return Math.min(1, maxW / frame.w, maxH / frame.h);
  }, [frame]);

  const selected = stickers.find((s) => s.id === selectedId) || null;
  const palette = useMemo(() => STICKERS.filter((d) => d.group === group), [group]);

  // Vẽ lại preview mỗi khi ảnh / sticker thay đổi.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(frame.w * previewScale);
    canvas.height = Math.round(frame.h * previewScale);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScene(ctx, frame, shots, stickers, { scale: previewScale });
  }, [frame, shots, stickers, previewScale]);

  // Đồng bộ thanh trượt với sticker đang chọn.
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
      type: 'vector',
      value: def.value,
      x: 0.5,
      y: 0.5,
      size: 0.13,
      rot: 0,
      scale: 1,
    };
    onStickersChange([...stickers, st]);
    setSelectedId(st.id);
  };

  const updateSelected = (patch) => {
    onStickersChange(stickers.map((st) => (st.id === selectedId ? { ...st, ...patch } : st)));
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = {
      ...selected,
      id: nextId.current++,
      x: clamp(selected.x + 0.06, 0.02, 0.98),
      y: clamp(selected.y + 0.06, 0.02, 0.98),
    };
    onStickersChange([...stickers, copy]);
    setSelectedId(copy.id);
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
            aria-label="Khung ảnh xem trước: chạm vào sticker để chọn, kéo để đổi vị trí"
          />
          <p className="decorate__caption">
            {selected
              ? 'Đang chọn một sticker: kéo để di chuyển, chỉnh bên phải.'
              : 'Chạm vào sticker trên ảnh để chỉnh, hoặc thêm sticker mới từ bảng bên cạnh.'}
          </p>
        </div>

        <div className="decorate__panel">
          <h2 className="panel__title">Trang trí</h2>
          <p className="panel__hint">
            {stickers.length > 0
              ? `Đã đặt ${stickers.length} sticker. Kéo trực tiếp trên ảnh để căn vị trí.`
              : 'Chọn sticker bên dưới để thêm vào ảnh, sau đó kéo để đặt vị trí.'}
          </p>

          <div className="sticker-tabs" role="group" aria-label="Nhóm sticker">
            {STICKER_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`sticker-tab${group === g.id ? ' is-active' : ''}`}
                onClick={() => setGroup(g.id)}
                aria-pressed={group === g.id}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="sticker-palette">
            {palette.map((def) => (
              <button
                key={def.value}
                type="button"
                className="sticker-chip"
                title={def.label}
                aria-label={`Thêm sticker ${def.label}`}
                onClick={() => addSticker(def)}
              >
                <StickerChip def={def} />
              </button>
            ))}
          </div>

          {selected ? (
            <div className="sticker-tools">
              <label className="tool">
                <span className="tool__label">
                  Kích thước <b>{size}%</b>
                </span>
                <input
                  type="range"
                  min="4"
                  max="42"
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
                <span className="tool__label">
                  Xoay <b>{rot}°</b>
                </span>
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
              <div className="tool-actions">
                <button type="button" className="btn btn--sm" onClick={duplicateSelected}>
                  Nhân đôi
                </button>
                <button type="button" className="btn btn--sm btn--danger" onClick={deleteSelected}>
                  Xoá sticker
                </button>
              </div>
            </div>
          ) : (
            <p className="panel__empty">Chưa chọn sticker nào.</p>
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
