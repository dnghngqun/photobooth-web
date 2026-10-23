import { useState } from 'react';

const COUNTDOWN_OPTIONS = [3, 5, 8, 10, 12, 15];

export default function CaptureModeScreen({
  frame,
  onBack,
  onSelect,
  defaultMode = 'auto',
  defaultSeconds = 10,
}) {
  const [mode, setMode] = useState(defaultMode);
  const [seconds, setSeconds] = useState(defaultSeconds);

  return (
    <section className="screen">
      <h2 className="screen__title">Chọn kiểu chụp</h2>
      <p className="screen__sub">Chọn cách bạn muốn chụp ảnh cho khung {frame.name}.</p>

      <div className="capture-mode-grid">
        <button
          type="button"
          className={`capture-mode-card${mode === 'auto' ? ' is-active' : ''}`}
          onClick={() => setMode('auto')}
        >
          <div className="capture-mode-card__icon">⏱️</div>
          <div className="capture-mode-card__body">
            <h3>Tự chụp</h3>
            <p>Máy tự động chụp sau mỗi {seconds} giây</p>
          </div>
        </button>

        <button
          type="button"
          className={`capture-mode-card${mode === 'manual' ? ' is-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          <div className="capture-mode-card__icon">👆</div>
          <div className="capture-mode-card__body">
            <h3>Đếm ngược thủ công</h3>
            <p>Bấm nút chụp, đếm ngược 3-2-1 rồi chụp</p>
          </div>
        </button>
      </div>

      <div className="capture-settings">
        <div className="capture-settings__header">
          <h3>Cài đặt thời gian đếm ngược</h3>
          <span>Áp dụng cho chế độ tự chụp</span>
        </div>
        <div className="capture-settings__options">
          {COUNTDOWN_OPTIONS.map((val) => (
            <button
              key={val}
              type="button"
              className={`chip${seconds === val ? ' is-active' : ''}`}
              onClick={() => setSeconds(val)}
            >
              {val} giây
            </button>
          ))}
        </div>
        <p className="capture-settings__note">Hiển thị bộ đếm ở góc phải khung hình khi bật tự chụp</p>
      </div>

      <div className="screen__actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Quay lại
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onSelect({ mode, seconds })}
        >
          Tiếp tục
        </button>
      </div>
    </section>
  );
}
