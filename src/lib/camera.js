/**
 * Bọc Web API camera: getUserMedia, đổi camera trước/sau, chụp ảnh từ video.
 *
 * Hoạt động trên desktop (webcam) và mobile (camera trước/sau) với điều kiện
 * trang chạy trong secure context (https:// hoặc http://localhost).
 *
 * Bốn nguyên tắc rút ra từ lỗi thật "Could not start video source":
 *
 * 1. MỘT thiết bị chỉ nhận được MỘT luồng. Vì vậy mọi lần gọi
 *    getUserMedia đều đi qua hàng đợi, và nếu đang có một request bay
 *    thì ta DÙNG LẠI chính request đó chứ không xin thêm.
 *
 * 2. Ngay sau khi track.stop(), driver còn giữ thiết bị vài trăm ms. Xin lại
 *    quá sớm thì gặp đúng lỗi "Could not start video source" dù không có ai
 *    dùng camera. Vì vậy luôn chờ đủ lâu sau khi nhả (RELEASE_COOLDOWN_MS).
 *
 * 3. getUserMedia không huỷ được. Nếu ta bỏ cuộc nhưng request vẫn vỡn ra
 *    sau đó, luồng đó sẽ âm thầm giữ thiết bị và làm lần mở sau thất bại.
 *    Vì vậy request bị bỏ luôn được đánh dấu "abandoned" và luồng vỡn ra
 *    sau đó bị tắt ngay.
 *
 * 4. NotReadableError ("Could not start video source") là lỗi "không khởi
 *    động được nguồn hình" — KHÔNG phải bằng chứng rằng có ứng dụng khác
 *    đang chiếm. Ta chẩn đoán bằng dữ liệu thật (enumerateDevices + trạng
 *    thái quyền) thay vì đoán rồi đổ lỗi cho ứng dụng khác.
 */

export class CameraError extends Error {
  constructor(code, message, reason, diag) {
    super(message);
    this.name = 'CameraError';
    this.code = code; // 'unsupported' | 'denied' | 'notfound' | 'busy' | 'locked' | 'insecure' | 'cancelled' | 'timeout' | 'failed'
    this.reason = reason || null; // tên lỗi gốc của DOMException, để chẩn đoán
    this.diag = diag || null; // thông tin chẩn đoán thu thập được lúc lỗi
  }
}

const CONSTRAINTS = [
  { video: { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false },
  { video: { facingMode: { exact: 'user' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false },
  { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false },
  { video: { facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false },
  { video: true, audio: false },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tắt mọi track của một luồng, nuốt lỗi. */
function stopStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* bỏ qua */
  }
}

/**
 * Tên khoá dùng chung giữa các tab cùng origin. Web Locks API cho phép
 * chỉ một tab giữ camera → biết chính xác "tab khác của app này" đang
 * chiếm thiết bị, thay vì đoán.
 */
const LOCK_NAME = 'photobooth-web:camera';

/** Thời gian chờ thiết bị "rảnh" sau khi nhả camera. */
const RELEASE_COOLDOWN_MS = 450;

/** Các mốc chờ giữa những lần thử lại khi thiết bị chưa sẵn sàng. */
const RETRY_DELAYS = [500, 1200];

/**
 * Hàng đợi thiết bị: các lần gọi getUserMedia được xếp hàng và luôn giải
 * phóng luồng đang mở trước khi xin luồng mới, để thiết bị thật sự rảnh.
 */
let deviceQueue = Promise.resolve();

/**
 * Promise của getUserMedia đang bay. Giữ tham chiếu này để bảo đảm không
 * bao giờ có hai request cùng lúc — kể cả khi request cũ đang chờ người
 * dùng cấp quyền (chưa settle) và ta thử mở lại.
 */
let activeGum = null;

function withDevice(fn) {
  const task = deviceQueue.then(async () => {
    // Chờ request đang bay hoàn tất trước khi mở thiết bị lần nữa.
    if (activeGum) {
      try {
        await activeGum;
      } catch {
        /* bỏ qua */
      }
    }
    let promise;
    try {
      promise = Promise.resolve(fn());
    } catch (err) {
      throw err;
    }
    activeGum = promise;
    promise.then(
      () => {
        if (activeGum === promise) activeGum = null;
      },
      () => {
        if (activeGum === promise) activeGum = null;
      }
    );
    return promise;
  });
  deviceQueue = task.then(
    () => {},
    () => {}
  );
  return task;
}

/**
 * Thu thập thông tin chẩn đoán camera tại thời điểm lỗi xảy ra.
 * - cameras: số camera mà trình duyệt nhận diện được (null = không lấy được)
 * - permission: 'granted' | 'denied' | 'prompt' | 'unknown'
 */
export async function collectDiagnostics() {
  const diag = { cameras: null, permission: 'unknown', secure: Boolean(window.isSecureContext) };
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      diag.cameras = devices.filter((d) => d.kind === 'videoinput').length;
    }
  } catch {
    /* bỏ qua */
  }
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'camera' });
      diag.permission = status.state;
    }
  } catch {
    /* bỏ qua */
  }
  return diag;
}

