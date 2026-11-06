/** Local calendar date as YYYY-MM-DD, used as the day file name. */
function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's list from the previous day's: unticked items with text, and the notes, carry over. */
function startDay(previous) {
  return {
    items: (previous?.items ?? []).filter((i) => !i.done && i.text.trim()),
    notes: previous?.notes ?? '',
  };
}

/** Add an empty linked row for every session that has none. Returns the same day if unchanged. */
function syncSessions(day, sessionIds, newId) {
  const linked = new Set(day.items.map((i) => i.sessionId));
  const missing = sessionIds.filter((id) => !linked.has(id));
  if (!missing.length) return day;
  const added = missing.map((sessionId) => ({ id: newId(), text: '', done: false, sessionId }));
  return { ...day, items: [...day.items, ...added] };
}

/**
 * The `n` most urgent open TODOs with text: higher urgency first, then oldest first.
 * Items without an urgency rank below urgency 1. List order is age order.
 */
function topTodos(items, n) {
  return items
    .map((item, age) => ({ item, age }))
    .filter(({ item }) => !item.done && item.text.trim())
    .sort((a, b) => (b.item.urgency ?? 0) - (a.item.urgency ?? 0) || a.age - b.age)
    .slice(0, n)
    .map(({ item }) => item);
}

/** Link a Done TODO to its reopened session and move it back to the open list. */
function linkReopened(day, itemId, sessionId) {
  return {
    ...day,
    items: day.items.map((i) => {
      if (i.id !== itemId) return i;
      const { closedSession, ...rest } = i;
      return { ...rest, done: false, sessionId };
    }),
  };
}

// Also loaded as a plain script in the window, where `module` does not exist.
if (typeof module !== 'undefined') {
  module.exports = { dayKey, startDay, syncSessions, topTodos, linkReopened };
}
