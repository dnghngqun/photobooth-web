import { useCallback, useRef, useState } from 'react';
import { cameraSession, CameraError } from '../lib/camera.js';

/**
 * Thời gian tối đa chờ camera. Một số thiết bị (hoặc khi người dùng bỏ qua
 * hộp thoại cấp quyền) sẽ để getUserMedia treo mãi — sau mốc này ta báo lỗi
 * để giao diện không bị kẹt ở trạng thái "đang khởi tạo".
 */
const START_TIMEOUT = 12000;

/** Từ chối promise sau `ms` nếu nó chưa settle. */
function withTimeout(promise, ms, error) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(error), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Chờ <video> có khung hình thật (videoWidth > 0).
 * Một số trình duyệt báo "sẵn sàng" trước khi stream thực sự chạy.
 */
function waitForVideoFrame(video, ms) {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('canplay', onMeta);
      video.removeEventListener('resize', onMeta);
      resolve(ok);
    };
    const onMeta = () => {
      if (video.videoWidth > 0) finish(true);
    };
    const timer = setTimeout(() => finish(video.videoWidth > 0), ms);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('canplay', onMeta);
    video.addEventListener('resize', onMeta);
  });
}

/**
 * Bọc phiên camera dùng chung của trang thành hook.
 *
 * Mọi màn hình dùng chung `cameraSession`, nên:
 *   - không bao giờ có hai request getUserMedia chồng nhau (nguyên nhân của
 *     lỗi "Could not start video source"),
 *   - chờ thiết bị rảnh sau khi nhả trước khi xin lại (driver cần vài trăm ms),
 *   - khoá chéo-tab bằng Web Locks nên biết chính xác tab nào đang giữ camera,
 *   - rời màn hình hoặc ẩn tab thì thiết bị được nhả lại cho ứng dụng khác.
 */
export function useCamera() {
  const videoRef = useRef(null);
  const tokenRef = useRef(0);

  const [facing, setFacing] = useState('user');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [errorReason, setErrorReason] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [errorDiag, setErrorDiag] = useState(null);
  const [canFlip, setCanFlip] = useState(false);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    cameraSession.release();
    setReady(false);
    setCanFlip(false);
  }, []);

  /** Gắn luồng vào <video> và bật trạng thái "sẵn sàng chụp". */
  const attachAndReady = useCallback(async (token, wantFacing) => {
    const video = videoRef.current;
    if (!video || token !== tokenRef.current) return false;

    setFacing(cameraSession.facing);
    setCanFlip(cameraSession.canFlip);
    // Sau khi có quyền, danh sách thiết bị mới đầy đủ → cập nhật lại nút đổi camera.
    cameraSession.videoInputs().then(() => {
      if (token !== tokenRef.current) return;
      setCanFlip(cameraSession.canFlip);
    });
    cameraSession.attach(video);

    const hasFrame = await waitForVideoFrame(video, 6000);
    if (token !== tokenRef.current) return false;
    setReady(hasFrame);
    if (!hasFrame) {
      setError('Camera chưa sẵn sàng. Bạn vẫn có thể dùng chế độ “Tải ảnh lên”.');
      setErrorCode('notready');
    } else {
      setError(null);
      setErrorReason(null);
      setErrorCode(null);
      setErrorDiag(null);
    }
    return hasFrame;
  }, []);

  /**
   * Mở camera. Nếu người dùng chậm bấm "Cho phép", ta KHÔNG huỷ request —
   * camera sẽ tự mở ngay khi quyền được cấp.
   */
  const start = useCallback(
    async (wantFacing = 'user') => {
      const video = videoRef.current;
      if (!video) return false;

      const token = ++tokenRef.current;
      setError(null);
      setErrorReason(null);
      setErrorCode(null);
      setErrorDiag(null);

      try {
        await withTimeout(
          cameraSession.acquire(wantFacing),
          START_TIMEOUT,
          new CameraError('timeout', 'Camera không phản hồi.')
        );
      } catch (err) {
        if (token !== tokenRef.current) return false;
        if (err instanceof CameraError && err.code === 'cancelled') return false;

        if (err instanceof CameraError && err.code === 'timeout') {
          // Request vẫn còn bay (đang chờ quyền) — để nguyên, và khi nó mở
          // được thì tự gắn vào <video>.
          setReady(false);
          setError(
            'Camera chưa mở được sau 12 giây. Nếu trình duyệt đang hiện thông báo xin quyền camera, ' +
              'hãy bấm “Cho phép” — máy sẽ tự chụp ngay. Nếu không, bấm “Thử lại”.'
          );
          setErrorCode('timeout');
          cameraSession
            .whenReady()
            .then(() => {
              if (token !== tokenRef.current) return;
              attachAndReady(token, wantFacing);
            })
            .catch(() => {});
          return false;
        }

        cameraSession.release();
        setReady(false);
        setCanFlip(false);
        setError(err instanceof CameraError ? err.message : err?.message || 'Không mở được camera.');
        setErrorReason(err instanceof CameraError ? err.reason : err?.name || null);
        setErrorCode(err instanceof CameraError ? err.code : 'failed');
        setErrorDiag(err instanceof CameraError ? err.diag : null);
        return false;
      }

      if (token !== tokenRef.current) return false;
      return attachAndReady(token, wantFacing);
    },
    [attachAndReady]
  );

  /**
   * Thử lại sau khi camera lỗi. Nếu còn một request đang bay (đang chờ cấp
   * quyền) thì dùng lại chính request đó — không mở thiết bị lần nữa.
   */
  const retry = useCallback(
    async (wantFacing = 'user') => {
      const video = videoRef.current;
      if (!video) return false;

      const token = ++tokenRef.current;
      setError(null);
      setErrorReason(null);
      setErrorCode(null);
      setErrorDiag(null);

      try {
        await withTimeout(
          cameraSession.retry(wantFacing),
          START_TIMEOUT,
          new CameraError('timeout', 'Camera không phản hồi.')
        );
      } catch (err) {
        if (token !== tokenRef.current) return false;
        if (err instanceof CameraError && err.code === 'cancelled') return false;

        if (err instanceof CameraError && err.code === 'timeout') {
          setReady(false);
          setError('Camera vẫn chưa phản hồi. Bấm “Thử lại” sau vài giây nữa.');
          setErrorCode('timeout');
          cameraSession
            .whenReady()
            .then(() => {
              if (token !== tokenRef.current) return;
              attachAndReady(token, wantFacing);
            })
            .catch(() => {});
          return false;
        }

        cameraSession.release();
        setReady(false);
        setCanFlip(false);
        setError(err instanceof CameraError ? err.message : err?.message || 'Không mở được camera.');
        setErrorReason(err instanceof CameraError ? err.reason : err?.name || null);
        setErrorCode(err instanceof CameraError ? err.code : 'failed');
        setErrorDiag(err instanceof CameraError ? err.diag : null);
        return false;
      }

      if (token !== tokenRef.current) return false;
      return attachAndReady(token, wantFacing);
    },
    [attachAndReady]
  );

  /** Đổi giữa camera trước/sau. Trả về facing mới hoặc null nếu không đổi được. */
  const flip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return null;
    try {
      const next = await cameraSession.flip(video);
      if (!next) return null;
      setFacing(next);
      setCanFlip(cameraSession.canFlip);
      return next;
    } catch {
      return null;
    }
  }, []);

  return {
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
  };
}
