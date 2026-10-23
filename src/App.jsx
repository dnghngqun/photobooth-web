import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFrame } from './lib/frames.js';
import { useToast } from './hooks/useToast.js';

import TopBar from './components/TopBar.jsx';
import Toast from './components/Toast.jsx';
import StartScreen from './components/StartScreen.jsx';
import FramesScreen from './components/FramesScreen.jsx';
import CaptureScreen from './components/CaptureScreen.jsx';
import ReviewScreen from './components/ReviewScreen.jsx';
import DecorateScreen from './components/DecorateScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';

const STEP_LABEL = {
  start: 'Chào mừng',
  frames: 'Bước 1 · Chọn khung',
  capture: 'Bước 2 · Chụp ảnh',
  review: 'Bước 3 · Kiểm tra ảnh',
  decorate: 'Bước 4 · Trang trí',
  result: 'Hoàn tất',
};

const BACK_FROM = {
  frames: 'start',
  capture: 'frames',
  review: 'capture',
  decorate: 'review',
};

const DEFAULT_FRAME_ID = 'classic4';

export default function App() {
  const [screen, setScreen] = useState('start');
  const [frameId, setFrameId] = useState(DEFAULT_FRAME_ID);
  const [source, setSource] = useState('camera');
  const [shots, setShots] = useState(() => new Array(getFrame(DEFAULT_FRAME_ID).cuts).fill(null));
  const [stickers, setStickers] = useState([]);
  const [activeSlot, setActiveSlot] = useState(0);

  const toast = useToast();
  const { show: notify } = toast;

  const frame = useMemo(() => getFrame(frameId), [frameId]);

  const goBack = useCallback(() => {
    const target = BACK_FROM[screen];
    if (target) setScreen(target);
  }, [screen]);

  // Chuyển bước: luôn cuộn lên đầu trang.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [screen]);

  // Phím tắt: Esc quay lại, Enter/Space chụp ảnh ở màn hình capture.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && BACK_FROM[screen]) {
        goBack();
        return;
      }
      if (screen === 'capture' && (event.key === 'Enter' || event.key === ' ')) {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        if (el && el.tagName === 'BUTTON') return;
        event.preventDefault();
        document.querySelector('[data-shutter]')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, screen]);

  const handleSelectFrame = useCallback((id) => {
    const next = getFrame(id);
    setFrameId(id);
    setShots(new Array(next.cuts).fill(null));
    setStickers([]);
    setActiveSlot(0);
    setScreen('capture');
  }, []);

  const handleShotTaken = useCallback(
    (slot, canvas) => {
      setShots((prev) => {
        const next = [...prev];
        next[slot] = canvas;
        const empty = next.findIndex((s) => !s);
        if (empty >= 0) {
          setActiveSlot(empty);
        } else {
          setScreen('review');
        }
        return next;
      });
    },
    []
  );

  const handleRemoveShot = useCallback((index) => {
    setShots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const handleRetake = useCallback((index) => {
    setActiveSlot(index);
    setScreen('capture');
  }, []);

  const restart = useCallback(() => {
    setShots(new Array(frame.cuts).fill(null));
    setStickers([]);
    setActiveSlot(0);
    setScreen('capture');
  }, [frame.cuts]);

  const fileName = useMemo(() => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `photobooth-${frameId}-${stamp}.png`;
  }, [frameId]);

  const appClass = `app${screen === 'capture' || screen === 'decorate' ? ' app--capture' : ''}`;

  return (
    <>
      <TopBar
        stepLabel={STEP_LABEL[screen] || ''}
        canGoBack={Boolean(BACK_FROM[screen])}
        onBack={goBack}
      />

      <main className={appClass}>
        {screen === 'start' && (
          <StartScreen onStart={() => setScreen('frames')} />
        )}

        {screen === 'frames' && (
          <FramesScreen frameId={frameId} onSelect={handleSelectFrame} />
        )}

        {screen === 'capture' && (
          <CaptureScreen
            frame={frame}
            shots={shots}
            activeSlot={activeSlot}
            source={source}
            onSourceChange={setSource}
            onSlotSelect={setActiveSlot}
            onShotTaken={handleShotTaken}
            onAllDone={() => setScreen('review')}
            notify={notify}
          />
        )}

        {screen === 'review' && (
          <ReviewScreen
            shots={shots}
            onRetake={handleRetake}
            onRemove={handleRemoveShot}
            onBack={() => {
              setActiveSlot(0);
              setScreen('capture');
            }}
            onNext={() => setScreen('decorate')}
          />
        )}

        {screen === 'decorate' && (
          <DecorateScreen
            frame={frame}
            shots={shots}
            stickers={stickers}
            onStickersChange={setStickers}
            onBack={() => setScreen('review')}
            onFinish={() => setScreen('result')}
          />
        )}

        {screen === 'result' && (
          <ResultScreen
            frame={frame}
            shots={shots}
            stickers={stickers}
            fileName={fileName}
            notify={notify}
            onRestart={restart}
          />
        )}
      </main>

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
