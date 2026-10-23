import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import TopBar from './components/TopBar.jsx';
import ReviewScreen from './components/ReviewScreen.jsx';
import DecorateScreen from './components/DecorateScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import { getFrame } from './lib/frames.js';

function makeShot(i) {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 900;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 900);
  g.addColorStop(0, ['#ff9ec4', '#9b5bff', '#22d3ee', '#34d399'][i % 4]);
  g.addColorStop(1, '#1a1033');
  x.fillStyle = g;
  x.fillRect(0, 0, 1200, 900);
  x.fillStyle = 'rgba(255,255,255,.9)';
  x.font = '900 150px system-ui, sans-serif';
  x.textAlign = 'center';
  x.fillText(`SHOT ${i + 1}`, 600, 500);
  return c;
}

const FRAME = getFrame('classic4');
const SHOTS = [0, 1, 2, 3].map(makeShot);

function Harness() {
  const [screen, setScreen] = useState('review');
  const [stickers, setStickers] = useState([]);

  return (
    <>
      <TopBar stepLabel={`Debug · ${screen}`} canGoBack={false} onBack={() => {}} />
      <main className="app">
        <div style={{ display: 'flex', gap: 8 }}>
          {['review', 'decorate', 'result'].map((s) => (
            <button key={s} type="button" className={`btn btn--sm${screen === s ? ' btn--primary' : ''}`} onClick={() => setScreen(s)}>
              {s}
            </button>
          ))}
        </div>
        {screen === 'review' && (
          <ReviewScreen
            frame={FRAME}
            shots={SHOTS}
            onRetake={() => {}}
            onRemove={() => {}}
            onBack={() => {}}
            onNext={() => {}}
          />
        )}
        {screen === 'decorate' && (
          <DecorateScreen
            frame={FRAME}
            shots={SHOTS}
            stickers={stickers}
            onStickersChange={setStickers}
            onBack={() => {}}
            onFinish={() => {}}
          />
        )}
        {screen === 'result' && (
          <ResultScreen
            frame={FRAME}
            shots={SHOTS}
            stickers={stickers}
            fileName="debug.png"
            notify={() => {}}
            onRestart={() => {}}
          />
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
