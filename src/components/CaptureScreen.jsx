import { useCallback, useEffect, useRef, useState } from 'react';
import { grabFrame, loadImageToCanvas } from '../lib/camera.js';
import { beep, shutterClick } from '../lib/audio.js';
import { useCamera } from '../hooks/useCamera.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Thời gian chờ trước khi máy tự chụp — giống photobooth máy thật. */
const AUTO_SECONDS = 10;

/** Chu vi vòng tròn SVG (r = 19) dùng cho vòng tiến trình đếm ngược. */
const RING_C = 2 * Math.PI * 19;

/** Vẽ ảnh đã chụp (canvas) vào một canvas nhỏ để hiển thị. */
function SlotThumb({ shot }) {
  const ref = useRef(null);
  useEffect(() => {
    const target = ref.current;
    if (!target || !shot) return;
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(shot, 0, 0, target.width, target.height);
  }, [shot]);
  if (!shot) return null;
  return <canvas ref={ref} width={160} height={120} />;
}

export default function CaptureScreen({
  frame,
  shots,
  activeSlot,
  source,
  onSourceChange,
  onSlotSelect,
  onShotTaken,
  onAllDone,
  notify,
}) {
  const {
    videoRef,
    facing,
    ready,
    error,
    errorReason,
    errorCode,
    errorDiag,
    canFlip,
    start,
    stop,
    retry,
    flip,
  } = useCamera();
  const [countdown, setCountdown] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [stillUrl, setStillUrl] = useState('');
  const [hint, setHint] = useState('');
  const [autoOn, setAutoOn] = useState(true);
  const [autoLeft, setAutoLeft] = useState(AUTO_SECONDS);
  const [flashKey, setFlashKey] = useState(0);
  const fileInputRef = useRef(null);
  const captureInputRef = useRef(null);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const deadlineRef = useRef(0);
  const prevLeftRef = useRef(null);
  const autoFireRef = useRef(null);
  const flashTimerRef = useRef(null);

  const isCam = source === 'camera';
  const filled = shots.filter(Boolean).length;

  // Mở/đóng camera theo nguồn ảnh và vòng đời của màn hình.
  useEffect(() => {
    if (source === 'camera') {
      setHint(`Chạm nút tròn để chụp · hoặc để máy tự chụp sau ${AUTO_SECONDS} giây.`);
      start(facing);
    } else {
      stop();
      setHint('Chọn ảnh từ thư viện (nút +) hoặc chạm vào khung này để mở camera của máy.');
    }
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nhả camera khi rời màn hình, nhưng trễ một nhịp: React StrictMode mount →
  // cleanup → mount ngay lập tức, và nếu nhả luôn thì vừa xin camera xong đã
  // phải xin lại (tốn thiết bị, dễ đụng "Could not start video source").
  const releaseTimerRef = useRef(null);
  useEffect(() => {
    clearTimeout(releaseTimerRef.current);
    return () => {
      releaseTimerRef.current = setTimeout(() => stop(), 250);
    };
  }, [stop]);

  // Nhả thiết bị khi tab bị ẩn (người dùng đổi sang app khác) và mở lại khi
  // quay về. Nhờ vậy camera luôn rảnh cho các ứng dụng/tab khác, và chính app
  // này cũng không còn giữ thiết bị khi nằm ở nền.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      if (source === 'camera') start(facing);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [facing, source, start, stop]);

  // Báo lỗi camera (không dừng được) bằng toast.
  useEffect(() => {
    if (error) {
      notify(error);
      setHint(error);
    }
  }, [error, notify]);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      try {
        const canvas = await loadImageToCanvas(file);
        if (source === 'upload') setStillUrl(canvas.toDataURL('image/png'));
        onShotTaken(activeSlot, canvas);
      } catch {
        notify('Không đọc được ảnh này.');
      }
    },
    [activeSlot, notify, onShotTaken, source]
  );

  /** Chụp một khung hình hiện tại của camera và đưa vào ô đang chọn. */
  const takeShot = useCallback(async () => {
    const video = videoRef.current;
    if (!ready || !video) {
      notify('Camera chưa sẵn sàng. Thử chế độ “Tải ảnh lên”.');
      return false;
    }
    if (!video.videoWidth) {
      notify('Camera chưa sẵn sàng, vui lòng đợi thêm một chút.');
      return false;
    }
    try {
      const shot = grabFrame(video, { mirror: facing !== 'environment' });
      onShotTaken(activeSlot, shot);
      return true;
    } catch (err) {
      notify(err.message || 'Không chụp được ảnh.');
      return false;
    }
  }, [activeSlot, facing, notify, onShotTaken, ready, videoRef]);

  /** Vùng sáng trắng ngắn khi shutter nhấn — cảm giác "cơ" của máy ảnh. */
  const flash = useCallback(() => {
    setFlashKey((k) => k + 1);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashKey(0), 420);
  }, []);

  /** Chụp thủ công: đếm 3-2-1 rồi chụp. */
  const runShutter = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    for (let n = 3; n >= 1; n -= 1) {
      setCountdown(n);
      beep(720, 0.07);
      await wait(700);
    }
    setCountdown(null);
    await takeShot();
    shutterClick();
    flash();
    setCapturing(false);
  }, [capturing, flash, takeShot]);

  /** Tự chụp: đã đếm tới 0 nên chụp luôn, không đếm 3-2-1 lần nữa. */
  const autoFire = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setCountdown(null);
    await takeShot();
    shutterClick();
    flash();
    setCapturing(false);
  }, [capturing, flash, takeShot]);

  useEffect(() => {
    autoFireRef.current = autoFire;
  }, [autoFire]);

  // Đếm ngược tự chụp. Mỗi lần chụp xong (hoặc đổi ô) timer được đặt lại 30s.
  useEffect(() => {
    if (!autoOn || !isCam || !ready || capturing) return undefined;

    deadlineRef.current = Date.now() + AUTO_SECONDS * 1000;
    prevLeftRef.current = AUTO_SECONDS;
    setAutoLeft(AUTO_SECONDS);

    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setAutoLeft(left);
      if (left !== prevLeftRef.current) {
        // Beep ở 3 giây cuối, giống máy thật.
        if (left > 0 && left <= 3) beep(720, 0.07);
        prevLeftRef.current = left;
      }
      if (left === 0) {
        clearInterval(id);
        autoFireRef.current?.();
      }
    }, 200);

    return () => clearInterval(id);
  }, [activeSlot, autoOn, capturing, isCam, ready]);

  const handleFlip = useCallback(async () => {
    const next = await flip();
    if (!next) {
      notify('Thiết bị chỉ có một camera.');
      return;
    }
    notify(next === 'environment' ? 'Đã chuyển sang camera sau' : 'Đã chuyển sang camera trước');
  }, [flip, notify]);

  // Báo lỗi của chính <video> (mã MediaError) thay vì im lặng.
  const handleVideoError = useCallback(() => {
    const err = videoRef.current?.error;
    const detail = err ? ` (mã ${err.code})` : '';
    notify(`Không phát được hình từ camera${detail}. Thử chế độ “Tải ảnh lên”.`);
  }, [notify]);

  const autoActive = autoOn && isCam && ready && !capturing;
  const imminent = autoActive && autoLeft > 0 && autoLeft <= 3;
  // Số lớn ở giữa khung: ưu tiên đếm 3-2-1 thủ công, nếu không thì 3 giây cuối của timer tự chụp.
  const bigNumber = countdown !== null ? countdown : imminent ? autoLeft : null;

  return (
    <section className="screen screen--capture">
      <div className="capture">
        <div
          className="capture__stage"
          onClick={() => {
            if (source === 'upload') captureInputRef.current?.click();
          }}
        >
          <video
            ref={videoRef}
            className={`capture__video${facing !== 'environment' ? ' is-mirrored' : ''}`}
            playsInline
            muted
            autoPlay
            onError={handleVideoError}
            hidden={!isCam}
          />
          <img className="capture__still" src={stillUrl} alt="" hidden={!stillUrl || isCam} />

          {autoActive && (
            <div
              className={`capture__timer${imminent ? ' is-imminent' : ''}`}
              role="timer"
              aria-label={`Tự chụp sau ${autoLeft} giây`}
            >
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className="capture__timer-track" cx="22" cy="22" r="19" />
                <circle
                  className="capture__timer-bar"
                  cx="22"
                  cy="22"
                  r="19"
                  style={{
                    strokeDasharray: RING_C,
                    strokeDashoffset: RING_C * (1 - autoLeft / AUTO_SECONDS),
                  }}
                />
              </svg>
              <span className="capture__timer-num">{autoLeft}</span>
            </div>
          )}

          {bigNumber !== null && (
            <div className={`capture__countdown${imminent ? ' is-pulse' : ''}`}>{bigNumber}</div>
          )}

          {flashKey > 0 && <div key={flashKey} className="capture__flash" />}

          <p className="capture__hint">{hint}</p>
        </div>

        {error && (
          <div className="capture__error" role="alert">
            <span className="capture__error-text">
              {error}
              {(errorCode || errorReason) && (
                <code className="capture__error-reason">
                  {[errorCode, errorReason].filter(Boolean).join(' · ')}
                </code>
              )}
              {errorDiag && (
                <code className="capture__error-reason">
                  {[
                    typeof errorDiag.cameras === 'number'
                      ? `thiết bị: ${errorDiag.cameras}`
                      : null,
                    `quyền: ${errorDiag.permission}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </code>
              )}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setHint('Đang thử lại camera…');
                retry(facing);
              }}
            >
              Thử lại
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => onSourceChange('upload')}
            >
              Dùng ảnh từ thiết bị
            </button>
          </div>
        )}

        <div className="capture__source" role="group" aria-label="Nguồn ảnh">
          <button
            type="button"
            className={`chip${isCam ? ' is-active' : ''}`}
            onClick={() => onSourceChange('camera')}
            aria-pressed={isCam}
          >
            Camera
          </button>
          <button
            type="button"
            className={`chip${!isCam ? ' is-active' : ''}`}
            onClick={() => onSourceChange('upload')}
            aria-pressed={!isCam}
          >
            Tải ảnh lên
          </button>
        </div>

        <div className="capture__auto">
          <button
            type="button"
            className={`chip${autoOn ? ' is-active' : ''}`}
            onClick={() => setAutoOn((v) => !v)}
            aria-pressed={autoOn}
          >
            Tự chụp sau {AUTO_SECONDS}s
          </button>
          {autoActive && <span className="capture__auto-note">Máy sẽ tự chụp · còn {autoLeft}s</span>}
        </div>

        <div className="capture__slots" role="group" aria-label="Các ô ảnh">
          {shots.map((shot, i) => (
            <button
              key={i}
              type="button"
              className={`slot${shot ? ' is-filled' : ''}${i === activeSlot ? ' is-active' : ''}`}
              onClick={() => onSlotSelect(i)}
              aria-label={`Ảnh ${i + 1}`}
              aria-pressed={i === activeSlot}
            >
              <SlotThumb shot={shot} />
              {!shot && <span className="slot__num">{i + 1}</span>}
            </button>
          ))}
        </div>

        <div className="capture__bar">
          <button
            type="button"
            className="icon-btn"
            onClick={handleFlip}
            aria-label="Đổi camera trước/sau"
            hidden={!isCam || !canFlip}
          >
            &#8635;
          </button>
          <button
            type="button"
            className="shutter"
            data-shutter
            onClick={runShutter}
            aria-label="Chụp"
            disabled={!isCam || capturing}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Chọn ảnh từ thiết bị"
            hidden={isCam}
          >
            &#65291;
          </button>
        </div>

        <p className="capture__counter">
          Đã chụp {filled}/{shots.length} ảnh
          {filled === shots.length && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onAllDone}>
              Xem lại &amp; in
            </button>
          )}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handleFile(e.target.files && e.target.files[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            handleFile(e.target.files && e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}