/** Diễn giải lỗi dựa trên dữ liệu chẩn đoán thật, không suy đoán. */
function describeFailure(code, reason, diag) {
  const cams = diag && typeof diag.cameras === 'number' ? diag.cameras : null;
  const perm = diag ? diag.permission : 'unknown';
  switch (code) {
    case 'busy':
      if (cams === 0) {
        return (
          'Trình duyệt không mở được nguồn hình (NotReadableError) và hiện không nhận diện được camera nào. ' +
          'Nếu camera đang cắm, hãy kiểm tra quyền Camera trong cài đặt quyền riêng tư của hệ điều hành ' +
          '(Windows: Settings → Privacy & security → Camera) rồi thử lại.'
        );
      }
      return (
        `Camera đã được nhận diện (${cams} thiết bị) nhưng không khởi động được (NotReadableError). ` +
        'Nguyên nhân thường gặp: camera vừa được trả về nên chưa sẵn sàng (chờ vài giây rồi bấm “Thử lại”), ' +
        'hoặc camera đang bị một tab/cửa sổ khác của chính app này giữ. ' +
        'Nếu bạn mở app ở nhiều tab hoặc cửa sổ, hãy đóng bớt rồi thử lại.'
      );
    case 'locked':
      return (
        'Một tab hoặc cửa sổ khác của app này đang giữ camera. ' +
        'Hãy đóng tab đó (hoặc chuyển tab đó sang chế độ “Tải ảnh lên”) rồi bấm “Thử lại”.'
      );
    case 'denied':
      return 'Quyền dùng camera đã bị từ chối. Bấm biểu tượng camera ở thanh địa chỉ để cho phép, rồi bấm “Thử lại”.';
    case 'notfound':
      return 'Không tìm thấy camera nào trên thiết bị này. Hãy kiểm tra camera đã cắm và đã bật trong hệ điều hành.';
    case 'overconstrained':
      return 'Camera không hỗ trợ chế độ hình ảnh mà thiết bị này yêu cầu (OverconstrainedError).';
    case 'timeout':
      return (
        perm === 'prompt'
          ? 'Camera chưa được cấp quyền. Nếu trình duyệt đang hiện thông báo xin quyền, hãy bấm “Cho phép” — camera sẽ tự mở.'
          : 'Camera không phản hồi trong 12 giây.'
      );
    default:
      return `Không mở được camera (${reason || 'lỗi không xác định'}).`;
  }
}

/**
 * Phiên camera dùng chung cho cả trang.
 *
 * `acquire()` luôn trả về luồng đang sống nếu có; nếu đang có một request
 * đang bay thì chờ chính request đó — không bao giờ xin hai luồng cùng lúc.
 */
export class CameraSession {
  constructor() {
    this.stream = null;
    // Request đang bay: { ctx, promise }. ctx.abandoned = true nghĩa là
    // request này bị bỏ — luồng nếu vỡn ra sau đó sẽ bị tắt ngay.
    this.request = null;
    this.facing = 'user';
    this.video = null;
    // Mốc thời gian vừa nhả camera — dùng để chờ thiết bị "rảnh" trước khi xin lại.
    this._releasedAt = 0;
    // Nhả khoá chéo-tab (Web Locks).
    this._lockRelease = null;
    this._lockPending = false;
  }

  get active() {
    return Boolean(this.stream);
  }

