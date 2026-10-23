import { FRAMES } from '../lib/frames.js';
import FramePreview from './FramePreview.jsx';

export default function FramesScreen({ frameId, onSelect }) {
  return (
    <section className="screen">
      <h2 className="screen__title">Chọn khung ảnh</h2>
      <p className="screen__sub">Khung quyết định số ảnh của mỗi lượt chụp.</p>
      <div className="frame-grid">
        {FRAMES.map((frame) => (
          <button
            key={frame.id}
            type="button"
            className={`frame-card${frame.id === frameId ? ' is-active' : ''}`}
            onClick={() => onSelect(frame.id)}
            aria-pressed={frame.id === frameId}
          >
            <span className="frame-card__preview">
              <FramePreview frame={frame} />
            </span>
            <span className="frame-card__name">{frame.name}</span>
            <span className="frame-card__meta">
              {frame.cuts} ảnh · {frame.sheet === 'strip' ? 'dải 2×6' : 'tờ 4×6'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
