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

export default function ReviewScreen({ shots, onRetake, onRemove, onBack, onNext }) {
  const filled = shots.filter(Boolean).length;

  return (
    <section className="screen">
      <h2 className="screen__title">Kiểm tra ảnh</h2>
      <p className="screen__sub">Chạm “Chụp lại” ở ảnh nào bạn chưa ưng để thay tấm đó.</p>
      <div className="review-grid">
        {shots.map((shot, i) => (
          <div className="review-item" key={i}>
            {shot ? (
              <ReviewThumb shot={shot} />
            ) : (
              <div className="review-item__empty">Chưa chụp</div>
            )}
            <div className="review-item__actions">
              <button type="button" onClick={() => onRetake(i)} hidden={!shot}>
                Chụp lại
              </button>
              <button type="button" onClick={() => onRemove(i)} disabled={!shot}>
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="screen__actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Chụp lại tất cả
        </button>
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={filled === 0}>
          Trang trí &amp; in
        </button>
      </div>
    </section>
  );
}
