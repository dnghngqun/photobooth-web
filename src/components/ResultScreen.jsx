import { useEffect, useMemo, useRef, useState } from 'react';
import { renderSheet, renderStrip, PAGE_W } from '../lib/render.js';
import { downloadCanvas, printCanvas, shareCanvas } from '../lib/download.js';

export default function ResultScreen({ frame, shots, stickers, fileName, notify, onRestart }) {
  const sheetCanvas = useMemo(
    () => renderSheet(frame, shots, stickers, PAGE_W),
    [frame, shots, stickers]
  );
  const previewRef = useRef(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const target = previewRef.current;
    if (!target) return;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(sheetCanvas, 0, 0);
  }, [sheetCanvas]);

  useEffect(() => {
    setCanShare(Boolean(navigator.share && navigator.canShare));
  }, []);

  const handleShare = async () => {
    const result = await shareCanvas(sheetCanvas, fileName);
    if (result === 'downloaded') notify('Thiết bị chưa hỗ trợ chia sẻ — ảnh đã được tải xuống.');
  };

  return (
    <section className="screen">
      <h2 className="screen__title">Hoàn tất!</h2>
      <div className="result">
        <div className="result__preview">
          <canvas ref={previewRef} width={sheetCanvas.width} height={sheetCanvas.height} />
        </div>
        <div className="result__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => downloadCanvas(sheetCanvas, fileName)}
          >
            Tải ảnh 4&times;6
          </button>
          {frame.sheet === 'strip' && (
            <button
              type="button"
              className="btn"
              onClick={() => downloadCanvas(renderStrip(frame, shots, stickers), fileName)}
            >
              Tải dải 2&times;6
            </button>
          )}
          <button type="button" className="btn" onClick={() => printCanvas(sheetCanvas, notify)}>
            In 4&times;6
          </button>
          {canShare && (
            <button type="button" className="btn" onClick={handleShare}>
              Chia sẻ
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onRestart}>
            Chụp lại từ đầu
          </button>
        </div>
      </div>
    </section>
  );
}
