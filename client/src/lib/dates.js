export const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const calendarDateKey = (value) => {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : iso(value);

  const text = String(value ?? "").trim(),
    match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(text);
  return match ? match[1] : null;
};
export const monthBounds = (date) => ({
  from: iso(new Date(date.getFullYear(), date.getMonth(), 1)),
  to: iso(new Date(date.getFullYear(), date.getMonth() + 1, 1)),
});
export const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(d);
};
