/**
 * Test cho phiên camera (src/lib/camera.js).
 *
 * Chạy: node --test src/lib/camera.test.js
 *
 * Các test này mô phỏng lại đúng hành vi của Chrome thật:
 *   - một thiết bị chỉ nhận được MỘT luồng,
 *   - NotReadableError có message "Could not start video source",
 *   - getUserMedia treo khi người dùng chưa bấm "Cho phép".
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CameraSession, CameraError } from './camera.js';

/** Tạo một MediaStream giả với 1 track video. */
function fakeStream(label = 'fake') {
  const track = {
    kind: 'video',
    label,
    readyState: 'live',
    stop() {
      this.readyState = 'ended';
    },
  };
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    _track: track,
  };
}

/**
 * Mô phỏng thiết bị chỉ cho phép MỘT luồng tại một thời điểm — đúng như
 * camera thật. Request thứ hai bị từ chối bằng NotReadableError với message
 * "Could not start video source" (đúng message Chrome dùng).
 */
function makeDevice() {
  const state = { open: 0, calls: 0, maxConcurrent: 0, rejected: 0 };
  const getUserMedia = async () => {
    state.calls += 1;
    state.open += 1;
    state.maxConcurrent = Math.max(state.maxConcurrent, state.open);
    if (state.open > 1) {
      state.open -= 1;
      state.rejected += 1;
      const err = new Error('Could not start video source');
      err.name = 'NotReadableError';
      throw err;
    }
    const stream = fakeStream();
    const originalStop = stream._track.stop.bind(stream._track);
    stream._track.stop = () => {
      state.open -= 1;
      originalStop();
    };
    return stream;
  };
  return { state, getUserMedia };
}

/** Cài môi trường trình duyệt giả cho module. */
function installBrowser({ getUserMedia, devices = 1, permission = 'granted', locks = null } = {}) {
  globalThis.window = { isSecureContext: true };
  // Node 24 có sẵn global `navigator` chỉ có getter → phải define lại.
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: async () =>
          Array.from({ length: devices }, (_, i) => ({ kind: 'videoinput', deviceId: `cam${i}` })),
      },
      permissions: {
        query: async () => ({ state: permission }),
      },
      locks,
    },
  });
}

