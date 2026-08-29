import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/navigation/Header";
import { MobileMenu } from "../components/navigation/MobileMenu";
import { EventDrawer } from "../components/events/EventDrawer";
import { fetchEvents } from "../lib/api";
import { formatDate } from "../lib/dates";
import { colors, labels } from "../config/categories";
export function DiscoverPage() {
  const [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(null);
  const now = new Date(),
    query = useQuery({
      queryKey: ["discover"],
      queryFn: ({ signal }) =>
        fetchEvents(
          {
            from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
            to: new Date(
              now.getFullYear(),
              now.getMonth() + 3,
              1,
            ).toISOString(),
            limit: 60,
          },
          signal,
        ),
    });
  const events = query.data?.events || [];
  return (
    <>
      <Header onSearch={() => {}} onMenu={() => setMenu(true)} />
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
      <main className="simple-page">
        <p className="eyebrow">/ release radar · next 90 days</p>
        <h1>Find your next obsession.</h1>
        <p className="lede">
          A focused look at what’s coming up across the live release calendar.
        </p>
        {query.isError ? (
          <p className="lede">
            Discover is unavailable while the event service is offline.
          </p>
        ) : query.isLoading ? (
          <p className="lede">Loading the next releases…</p>
        ) : (
          <div className="discover-list">
            {events.map((e) => (
              <button key={e.id} onClick={() => setSelected(e)}>
                <span style={{ color: colors[e.category] }}>
                  {labels[e.category]}
                </span>
                <b>{e.title}</b>
                <small>{formatDate(e.releaseDate)}</small>
              </button>
            ))}
            {!events.length && (
              <p className="lede">
                No releases were returned for the next 90 days.
              </p>
            )}
          </div>
        )}
      </main>
      {selected && (
        <EventDrawer event={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