  /** Track camera hiện tại (null nếu chưa mở). */
  get track() {
    return this.stream ? this.stream.getVideoTracks()[0] : null;
  }

  /** Luồng còn sống hay không. */
  get alive() {
    const track = this.track;
    return Boolean(track && track.readyState === 'live');
  }

  /** Danh sách camera trước/sau mà thiết bị hỗ trợ. */
  get facingModes() {
    const track = this.track;
    if (!track || !track.getCapabilities) return [];
    const caps = track.getCapabilities();
    return caps.facingMode || [];
  }

  /**
   * Xin (hoặc dùng lại) luồng camera cho hướng `facing`.
   * @param {'user'|'environment'} facing
   * @param {{force?:boolean}} opts force = true thì không dùng lại luồng đang có.
   */
  async acquire(facing = 'user', { force = false } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new CameraError('unsupported', 'Trình duyệt không hỗ trợ truy cập camera.');
    }
    if (!window.isSecureContext) {
      throw new CameraError('insecure', 'Trang phải chạy trên https:// hoặc http://localhost mới dùng được camera.');
    }

    // Đang có luồng sống → dùng luôn (trừ khi cần đổi hướng camera).
    if (!force && this.alive) {
      this.facing = facing;
      return this.stream;
    }

    // Đang có request bay → dùng chung chính request đó, tuyệt đối không xin thêm.
    // (Request đã bị bỏ thì không dùng lại: ta sẽ tạo request mới, hàng đợi
    //  bên trong bảo đảm thiết bị không bị mở hai lần cùng lúc.)
    if (this.request && !force && !this.request.ctx.abandoned) {
      const { promise } = this.request;
      const stream = await promise;
      this.facing = facing;
      return stream;
    }

    // Cần một luồng khác (đổi camera): nhả luồng cũ + bỏ request cũ.
    if (force) {
      this._dropLiveStream();
      if (this.request) this.request.ctx.abandoned = true;
    }

    const ctx = { abandoned: false };
    const promise = this._open(facing, ctx).then((stream) => {
      if (ctx.abandoned) {
        stopStream(stream);
        throw new CameraError('cancelled', 'Yêu cầu camera đã bị bỏ.');
      }
      this.stream = stream;
      return stream;
    });
    this.request = { ctx, promise };

    // Không để promise bị báo "unhandled rejection" nếu không ai chờ nữa.
    promise.catch(() => {});

