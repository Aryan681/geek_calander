import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RoulettePage } from "./RoulettePage";
import { fetchRoulette } from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchRoulette: vi.fn(),
}));

const event = {
  id: "game:1", title: "A Real Game", category: "game", source: "igdb",
  releaseDate: "2026-08-01T00:00:00.000Z", description: "Play it", imageUrl: null,
  platforms: ["PC"], externalUrl: "https://example.test/game",
};

function renderPage() {
  return render(<MemoryRouter><RoulettePage /></MemoryRouter>);
}

afterEach(() => vi.clearAllMocks());

describe("Geek Roulette page", () => {
  it("renders accessible controls and an idle state", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /don't know what to watch/i })).toBeVisible();
    expect(screen.getByRole("group", { name: /choose a category/i })).toBeVisible();
    expect(screen.getByLabelText("Release window")).toHaveValue("month");
    expect(screen.getByText(/choose your filters/i)).toBeVisible();
  });

  it("selects category and window, shows loading, then renders the result", async () => {
    let resolve;
    fetchRoulette.mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.change(screen.getByLabelText("Release window"), { target: { value: "week" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Surprise Me" }).at(-1));
    expect(screen.getByText(/searching the live release calendar/i)).toBeVisible();
    expect(fetchRoulette).toHaveBeenCalledWith(expect.objectContaining({ category: "game", window: "week" }), expect.anything());
    resolve({ event });
    await waitFor(() => expect(screen.getByRole("heading", { name: "A Real Game" })).toBeVisible());
    expect(screen.getByText(/PC/)).toBeVisible();
    expect(screen.getByRole("link", { name: /open source/i })).toHaveAttribute("href", event.externalUrl);
  });

  it("passes shown IDs for Give Me Another and opens the existing drawer", async () => {
    fetchRoulette.mockResolvedValueOnce({ event }).mockResolvedValueOnce({ event: { ...event, id: "game:2", title: "Another Game" } });
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Surprise Me" }).at(-1));
    await waitFor(() => expect(screen.getByRole("heading", { name: "A Real Game" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Give me another" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Another Game" })).toBeVisible());
    expect(fetchRoulette.mock.calls[1][0].exclude).toEqual(["game:1"]);
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(await screen.findByRole("dialog", { name: "Another Game" })).toBeVisible();
  });

  it("shows backend errors and allows a fresh retry", async () => {
    fetchRoulette.mockRejectedValueOnce(Object.assign(new Error("empty"), { status: 404 }));
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Surprise Me" }).at(-1));
    expect(await screen.findByText(/seen everything/i)).toBeVisible();
    fetchRoulette.mockResolvedValueOnce({ event });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "A Real Game" })).toBeVisible();
  });
});
