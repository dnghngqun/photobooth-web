import { useCallback, useEffect, useRef, useState } from 'react';
import { grabFrame, loadImageToCanvas } from '../lib/camera.js';
import { beep, shutterClick } from '../lib/audio.js';
import { useCamera } from '../hooks/useCamera.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  captureMode = 'auto',
  autoSeconds = 10,
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
    canSwitch,
    isTouch,
    start,
    stop,
    retry,
    switchTo,
    flip,
  } = useCamera();
  const [switching, setSwitching] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [stillUrl, setStillUrl] = useState('');
  const [hint, setHint] = useState('');
  const [autoOn, setAutoOn] = useState(true);
  const [autoLeft, setAutoLeft] = useState(autoSeconds);
  const [flashKey, setFlashKey] = useState(0);
  const fileInputRef = useRef(null);
  const captureInputRef = useRef(null);

  const deadlineRef = useRef(0);
  const prevLeftRef = useRef(null);
  const autoFireRef = useRef(null);
  const flashTimerRef = useRef(null);

  const isCam = source === 'camera';
  const filled = shots.filter(Boolean).length;
  const done = filled === shots.length;
  const doneRef = useRef(done);
  doneRef.current = done;

  // Mở/đóng camera theo nguồn ảnh và vòng đời của màn hình.
  useEffect(() => {
    if (source === 'camera') {
      if (captureMode === 'auto') {
        setHint(`Tự chụp sau ${autoSeconds}s · hoặc chạm nút tròn.`);
      } else {
        setHint('Chạm nút tròn: đếm 3-2-1 rồi chụp.');
      }
      start(facing);
    } else {
      stop();
      setHint('Chọn ảnh từ thư viện hoặc chạm vào khung này.');
    }
  }, [source, captureMode, autoSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Nhả thiết bị khi tab bị ẩn và mở lại khi quay về.
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

  // Báo lỗi camera bằng toast.
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

  /** Vùng sáng trắng ngắn khi shutter nhấn. */
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

  /** Tự chụp: đã đếm tới 0 nên chụp luôn. */
  const autoFire = useCallback(async () => {
    // Đã đủ ảnh thì dừng, tránh việc tự chụp chen vào lúc đang xem lại.
    if (capturing || doneRef.current) return;
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

  // Đếm ngược tự chụp. Mỗi lần chụp xong (hoặc đổi ô) timer đặt lại.
  useEffect(() => {
    if (captureMode !== 'auto') {
      setAutoOn(false);
      setAutoLeft(autoSeconds);
      return undefined;
    }
    if (!autoOn || !isCam || !ready || capturing || done) return undefined;

    deadlineRef.current = Date.now() + autoSeconds * 1000;
    prevLeftRef.current = autoSeconds;
    setAutoLeft(autoSeconds);

    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setAutoLeft(left);
      if (left !== prevLeftRef.current) {
        if (left > 0 && left <= 3) beep(720, 0.07);
        prevLeftRef.current = left;
      }
      if (left === 0) {
        clearInterval(id);
        autoFireRef.current?.();
      }
    }, 200);

    return () => clearInterval(id);
  }, [activeSlot, autoOn, autoSeconds, captureMode, capturing, done, isCam, ready]);

  /**
   * Chọn camera trước/sau từ danh sách. Không hiện thông báo khi thành công
   * (nút đang sáng là đủ); chỉ báo khi máy không có camera đó, và camera cũ
   * vẫn được mở lại nên không bị đen hình.
   */
  const handleFacing = useCallback(
    async (want) => {
      if (switching || want === facing) return;
      setSwitching(true);
      const next = await switchTo(want);
      setSwitching(false);
      if (!next) {
        notify(want === 'environment' ? 'Máy này không mở được camera sau.' : 'Máy này không mở được camera trước.');
      }
    },
    [facing, notify, switchTo, switching]
  );

  const handleFlip = useCallback(async () => {
    const next = await flip();
    if (!next) {
      notify('Thiết bị chỉ có một camera.');
    }
  }, [flip, notify]);

  // Báo lỗi của chính <video> (mã MediaError) thay vì im lặng.
  const handleVideoError = useCallback(() => {
    const err = videoRef.current?.error;
    const detail = err ? ` (mã ${err.code})` : '';
    notify(`Không phát được hình từ camera${detail}. Thử chế độ “Tải ảnh lên”.`);
  }, [notify]);

  const autoActive = autoOn && isCam && ready && !capturing;
  const imminent = autoActive && autoLeft > 0 && autoLeft <= 3;
  const bigNumber = countdown !== null ? countdown : imminent ? autoLeft : null;

  return (
    <section className="screen screen--capture">
      <div className="capture">
        <div className="capture__main">
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

            <div className="capture__stage-top">
              <span className="capture__badge">{frame.name}</span>
              <span className="capture__badge">
                {filled}/{shots.length}
              </span>
            </div>

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
                      strokeDashoffset: RING_C * (1 - autoLeft / autoSeconds),
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
          </div>

          <p className="capture__hint">{hint}</p>

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
                      typeof errorDiag.cameras === 'number' ? `thiết bị: ${errorDiag.cameras}` : null,
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
        </div>

        <aside className="capture__side">
          <div className="capture__panel">
            <header className="capture__panel-head">
              <h2>Chụp ảnh</h2>
              <p>
                {frame.name} · {shots.length} ảnh
              </p>
            </header>

            <div className="capture__field capture__field--source">
              <span className="capture__label">Nguồn ảnh</span>
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
            </div>

            {isCam && canSwitch && (
              <div className="capture__field capture__field--facing">
                <span className="capture__label">Camera</span>
                <div className="capture__source" role="group" aria-label="Chọn camera trước hoặc sau">
                  <button
                    type="button"
                    className={`chip${facing === 'user' ? ' is-active' : ''}`}
                    onClick={() => handleFacing('user')}
                    aria-pressed={facing === 'user'}
                    disabled={switching}
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    className={`chip${facing === 'environment' ? ' is-active' : ''}`}
                    onClick={() => handleFacing('environment')}
                    aria-pressed={facing === 'environment'}
                    disabled={switching}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}

            <div className="capture__field capture__field--mode">
              <span className="capture__label">Kiểu chụp</span>
              {captureMode === 'auto' ? (
                <button
                  type="button"
                  className={`chip chip--wide${autoOn ? ' is-active' : ''}`}
                  onClick={() => setAutoOn((v) => !v)}
                  aria-pressed={autoOn}
                >
                  {autoOn ? `Tự chụp ${autoSeconds}s · bật` : `Tự chụp ${autoSeconds}s · tắt`}
                </button>
              ) : (
                <span className="capture__note">Đếm ngược 3-2-1 khi bấm nút chụp</span>
              )}
            </div>

            <div className="capture__field capture__field--slots">
              <span className="capture__label">
                Ảnh đã chụp <b>{filled}/{shots.length}</b>
              </span>
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
            </div>

            <div className="capture__controls">
              <button
                type="button"
                className="icon-btn"
                onClick={handleFlip}
                aria-label="Đổi camera trước/sau"
                hidden={!isCam || !canFlip || isTouch}
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
              >
                <span className="shutter__ring" aria-hidden="true" />
              </button>

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

            <div className="capture__progress" aria-hidden="true">
              {shots.map((shot, i) => (
                <span key={i} className={`capture__pip${shot ? ' is-filled' : ''}`} />
              ))}
            </div>

            <button
              type="button"
              className="btn btn--primary capture__done"
              onClick={onAllDone}
              disabled={!done}
            >
              {done ? 'Xem lại & in' : `Còn ${shots.length - filled} ảnh`}
            </button>

            <p className="capture__note capture__note--center">
              Mẹo: nhấn <kbd>Enter</kbd> hoặc <kbd>Space</kbd> để chụp nhanh.
            </p>
          </div>
        </aside>

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
