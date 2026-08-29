import { colors, labels } from "../../config/categories";
import { formatDate } from "../../lib/dates";
export function SearchResult({ event, onSelect }) {
  return (
    <button onClick={() => onSelect(event)}>
      <span style={{ color: colors[event.category] }}>
        {labels[event.category]}
      </span>
      <b>{event.title}</b>
      <small>{formatDate(event.releaseDate)}</small>
    </button>
  );
}