    try {
      const stream = await promise;
      this.facing = facing;
      return stream;
    } finally {
      if (this.request && this.request.promise === promise) this.request = null;
    }
  }

  /**
   * Thử lại sau khi có lỗi.
   *
   * Nếu đang có một request bay (ví dụ đang chờ người dùng bấm "Cho phép")
   * thì DÙNG LẠI request đó — không mở camera lần nữa, tránh đụng thiết bị.
   */
  async retry(facing = 'user') {
    if (this.request && !this.request.ctx.abandoned) {
      return this.acquire(facing);
    }
    this.release();
    return this.acquire(facing);
  }

  /**
   * Đợi request đang bay hoàn tất. Dùng khi giao diện đã hết thời gian chờ
   * nhưng request vẫn còn sống (đang chờ người dùng cấp quyền).
   */
  whenReady() {
    if (this.request) return this.request.promise;
    if (this.stream) return Promise.resolve(this.stream);
    return Promise.reject(new CameraError('failed', 'Không có yêu cầu camera nào đang chờ.'));
  }

  /** Chờ thiết bị rảnh sau lần nhả gần nhất (driver cần vài trăm ms). */
  async _coolDown() {
    const since = Date.now() - this._releasedAt;
    if (since < RELEASE_COOLDOWN_MS) {
      await wait(RELEASE_COOLDOWN_MS - since);
    }
  }

  /**
   * Mở luồng camera, có khoá chéo-tab nếu trình duyệt hỗ trợ Web Locks.
   * Luôn trả về một promise; khoá được giữ tới khi release() được gọi.
   */
  async _open(facing, ctx) {
    this._lockPending = false;
    await this._coolDown();

    const locks = navigator.locks;
    if (!locks || typeof locks.request !== 'function') {
      return this._openWithRetry(facing, ctx);
    }

    // Khoá có thể vừa được nhả (ví dụ khi đổi camera) → thử lại vài lần
    // trước khi kết luận rằng tab khác đang giữ camera.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await this._openWithLock(locks, facing, ctx);
      if (result.acquired) {
        if (result.error) throw result.error;
        return result.stream;
      }
      await wait(150 * (attempt + 1));
    }
    throw new CameraError('locked', describeFailure('locked', null, null));
  }

  /** Một lần thử giành khoá chéo-tab rồi mở camera. */
  _openWithLock(locks, facing, ctx) {
    return new Promise((resolve) => {
      let readyResolve;
      let readyReject;
      const ready = new Promise((res, rej) => {
        readyResolve = res;
        readyReject = rej;
      });

      const holding = locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          // Khoá đang bị giữ bởi tab/cửa sổ khác của cùng app này.
          resolve({ acquired: false });
          return;
        }
        try {
          const stream = await this._openWithRetry(facing, ctx);
          readyResolve(stream);
          // Giữ khoá tới khi camera được nhả.
          await new Promise((r) => {
            this._lockRelease = r;
            if (this._lockPending) {
              this._lockPending = false;
              this._lockRelease = null;
              r();
            }
          });
        } catch (err) {
          readyReject(err);
        }
      });
      holding.catch(() => {});

      ready.then(
        (stream) => resolve({ acquired: true, stream }),
        (error) => resolve({ acquired: true, error })
      );
    });
  }

  /** Mở luồng, thử lại nếu thiết bị chưa sẵn sàng. */
  async _openWithRetry(facing, ctx) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
      if (ctx.abandoned) {
        throw new CameraError('cancelled', 'Yêu cầu camera đã bị bỏ.');
      }
      try {
        return await this._request(facing, ctx);
      } catch (err) {
        if (err instanceof CameraError && err.code === 'busy' && attempt < RETRY_DELAYS.length) {
          await wait(RETRY_DELAYS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new CameraError('failed', 'Không mở được camera.');
  }

  /** Một lần xin luồng, thử lần lượt các ràng buộc. */
  async _request(facing, ctx) {
    let lastError = null;
    for (const constraints of CONSTRAINTS) {
      if (ctx.abandoned) {
        throw new CameraError('cancelled', 'Yêu cầu camera đã bị bỏ.');
      }
      try {
        const raw = withDevice(() => navigator.mediaDevices.getUserMedia(constraints));

        // Nếu ta đã bỏ cuộc mà getUserMedia vẫn vỡn ra → tắt luồng ngay,
        // nếu không nó sẽ âm thầm giữ thiết bị và làm lần mở sau báo
        // "Could not start video source". Cũng ghi nhận mốc nhả để lần mở
        // sau chờ đủ lâu cho driver giải phóng thiết bị.
        raw.then(
          (s) => {
            if (!ctx.abandoned) return;
            stopStream(s);
            this._releasedAt = Date.now();
          },
          () => {}
        );

        const stream = await raw;
        if (ctx.abandoned) {
          stopStream(stream);
          throw new CameraError('cancelled', 'Yêu cầu camera đã bị bỏ.');
        }
        const mode = constraints.video?.facingMode;
        const facingMode = typeof mode === 'object' ? mode.exact || mode.ideal : mode;
        this.facing = facingMode || facing;
        return stream;
      } catch (err) {
        lastError = err;
        if (err instanceof CameraError && err.code === 'cancelled') throw err;
        const name = err?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') break;
        // Thiết bị bận hoặc request bị huỷ — thử ràng buộc khác cũng vô ích.
        if (name === 'NotReadableError' || name === 'AbortError') break;
        // Không có camera nào — thử ràng buộc khác cũng vô ích.
        if (name === 'NotFoundError') break;
      }
    }

    const name = lastError?.name;
    const diag = await collectDiagnostics();

    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraError('denied', describeFailure('denied', name, diag), name, diag);
    }
    if (name === 'NotFoundError') {
      throw new CameraError('notfound', describeFailure('notfound', name, diag), name, diag);
    }
    if (name === 'OverconstrainedError') {
      throw new CameraError('overconstrained', describeFailure('overconstrained', name, diag), name, diag);
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      // Chrome dùng thông điệp "Could not start video source" cho trường hợp
      // này: thiết bị không khởi động được (driver vừa được giải phóng, bị
      // ứng dụng/tab khác giữ, hoặc lỗi phần cứng) — KHÔNG khẳng định là ứng
      // dụng khác đang chiếm.
      throw new CameraError('busy', describeFailure('busy', name, diag), name, diag);
    }
    throw new CameraError('failed', describeFailure('failed', lastError?.message, diag), name, diag);
  }

  /**
   * Gắn luồng vào <video> và bắt đầu phát.
   * Gán atomically (không đặt null trước) để tránh lỗi media element.
   */
  attach(video) {
    if (!video || !this.stream) return;
    this.video = video;
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;

    // Element đang ở trạng thái lỗi thì phải reset media load trước.
    if (video.error) {
      try {
        video.load();
      } catch {
        /* bỏ qua */
      }
    }

    video.srcObject = this.stream;

    // play() có thể bị từ chối lần đầu — thử lại vài lần thay vì bỏ cuộc.
    const attempt = (left) => {
      let played;
      try {
        played = video.play();
      } catch {
        return;
      }
      if (!played || typeof played.catch !== 'function') return;
      played.catch(() => {
        if (left > 0) setTimeout(() => attempt(left - 1), 140);
      });
    };
    attempt(2);
  }

  /** Gỡ luồng khỏi <video> (không đóng thiết bị). */
  detach(video, stream = this.stream) {
    if (!video) return;
    try {
      video.pause();
      if (video.srcObject === stream) video.srcObject = null;
    } catch {
      /* bỏ qua */
    }
  }

  /** Nhả luồng đang mở, trả thiết bị về (không đụng request đang bay). */
  _dropLiveStream() {
    const stream = this.stream;
    if (this.video) {
      this.detach(this.video, stream);
      this.video = null;
    }
    this.stream = null;
    if (stream) {
      stopStream(stream);
    }
    this._releasedAt = Date.now();
  }

  /**
   * Nhả camera: đóng track, thiết bị được trả về cho ứng dụng khác.
   * Request đang bay cũng bị đánh dấu bỏ — nếu nó vỡn ra sau, luồng sẽ
   * được tắt ngay nên không giữ thiết bị.
   */
  release() {
    if (this.request) this.request.ctx.abandoned = true;
    this._dropLiveStream();

    // Nhả khoá chéo-tab (nếu đang giữ).
    this._lockPending = true;
    if (this._lockRelease) {
      const release = this._lockRelease;
      this._lockRelease = null;
      release();
    }
  }

  /** Đổi giữa camera trước và sau. Trả về facing mới, hoặc null nếu không đổi được. */
  async flip(video) {
    const modes = this.facingModes;
    if (!modes.length) return null;
    const current = this.facing;
    const next = modes.find((m) => m !== current) || current;
    if (next === current) return null;

    // Nhả luồng cũ TRƯỚC khi xin luồng mới: thiết bị chỉ nhận được một luồng,
    // giữ luồng cũ sẽ khiến lần xin mới bị từ chối.
    this._dropLiveStream();
    await this.acquire(next, { force: true });
    this.attach(video);
    return this.facing;
  }
}

/** Phiên camera dùng chung cho cả trang. */
export const cameraSession = new CameraSession();

/**
 * Chụp một khung hình từ video ra canvas.
 * @param {HTMLVideoElement} video
 * @param {{mirror?:boolean, width?:number, height?:number}} opts
 * @returns {HTMLCanvasElement}
 */
export function grabFrame(video, { mirror = false, width = 1200, height = 900 } = {}) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new CameraError('failed', 'Camera chưa sẵn sàng.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  const targetRatio = width / height;
  const srcRatio = vw / vh;
  let sw, sh, sx, sy;
  if (srcRatio > targetRatio) {
    sh = vh;
    sw = sh * targetRatio;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    sw = vw;
    sh = sw / targetRatio;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas;
}

/** Nạp một file ảnh người dùng chọn, căn vừa khung 4:3. */
export function loadImageToCanvas(file, { width = 1200, height = 900 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const targetRatio = width / height;
      const srcRatio = img.width / img.height;
      let sw, sh, sx, sy;
      if (srcRatio > targetRatio) {
        sh = img.height;
        sw = sh * targetRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = sw / targetRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh.'));
    };
    img.src = url;
  });
}
