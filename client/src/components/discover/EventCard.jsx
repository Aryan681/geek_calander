import { Sparkles } from "lucide-react";
import { colors, labels } from "../../config/categories";
import { formatDate } from "../../lib/dates";

export function EventCard({ event, onSelect }) {
  return (
    <button className="event-card" onClick={() => onSelect(event)} aria-label={`View details for ${event.title}`}>
      {event.imageUrl ? (
        <img src={event.imageUrl} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
      ) : (
        <span className="event-card-empty"><Sparkles size={20} /></span>
      )}
      <span className="event-card-body">
        <span className="category-label" style={{ color: colors[event.category] }}>{labels[event.category]} · {event.source}</span>
        <b>{event.title}</b>
        <small>{formatDate(event.releaseDate)}</small>
      </span>
    </button>
  );
}
