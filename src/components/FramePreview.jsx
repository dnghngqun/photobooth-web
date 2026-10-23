import { useEffect, useRef } from 'react';
import { renderThumb } from '../lib/render.js';

/** Vẽ thumbnail của frame vào một canvas React quản lý. */
export default function FramePreview({ frame, width = 260 }) {
  const ref = useRef(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const thumb = renderThumb(frame, width);
    target.width = thumb.width;
    target.height = thumb.height;
    target.getContext('2d').drawImage(thumb, 0, 0);
  }, [frame, width]);

  return <canvas ref={ref} />;
}
