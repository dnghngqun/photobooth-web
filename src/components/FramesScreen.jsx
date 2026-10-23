import { useMemo, useState } from 'react';
import { COLLECTIONS, getFramesByCollection, countByCollection } from '../lib/frames.js';
import FramePreview from './FramePreview.jsx';

export default function FramesScreen({ frameId, onSelect }) {
  const [collection, setCollection] = useState('all');
  const counts = useMemo(() => countByCollection(), []);
  const frames = useMemo(() => getFramesByCollection(collection), [collection]);
  const activeName = COLLECTIONS.find((c) => c.id === collection)?.name ?? 'Tất cả';

  return (
    <section className="screen">
      <h2 className="screen__title">Chọn khung ảnh</h2>
      <p className="screen__sub">
        {counts.all} phông chia theo {COLLECTIONS.length - 1} bộ sưu tập. Khung quyết định số ảnh của
        mỗi lượt chụp.
      </p>

      <div className="collection-bar" role="group" aria-label="Bộ sưu tập phông">
        {COLLECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`collection-chip${item.id === collection ? ' is-active' : ''}`}
            onClick={() => setCollection(item.id)}
            aria-pressed={item.id === collection}
          >
            <span className="collection-chip__emoji" aria-hidden="true">
              {item.emoji}
            </span>
            <span className="collection-chip__name">{item.name}</span>
            <span className="collection-chip__count">{counts[item.id] || 0}</span>
          </button>
        ))}
      </div>

      <p className="collection-note">
        Đang xem <strong>{activeName}</strong> · {frames.length} phông
      </p>

      <div className="frame-grid">
        {frames.map((frame) => (
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
            <span className="frame-card__desc">{frame.desc}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
