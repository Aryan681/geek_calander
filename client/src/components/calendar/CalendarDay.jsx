import { EventChip } from "./EventChip";
export function CalendarDay({ date, events, isToday, onSelect, onMore }) {
  return (
    <div className={`day ${isToday ? "today" : ""}`}>
      {date && (
        <>
          <span className="day-number">
            {date.getDate()}
            {isToday && <i>NOW</i>}
          </span>
          <div className="day-events">
            {events.slice(0, 4).map((e) => (
              <EventChip key={e.id} event={e} onClick={() => onSelect(e)} />
            ))}
            {events.length > 4 && (
              <button
                className="more-button"
                onClick={() => onMore(date, events)}
              >
                +{events.length - 4} more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
