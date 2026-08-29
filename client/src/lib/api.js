export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "https://geek-calander.onrender.com"
).replace(/\/$/, "");

const MAX_PAGE_SIZE = 500;
const MAX_PAGES = 20;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;

  const event = raw;
  const title = String(event.title ?? "").trim();
  const releaseDate = String(event.releaseDate ?? "").trim();
  const category = String(event.category ?? "").toLowerCase();

  if (!title || !releaseDate || Number.isNaN(Date.parse(releaseDate)))
    return null;
  if (!["anime", "movie", "game"].includes(category)) return null;

  return {
    id: String(event.id ?? ""),
    source: String(event.source ?? "unknown"),
    category,
    externalId: String(event.externalId ?? ""),
    title: title.replace(/^\[(anime|movie|game)\]\s*/i, ""),
    releaseDate,
    description:
      typeof event.description === "string" ? event.description : undefined,
    imageUrl: typeof event.imageUrl === "string" ? event.imageUrl : undefined,
    platforms: Array.isArray(event.platforms)
      ? event.platforms.filter((platform) => typeof platform === "string")
      : undefined,
    externalUrl:
      typeof event.externalUrl === "string" ? event.externalUrl : undefined,
    metadata:
      event.metadata && typeof event.metadata === "object"
        ? event.metadata
        : undefined,
  };
}

function readResponse(payload) {
  const body = Array.isArray(payload) ? { events: payload } : payload;
  if (!body || typeof body !== "object")
    throw new ApiError(200, "Invalid event response");
  return {
    rawEvents: Array.isArray(body.events) ? body.events : [],
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    total: typeof body.total === "number" ? body.total : undefined,
  };
}

async function requestPage(query, cursor, signal) {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    limit: String(Math.min(query.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)),
  });
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`${API_BASE_URL}/events?${params}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      `Events service returned ${response.status}`,
    );
  return readResponse(await response.json());
}

export async function fetchEvents(query, signal) {
  const eventsById = new Map();
  let cursor = query.cursor ?? null;
  let total;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await requestPage(query, cursor, signal);
    total = result.total ?? total;
    result.rawEvents
      .map(normalizeEvent)
      .filter(Boolean)
      .forEach((event) => {
        if (event.id) eventsById.set(event.id, event);
      });

    if (!result.nextCursor || result.nextCursor === cursor) break;
    cursor = result.nextCursor;
  }

  return { events: [...eventsById.values()], nextCursor: cursor, total };
}

export async function fetchRoulette({ category = "all", window = "month", mode = "random", exclude = [] } = {}, signal) {
  const params = new URLSearchParams({ category, window, mode });
  if (exclude.length) params.set("exclude", exclude.join(","));
  const response = await fetch(`${API_BASE_URL}/roulette?${params}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new ApiError(response.status, `Roulette service returned ${response.status}`);
  const payload = await response.json();
  const event = normalizeEvent(payload?.event);
  if (!event) throw new ApiError(200, "Roulette returned an invalid event");
  return { event };
}
