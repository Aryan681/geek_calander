import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { fetchEvents } from "../../lib/api";
import { SearchResult } from "./SearchResult";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
export function SearchOverlay({ open, close, onSelect }) {
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term.trim());
  const q = useQuery({
    queryKey: ["search", debouncedTerm],
    queryFn: ({ signal }) =>
      fetchEvents(
        {
          from: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
          to: new Date(new Date().getFullYear() + 1, 0, 1).toISOString(),
          search: debouncedTerm,
          limit: 30,
        },
        signal,
      ),
    enabled: open && debouncedTerm.length > 1,
  });
  useEffect(() => {
    if (!open) setTerm("");
    const key = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, close]);
  if (!open) return null;
  return (
    <div
      className="search-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="search-panel">
        <div className="search-input">
          <Search size={20} />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search anime, films, games, manga, comics…"
            aria-label="Search events"
          />
          <kbd>ESC</kbd>
        </div>
        {term.length < 2 ? (
          <p className="search-hint">
            Type at least 2 characters to search the release archive.
          </p>
        ) : q.isLoading ? (
          <p className="search-hint">Searching the archive…</p>
        ) : q.isError ? (
          <p className="search-hint">Search is unavailable right now.</p>
        ) : !q.data?.events.length ? (
          <p className="search-hint">No releases matched “{term}”.</p>
        ) : (
          <div className="search-results">
            {q.data.events.map((e) => (
              <SearchResult key={e.id} event={e} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
