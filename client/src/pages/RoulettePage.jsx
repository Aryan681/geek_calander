import { useEffect, useRef, useState } from "react";
import { Dice5, ExternalLink, Sparkles } from "lucide-react";
import gsap from "gsap";
import { Header } from "../components/navigation/Header";
import { MobileMenu } from "../components/navigation/MobileMenu";
import { EventDrawer } from "../components/events/EventDrawer";
import { fetchRoulette } from "../lib/api";
import { formatDate } from "../lib/dates";
import { colors, labels } from "../config/categories";

const windows = [
  ["recent", "Recently Released"],
  ["week", "Coming This Week"],
  ["month", "Coming This Month"],
];

export function RoulettePage() {
  const [menu, setMenu] = useState(false),
    [category, setCategory] = useState("all"),
    [releaseWindow, setReleaseWindow] = useState("month"),
    [mode, setMode] = useState("random"),
    [result, setResult] = useState(null),
    [error, setError] = useState(null),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState(null);
  const shown = useRef(new Set());
  const controller = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!result) return undefined;
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const ctx = gsap.context(
      () => gsap.fromTo(resultRef.current, { opacity: 0, y: reduced ? 0 : 18 }, { opacity: 1, y: 0, duration: reduced ? 0 : 0.45, ease: "power2.out" }),
      resultRef,
    );
    return () => ctx.revert();
  }, [result]);

  async function chooseRecommendation(reset = false) {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    if (reset) shown.current.clear();
    setLoading(true);
    setError(null);
    try {
      const response = await fetchRoulette({
        category,
        window: releaseWindow,
        mode,
        exclude: [...shown.current],
      }, nextController.signal);
      shown.current.add(response.event.id);
      setResult(response.event);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError);
    } finally {
      if (!nextController.signal.aborted) setLoading(false);
    }
  }

  return (
    <>
      <Header onSearch={() => {}} onMenu={() => setMenu(true)} />
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
      <main className="shell roulette-page">
        <section className="roulette-intro">
          <p className="eyebrow">/ geek roulette <span>·</span> real releases</p>
          <h1>Don&apos;t know what to watch?</h1>
          <p className="lede">Let the release calendar choose your next obsession.</p>
        </section>
        <section className="roulette-controls" aria-label="Roulette settings">
          <div>
            <span className="control-label">Category</span>
            <div className="roulette-options" role="group" aria-label="Choose a category">
              {[["all", "All"], ["anime", "Anime"], ["movie", "Movies"], ["game", "Games"]].map(([value, label]) => (
                <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)} aria-pressed={category === value}>{label}</button>
              ))}
            </div>
          </div>
          <label className="roulette-select">
            <span className="control-label">Release window</span>
            <select value={releaseWindow} onChange={(event) => setReleaseWindow(event.target.value)}>
              {windows.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div>
            <span className="control-label">Discovery mode</span>
            <div className="roulette-options" role="group" aria-label="Choose a discovery mode">
              <button className={mode === "random" ? "active" : ""} onClick={() => setMode("random")} aria-pressed={mode === "random"}>Surprise Me</button>
              <button className={mode === "fresh" ? "active" : ""} onClick={() => setMode("fresh")} aria-pressed={mode === "fresh"}>Fresh Releases</button>
            </div>
          </div>
          <button className="primary-button roulette-button" onClick={() => chooseRecommendation()} disabled={loading}>
            <Dice5 size={17} /> {loading ? "Finding a release…" : "Surprise Me"}
          </button>
        </section>
        <section className="roulette-result" aria-live="polite" aria-busy={loading} ref={resultRef}>
          {loading && <p className="roulette-message">Searching the live release calendar…</p>}
          {!loading && error && (
            <div className="roulette-message">
              <Sparkles size={25} />
              <h2>{error.status === 404 ? "You've seen everything in this window." : "Roulette is unavailable."}</h2>
              <p>{error.status === 404 ? "Start a fresh session or try another window." : "The event service did not respond."}</p>
              <button className="primary-button" onClick={() => chooseRecommendation(error.status === 404)}>Try again</button>
            </div>
          )}
          {!loading && !error && !result && (
            <div className="roulette-message"><Dice5 size={32} /><h2>Your next obsession?</h2><p>Choose your filters, then let the calendar decide.</p></div>
          )}
          {!loading && !error && result && (
            <article className="roulette-card">
              {result.imageUrl ? <img src={result.imageUrl} alt={result.title} className="roulette-artwork" /> : <div className="roulette-artwork artwork-empty"><Sparkles /></div>}
              <div className="roulette-details">
                <span className="category-label" style={{ color: colors[result.category] }}>{labels[result.category]} · {result.source}</span>
                <h2>{result.title}</h2>
                <p className="release-date">Releases {formatDate(result.releaseDate)}</p>
                {result.description && <p className="description">{result.description}</p>}
                {result.platforms?.length > 0 && <div className="platforms">{result.platforms.map((platform) => <span key={platform}>{platform}</span>)}</div>}
                <div className="roulette-actions">
                  <button className="primary-button" onClick={() => setSelected(result)}>View details</button>
                  {result.externalUrl && <a className="external-link" href={result.externalUrl} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={15} /></a>}
                  <button className="roulette-again" onClick={() => chooseRecommendation()}>Give me another</button>
                </div>
              </div>
            </article>
          )}
        </section>
      </main>
      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
