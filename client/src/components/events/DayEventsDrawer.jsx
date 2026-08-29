import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import gsap from "gsap";
import { colors, labels } from "../../config/categories";
import { formatDate } from "../../lib/dates";
export function DayEventsDrawer({ day, events, onClose, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(
      () =>
        gsap.fromTo(
          ".drawer-panel",
          { x: "100%" },
          { x: 0, duration: 0.35, ease: "power3.out" },
        ),
      ref,
    );
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => {
      ctx.revert();
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div
      className="drawer-overlay"
      ref={ref}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Releases for this day"
      >
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X />
        </button>
        <div className="drawer-content day-list">
          <span className="category-label">
            {formatDate(day.toISOString())}
          </span>
          <h2>{events.length} releases</h2>
          {events.map((event) => (
            <button
              className="day-list-item"
              key={event.id}
              onClick={() => onSelect(event)}
            >
              <span style={{ color: colors[event.category] }}>
                {labels[event.category]}
              </span>
              <b>{event.title}</b>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
