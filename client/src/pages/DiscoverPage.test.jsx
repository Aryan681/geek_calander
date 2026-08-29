import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DiscoverPage } from "./DiscoverPage";
import { fetchEvents, fetchTrending } from "../lib/api";

vi.mock("../lib/api", () => ({ fetchEvents: vi.fn(), fetchTrending: vi.fn() }));
vi.mock("../components/events/EventDrawer", () => ({ EventDrawer: ({ event }) => <div role="dialog" aria-label={event.title}>{event.title}</div> }));

const event = { id: "anime:1", title: "Fresh Anime", category: "anime", source: "anilist", releaseDate: "2026-08-10T00:00:00Z", imageUrl: null };
const mangaEvent = { id: "mangadex:chapter:1", title: "Fresh Manga", category: "manga", source: "mangadex", releaseDate: "2026-08-11T00:00:00Z", imageUrl: null };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><DiscoverPage /></MemoryRouter></QueryClientProvider>);
}

afterEach(() => vi.clearAllMocks());

describe("Discover fresh releases", () => {
  it("renders existing Discover content and the fresh section", async () => {
    fetchEvents.mockResolvedValue({ events: [] });
    fetchTrending.mockResolvedValue({ events: [event] });
    renderPage();
    expect(screen.getByRole("heading", { name: /find your next obsession/i })).toBeVisible();
    expect(await screen.findByRole("heading", { name: /what's fresh/i })).toBeVisible();
    expect(await screen.findByRole("button", { name: /view details for fresh anime/i })).toBeVisible();
  });

  it("switches category and window through React Query", async () => {
    fetchEvents.mockResolvedValue({ events: [] });
    fetchTrending.mockResolvedValue({ events: [] });
    renderPage();
    await screen.findByRole("heading", { name: /what's fresh/i });
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.change(screen.getByLabelText("Fresh release window"), { target: { value: "day" } });
    await waitFor(() => expect(fetchTrending).toHaveBeenCalledWith(expect.objectContaining({ category: "game", window: "day" }), expect.anything()));
  });

  it("supports manga releases in the shared discover flow", async () => {
    fetchEvents.mockResolvedValue({ events: [] });
    fetchTrending.mockResolvedValue({ events: [mangaEvent] });
    renderPage();
    await screen.findByRole("heading", { name: /what's fresh/i });
    fireEvent.click(screen.getByRole("button", { name: "Manga" }));
    expect(await screen.findByRole("button", { name: /view details for fresh manga/i })).toBeVisible();
    expect(fetchTrending).toHaveBeenCalledWith(expect.objectContaining({ category: "manga" }), expect.anything());
  });

  it("shows loading, empty, error, retry, and opens the shared drawer", async () => {
    let resolve;
    fetchEvents.mockResolvedValue({ events: [] });
    fetchTrending.mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderPage();
    expect(screen.getByLabelText("Loading fresh releases")).toBeVisible();
    resolve({ events: [event] });
    await waitFor(() => expect(screen.getByText("Fresh Anime")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: /view details for fresh anime/i }));
    expect(screen.getByRole("dialog", { name: "Fresh Anime" })).toBeVisible();

    fetchTrending.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(await screen.findByText(/trending is temporarily unavailable/i)).toBeVisible();
    fetchTrending.mockResolvedValueOnce({ events: [] });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/no releases match/i)).toBeVisible();
  });
});
