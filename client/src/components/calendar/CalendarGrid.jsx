import { CalendarDay } from "./CalendarDay";
export function CalendarGrid({ cells, index, today, onSelect, onMore }) {
  return (
    <div className="calendar-grid">
      <div className="weekdays">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="days">
        {cells.map((date, i) => (
          <CalendarDay
            key={i}
            date={date}
            events={
              date ? index.get(date.toISOString().slice(0, 10)) || [] : []
            }
            isToday={date?.toDateString() === today.toDateString()}
            onSelect={onSelect}
            onMore={onMore}
          />
        ))}
      </div>
    </div>
  );
}
