import { useEffect, useRef } from "react";
import { ExternalLink, Sparkles, X } from "lucide-react";
import gsap from "gsap";
import { colors, labels } from "../../config/categories";
import { formatDate } from "../../lib/dates";
export function EventDrawer({ event, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const ctx = gsap.context(
      () =>
        gsap.fromTo(
          ".drawer-panel",
          { x: "100%" },
          { x: 0, duration: 0.4, ease: "power3.out" },
        ),
      ref,
    );
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => {
      ctx.revert();
      document.removeEventListener("keydown", key);
      previous?.focus?.();
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
        aria-label={event.title}
      >
        <button
          ref={closeRef}
          className="close-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X />
        </button>
        {event.imageUrl ? (
          <img
            className="artwork"
            src={event.imageUrl}
            alt=""
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="artwork artwork-empty">
            <Sparkles />
          </div>
        )}
        <div className="drawer-content">
          <span
            className="category-label"
            style={{ color: colors[event.category] }}
          >
            {labels[event.category]} · {event.source}
          </span>
          <h2>{event.title}</h2>
          <p className="release-date">{formatDate(event.releaseDate)}</p>
          {event.description && (
            <p className="description">{event.description}</p>
          )}
          {event.platforms?.length > 0 && (
            <div className="platforms">
              {event.platforms.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
          )}
          {event.externalUrl && (
            <a
              className="external-link"
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source <ExternalLink size={15} />
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}
