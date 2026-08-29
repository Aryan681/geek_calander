import { useEffect, useRef } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import gsap from "gsap";
import { EventCard } from "./EventCard";

export function TrendingSection({ category, setCategory, mode, setMode, window, setWindow, query, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const cards = ref.current?.querySelectorAll(".event-card");
    if (!cards?.length) return undefined;
    const ctx = gsap.context(() => gsap.fromTo(cards, { opacity: 0, y: reduced ? 0 : 10 }, { opacity: 1, y: 0, duration: reduced ? 0 : 0.3, stagger: reduced ? 0 : 0.04 }), ref);
    return () => ctx.revert();
  }, [query.data]);
  return (
    <section className="trending-section" ref={ref} aria-labelledby="fresh-heading">
      <div className="trending-heading"><div><p className="eyebrow">/ live release radar</p><h2 id="fresh-heading">What&apos;s Fresh</h2><p className="lede">Real releases, ranked by release date.</p></div></div>
      <div className="trending-toolbar">
        <div className="discover-tabs" role="group" aria-label="Filter fresh releases by category">
          {[['all', 'All'], ['anime', 'Anime'], ['movie', 'Movies'], ['game', 'Games']].map(([value, label]) => <button key={value} className={category === value ? "active" : ""} aria-pressed={category === value} onClick={() => setCategory(value)}>{label}</button>)}
        </div>
        <div className="discover-tabs" role="group" aria-label="Choose fresh release view">
          <button className={mode === "fresh" && window === "week" ? "active" : ""} aria-pressed={mode === "fresh" && window === "week"} onClick={() => { setMode("fresh"); setWindow("week"); }}>New Releases</button>
          <button className={mode === "upcoming" ? "active" : ""} aria-pressed={mode === "upcoming"} onClick={() => { setMode("upcoming"); setWindow("month"); }}>Coming Soon</button>
          <select aria-label="Fresh release window" value={window} onChange={(e) => { setWindow(e.target.value); setMode("fresh"); }}><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option></select>
        </div>
      </div>
      {query.isLoading && <div className="trending-loading" aria-label="Loading fresh releases">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>}
      {query.isError && !query.isLoading && <div className="discover-state"><RefreshCw size={22} /><p>Trending is temporarily unavailable.</p><button className="primary-button" onClick={() => query.refetch()}>Retry</button></div>}
      {!query.isLoading && !query.isError && !query.data?.events.length && <div className="discover-state"><Sparkles size={22} /><p>No releases match these filters.</p></div>}
      {!query.isLoading && !query.isError && query.data?.events.length > 0 && <div className="trending-grid">{query.data.events.map((event) => <EventCard key={event.id} event={event} onSelect={onSelect} />)}</div>}
    </section>
  );
}
