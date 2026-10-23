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
    if (result === 'downloaded') notify('Thiết bị chưa hỗ trợ chia sẻ, ảnh đã được tải xuống.');
  };

  return (
    <section className="screen screen--result">
      <header className="screen__head">
        <div>
          <h2 className="screen__title">Xong rồi!</h2>
          <p className="screen__sub">
            Tờ in đã sẵn sàng ở 300 DPI. Tải PNG để lưu, hoặc in trực tiếp đúng khổ 4×6 inch.
          </p>
        </div>
      </header>

      <div className="result">
        <div className="result__preview">
          <canvas ref={previewRef} width={sheetCanvas.width} height={sheetCanvas.height} />
        </div>

        <div className="result__panel">
          <div className="result__summary">
            <div>
              <span className="result__key">Khung</span>
              <strong>{frame.name}</strong>
            </div>
            <div>
              <span className="result__key">Số ảnh</span>
              <strong>{frame.cuts}</strong>
            </div>
            <div>
              <span className="result__key">Kích thước</span>
              <strong>{sheetCanvas.width}×{sheetCanvas.height}px</strong>
            </div>
            <div>
              <span className="result__key">Định dạng</span>
              <strong>PNG · 300 DPI</strong>
            </div>
          </div>

          <div className="export-list">
            <button
              type="button"
              className="export-card is-primary"
              onClick={() => downloadCanvas(sheetCanvas, fileName)}
            >
              <span className="export-card__icon" aria-hidden="true">
                ⤓
              </span>
              <span className="export-card__body">
                <strong>Tải tờ 4×6</strong>
                <span>PNG in được ở 300 DPI</span>
              </span>
            </button>

            {frame.sheet === 'strip' && (
              <button
                type="button"
                className="export-card"
                onClick={() => downloadCanvas(renderStrip(frame, shots, stickers), fileName)}
              >
                <span className="export-card__icon" aria-hidden="true">
                  ▭
                </span>
                <span className="export-card__body">
                  <strong>Tải dải 2×6</strong>
                  <span>Một dải dọc, tiện gửi bạn bè</span>
                </span>
              </button>
            )}

            <button
              type="button"
              className="export-card"
              onClick={() => printCanvas(sheetCanvas, notify)}
            >
              <span className="export-card__icon" aria-hidden="true">
                ⎙
              </span>
              <span className="export-card__body">
                <strong>In ngay</strong>
                <span>Mở hộp thoại in của máy</span>
              </span>
            </button>

            {canShare && (
              <button type="button" className="export-card" onClick={handleShare}>
                <span className="export-card__icon" aria-hidden="true">
                  ↗
                </span>
                <span className="export-card__body">
                  <strong>Chia sẻ</strong>
                  <span>Gửi qua ứng dụng trên máy</span>
                </span>
              </button>
            )}
          </div>

          <p className="result__hint">
            Muốn chỉnh sticker? Bấm <strong>Quay lại</strong> ở góc trên để sửa mà không mất ảnh.
          </p>

          <button type="button" className="btn btn--ghost btn--block" onClick={onRestart}>
            Chụp lại từ đầu
          </button>
        </div>
      </div>
    </section>
  );
}
