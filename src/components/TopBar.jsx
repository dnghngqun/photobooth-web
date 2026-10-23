export default function TopBar({ stepLabel, canGoBack, onBack }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__back"
        onClick={onBack}
        aria-label="Quay lại"
        hidden={!canGoBack}
      >
        &lsaquo;
      </button>
      <div className="topbar__brand">
        <span className="topbar__dot" aria-hidden="true" />
        <span>Photobooth</span>
      </div>
      <div className="topbar__step">{stepLabel}</div>
    </header>
  );
}
