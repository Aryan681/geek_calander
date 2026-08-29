import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/navigation/Header";
import { MobileMenu } from "../components/navigation/MobileMenu";
import { Calendar } from "../components/calendar/Calendar";
import { EventDrawer } from "../components/events/EventDrawer";
import { DayEventsDrawer } from "../components/events/DayEventsDrawer";
import { SearchOverlay } from "../components/search/SearchOverlay";
import { fetchEvents } from "../lib/api";
import { monthBounds } from "../lib/dates";
export function CalendarPage() {
  const now = new Date(),
    [date, setDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1)),
    [category, setCategory] = useState("all"),
    [selected, setSelected] = useState(null),
    [more, setMore] = useState(null),
    [searchOpen, setSearchOpen] = useState(false),
    [menu, setMenu] = useState(false);
  const bounds = monthBounds(date),
    query = useQuery({
      queryKey: ["events", bounds.from, bounds.to, category],
      queryFn: ({ signal }) =>
        fetchEvents(
          { ...bounds, category: category === "all" ? undefined : category },
          signal,
        ),
    }),
    events = query.data?.events || [],
    counts = useMemo(
      () =>
        events.reduce((a, e) => (a[e.category]++, a), {
          anime: 0,
          movie: 0,
          game: 0,
        }),
      [events],
    );
  return (
    <>
      <Header
        onSearch={() => setSearchOpen(true)}
        onMenu={() => setMenu(true)}
      />
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
      <main className="shell">
        <section className="intro">
          <div>
            <p className="eyebrow">
              / release radar <span>·</span> {bounds.from}
            </p>
            <h1>
              What’s on your <em>watchlist?</em>
            </h1>
            <p className="lede">
              A living calendar for the anime, movies, and games worth showing
              up for.
            </p>
          </div>
          <div className="stats">
            <span>
              <b>{events.length}</b> this month
            </span>
            <span>
              <b className="anime-text">{counts.anime}</b> anime
            </span>
            <span>
              <b className="movie-text">{counts.movie}</b> films
            </span>
            <span>
              <b className="game-text">{counts.game}</b> games
            </span>
          </div>
        </section>
        <Calendar
          date={date}
          setDate={setDate}
          events={events}
          query={query}
          category={category}
          setCategory={setCategory}
          onSelect={setSelected}
          onMore={(day, list) => setMore({ day, list })}
        />
      </main>
      {selected && (
        <EventDrawer event={selected} onClose={() => setSelected(null)} />
      )}{" "}
      {more && (
        <DayEventsDrawer
          day={more.day}
          events={more.list}
          onClose={() => setMore(null)}
          onSelect={(event) => {
            setMore(null);
            setSelected(event);
          }}
        />
      )}
      <SearchOverlay
        open={searchOpen}
        close={() => setSearchOpen(false)}
        onSelect={(e) => {
          setSelected(e);
          setSearchOpen(false);
        }}
      />
    </>
  );
}
