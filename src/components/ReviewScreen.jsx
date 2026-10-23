import { useEffect, useRef } from 'react';

/** Vẽ ảnh đã chụp vào canvas xem lại. */
function ReviewThumb({ shot }) {
  const ref = useRef(null);
  useEffect(() => {
    const target = ref.current;
    if (!target || !shot) return;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(shot, 0, 0, target.width, target.height);
  }, [shot]);
  if (!shot) return null;
  return <canvas ref={ref} width={480} height={360} />;
}

export default function ReviewScreen({ frame, shots, onRetake, onRemove, onBack, onNext }) {
  const filled = shots.filter(Boolean).length;
  const allDone = filled === shots.length;

  return (
    <section className="screen screen--review">
      <header className="screen__head">
        <div>
          <h2 className="screen__title">Kiểm tra ảnh</h2>
          <p className="screen__sub">
            Chưa ưng tấm nào thì bấm <strong>Chụp lại</strong> để thay riêng tấm đó, hoặc xoá để
            chụp bù vào ô trống.
          </p>
        </div>
        <div className={`review-score${allDone ? ' is-done' : ''}`}>
          <b>{filled}</b>
          <span>/ {shots.length}</span>
        </div>
      </header>

      <div className="review-grid">
        {shots.map((shot, i) => (
          <article className={`review-card${shot ? ' is-filled' : ''}`} key={i}>
            <div className="review-card__frame">
              <span className="review-card__index">{i + 1}</span>
              {shot ? (
                <ReviewThumb shot={shot} />
              ) : (
                <div className="review-card__empty">
                  <span>Chưa có ảnh</span>
                  <button type="button" className="btn btn--sm" onClick={() => onRetake(i)}>
                    Chụp ô này
                  </button>
                </div>
              )}
            </div>
            <div className="review-card__bar">
              <button
                type="button"
                className="review-card__action"
                onClick={() => onRetake(i)}
                disabled={!shot}
              >
                Chụp lại
              </button>
              <button
                type="button"
                className="review-card__action review-card__action--danger"
                onClick={() => onRemove(i)}
                disabled={!shot}
              >
                Xoá
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="review-meta">
        Khung <strong>{frame.name}</strong> · {frame.cuts} ảnh ·{' '}
        {frame.sheet === 'strip' ? 'in dải 2×6' : 'in tờ 4×6'}
      </p>

      <div className="screen__actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Quay lại chụp
        </button>
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={filled === 0}>
          Trang trí &amp; in
        </button>
      </div>
    </section>
  );
}
