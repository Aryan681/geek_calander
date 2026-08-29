import { colors } from "../../config/categories";
export function EventChip({ event, onClick }) {
  return (
    <button
      className="event-chip"
      style={{ "--event-color": colors[event.category] }}
      onClick={onClick}
      title={event.title}
    >
      <span className="chip-dot" />
      {event.title}
    </button>
  );
}
