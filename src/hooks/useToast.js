import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Toast đơn giản: gọi show('nội dung') để hiện thông báo ngắn.
 */
export function useToast(timeout = 2800) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = useCallback(
    (text, ms = timeout) => {
      setMessage(text);
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), ms);
    },
    [timeout]
  );

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { message, visible, show, hide };
}
