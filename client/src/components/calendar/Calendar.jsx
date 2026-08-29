import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import gsap from "gsap";
import { CalendarGrid } from "./CalendarGrid";
import { EmptyState, ErrorState, LoadingState } from "../feedback/States";
import { calendarDateKey } from "../../lib/dates";
export function Calendar({
  date,
  setDate,
  events,
  query,
  category,
  setCategory,
  onSelect,
  onMore,
}) {
  const ref = useRef(null);
  const cells = useMemo(() => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1),
      count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      offset = (start.getDay() + 6) % 7;
    return Array.from(
      { length: Math.ceil((offset + count) / 7) * 7 },
      (_, i) =>
        i < offset || i - offset + 1 > count
          ? null
          : new Date(date.getFullYear(), date.getMonth(), i - offset + 1),
    );
  }, [date]);
  const index = useMemo(
    () =>
      events.reduce((map, event) => {
        const key = calendarDateKey(event.releaseDate);
        if (key) map.set(key, [...(map.get(key) || []), event]);
        return map;
      }, new Map()),
    [events],
  );
  useEffect(() => {
    const ctx = gsap.context(() =>
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
      ),
    );
    return () => ctx.revert();
  }, [date, category]);
  return (
    <>
      <section className="toolbar">
        <div className="filters" role="group" aria-label="Filter by category">
          {["all", "anime", "movie", "game"].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c === "all"
                ? "All releases"
                : c[0].toUpperCase() + c.slice(1) + (c === "movie" ? "s" : "")}
            </button>
          ))}
        </div>
        <div className="calendar-nav">
          <button
            onClick={() =>
              setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button className="today-button" onClick={() => setDate(new Date())}>
            Today
          </button>
          <button
            onClick={() =>
              setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="calendar-wrap" ref={ref}>
        <div className="calendar-heading">
          <h2>
            {date.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <span className="range-note">
            {query.isFetching ? "SYNCING…" : "LIVE WINDOW"}{" "}
            <i className="pulse" />
          </span>
        </div>
        {query.isError ? (
          <ErrorState retry={() => query.refetch()} />
        ) : query.isLoading ? (
          <LoadingState />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <CalendarGrid
            cells={cells}
            index={index}
            today={new Date()}
            onSelect={onSelect}
            onMore={onMore}
          />
        )}
      </section>
    </>
  );
}
