import { RefreshCw, Sparkles } from "lucide-react";
export function LoadingState() {
  return (
    <div className="loading-grid" aria-label="Loading calendar">
      {Array.from({ length: 35 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
export function EmptyState() {
  return (
    <div className="state">
      <Sparkles size={25} />
      <h2>No releases in this window</h2>
      <p>Try another month or clear the category filter.</p>
    </div>
  );
}
export function ErrorState({ retry }) {
  return (
    <div className="state error-state">
      <RefreshCw size={22} />
      <h2>Release radar is offline</h2>
      <p>
        The event service did not respond. Your calendar is safe — try again in
        a moment.
      </p>
      <button className="primary-button" onClick={retry}>
        Retry connection
      </button>
    </div>
  );
}
