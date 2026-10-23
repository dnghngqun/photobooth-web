export default function Toast({ message, visible }) {
  return (
    <div className="toast" role="status" aria-live="polite" hidden={!visible}>
      {message}
    </div>
  );
}