/** Dọn môi trường giả. */
function uninstallBrowser() {
  delete globalThis.window;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

/** Chờ các microtask chạy xong (hàng đợi thiết bị gọi getUserMedia bất đồng bộ). */
const tick = () => new Promise((r) => setTimeout(r, 0));

test('xin camera hai lần song song chỉ gọi getUserMedia một lần', async () => {
  const device = makeDevice();
  installBrowser({ getUserMedia: device.getUserMedia });
  const session = new CameraSession();

  const [a, b] = await Promise.all([session.acquire('user'), session.acquire('user')]);

  assert.equal(device.state.calls, 1, 'chỉ được gọi getUserMedia đúng một lần');
  assert.equal(device.state.maxConcurrent, 1, 'không bao giờ mở hai luồng cùng lúc');
  assert.equal(device.state.rejected, 0, 'không có request nào bị từ chối');
  assert.equal(a, b, 'cùng một luồng được dùng chung');

  session.release();
  uninstallBrowser();
});

test('nhả camera rồi xin lại: không còn luồng mồ côi giữ thiết bị', async () => {
  const device = makeDevice();
  installBrowser({ getUserMedia: device.getUserMedia });
  const session = new CameraSession();

  const first = await session.acquire('user');
  session.release();
  assert.equal(first._track.readyState, 'ended', 'luồng cũ đã được tắt');

  const second = await session.acquire('user');
  assert.equal(device.state.maxConcurrent, 1, 'thiết bị không bị mở hai lần cùng lúc');
  assert.ok(second._track.readyState === 'live');

  session.release();
  uninstallBrowser();
});

test('request bị bỏ rồi vỡn ra sau: luồng bị tắt ngay, không giữ thiết bị', async () => {
  let resolveGum;
  const device = { state: { open: 0, calls: 0 }, getUserMedia: () => new Promise((r) => { resolveGum = r; }) };
  installBrowser({ getUserMedia: device.getUserMedia });
  const session = new CameraSession();

  const pending = session.acquire('user');
  await tick();
  // Bỏ yêu cầu trước khi nó xong (giống người dùng rời màn hình).
  session.release();

  const stream = fakeStream('late');
  resolveGum(stream);

  await assert.rejects(pending, (err) => err instanceof CameraError && err.code === 'cancelled');
  assert.equal(stream._track.readyState, 'ended', 'luồng vỡn ra sau khi bị bỏ phải bị tắt');

  uninstallBrowser();
});

test('retry dùng lại request đang bay, không mở camera lần nữa', async () => {
  let resolveGum;
  const device = { state: { calls: 0 }, getUserMedia: () => { device.state.calls += 1; return new Promise((r) => { resolveGum = r; }); } };
  installBrowser({ getUserMedia: device.getUserMedia });
  const session = new CameraSession();

  const pending = session.acquire('user');
  await tick();
  // Người dùng bấm "Thử lại" trong khi vẫn đang chờ cấp quyền.
  const retried = session.retry('user');

  assert.equal(device.state.calls, 1, 'retry không được gọi getUserMedia lần nữa');

  const stream = fakeStream();
  resolveGum(stream);
  const [a, b] = await Promise.all([pending, retried]);
  assert.equal(a, b);
  assert.equal(a, stream);

  session.release();
  uninstallBrowser();
});

test('NotReadableError được phân loại "busy" kèm chẩn đoán thật, không đổ lỗi cho app khác', async () => {
  const device = makeDevice();
  installBrowser({ getUserMedia: device.getUserMedia, devices: 1, permission: 'granted' });
  const session = new CameraSession();

  // Thiết bị luôn bận → mọi lần thử đều NotReadableError.
  const alwaysBusy = async () => {
    const err = new Error('Could not start video source');
    err.name = 'NotReadableError';
    throw err;
  };
  globalThis.navigator.mediaDevices.getUserMedia = alwaysBusy;

  await assert.rejects(
    () => session.acquire('user'),
    (err) => {
      assert.ok(err instanceof CameraError);
      assert.equal(err.code, 'busy');
      assert.equal(err.reason, 'NotReadableError');
      assert.equal(err.diag.cameras, 1, 'số camera nhận diện được phải là dữ liệu thật');
      assert.equal(err.diag.permission, 'granted');
      assert.ok(
        !/Zoom|Teams|OBS/i.test(err.message),
        `thông điệp không được đổ lỗi cho ứng dụng khác: ${err.message}`
      );
      return true;
    }
  );

  uninstallBrowser();
});

test('quyền bị từ chối được phân loại "denied"', async () => {
  installBrowser({
    getUserMedia: async () => {
      const err = new Error('Permission denied');
      err.name = 'NotAllowedError';
      throw err;
    },
  });
  const session = new CameraSession();

  await assert.rejects(
    () => session.acquire('user'),
    (err) => {
      assert.equal(err.code, 'denied');
      assert.equal(err.reason, 'NotAllowedError');
      return true;
    }
  );

  uninstallBrowser();
});

test('không có camera nào được phân loại "notfound"', async () => {
  installBrowser({
    getUserMedia: async () => {
      const err = new Error('Requested device not found');
      err.name = 'NotFoundError';
      throw err;
    },
    devices: 0,
  });
  const session = new CameraSession();

  await assert.rejects(
    () => session.acquire('user'),
    (err) => {
      assert.equal(err.code, 'notfound');
      assert.equal(err.diag.cameras, 0);
      return true;
    }
  );

  uninstallBrowser();
});

test('khoá chéo-tab: tab khác đang giữ camera thì báo "locked"', async () => {
  // navigator.locks.request trả về null (ifAvailable) → tab khác đang giữ.
  const locks = {
    request: async (_name, _opts, cb) => {
      const lock = null;
      return cb(lock);
    },
  };
  installBrowser({ getUserMedia: async () => fakeStream(), locks });
  const session = new CameraSession();

  await assert.rejects(
    () => session.acquire('user'),
    (err) => {
      assert.equal(err.code, 'locked');
      assert.ok(/tab hoặc cửa sổ khác/i.test(err.message));
      return true;
    }
  );

  uninstallBrowser();
});

test('đổi camera trước/sau: nhả luồng cũ trước khi xin luồng mới', async () => {
  const device = makeDevice();
  installBrowser({ getUserMedia: device.getUserMedia });
  const session = new CameraSession();

  const stream = await session.acquire('user');
  // Mô phỏng thiết bị có 2 hướng camera.
  stream.getVideoTracks()[0].getCapabilities = () => ({ facingMode: ['user', 'environment'] });

  const facing = await session.flip(null);
  assert.equal(facing, 'environment');
  assert.equal(device.state.maxConcurrent, 1, 'không được giữ luồng cũ khi xin luồng mới');
  assert.equal(stream._track.readyState, 'ended', 'luồng cũ phải được tắt');

  session.release();
  uninstallBrowser();
});

test('trang không phải secure context thì báo lỗi "insecure" trước khi gọi camera', async () => {
  let called = 0;
  installBrowser({
    getUserMedia: async () => {
      called += 1;
      return fakeStream();
    },
  });
  globalThis.window.isSecureContext = false;
  const session = new CameraSession();

  await assert.rejects(
    () => session.acquire('user'),
    (err) => {
      assert.equal(err.code, 'insecure');
      return true;
    }
  );
  assert.equal(called, 0, 'không được gọi camera khi trang không secure');

  uninstallBrowser();
});
