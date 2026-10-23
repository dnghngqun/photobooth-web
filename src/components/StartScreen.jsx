export default function StartScreen({ onStart }) {
  return (
    <section className="screen">
      <div className="hero">
        <p className="hero__badge">4-cut · 6-cut · 8-cut</p>
        <h1 className="hero__title">
          Chụp ảnh lấy liền
          <br />
          <span>ngay trên máy của bạn</span>
        </h1>
        <p className="hero__lead">
          Chọn khung, chụp tối đa 8 tấm, xem lại và chụp lại riêng từng tấm, gắn sticker vào đúng vị trí,
          rồi in ra tờ 4&times;6 inch.
        </p>
        <div className="hero__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={onStart}>
            Bắt đầu chụp
          </button>
        </div>
        <ul className="feature-list">
          <li>
            <strong>Camera</strong>
            <span>Dùng webcam ở máy tính hoặc camera trước/sau của điện thoại</span>
          </li>
          <li>
            <strong>Chọn &amp; chụp lại</strong>
            <span>Mỗi tấm đều xem lại được trước khi in</span>
          </li>
          <li>
            <strong>Sticker</strong>
            <span>Kéo thả vào vị trí tuỳ ý, xoay và đổi kích thước</span>
          </li>
          <li>
            <strong>In 4&times;6</strong>
            <span>Xuất PNG 300&nbsp;DPI và in đúng khổ giấy</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
