// In-memory store for tasks in flight between submit -> clarify -> confirm
// (spec Section 4.1's "observe/approve" turn-taking, over HTTP instead of
// the CLI's single blocking process). No new datastore — a plain Map in
// the web server's own process. Known v0 limitation: state is lost on
// restart and doesn't scale past one instance; acceptable since there's
// no state store built yet (spec Section 3's "in-flight workflow context"
// store is later infra).
const store = new Map();

export function create(id, data) {
  store.set(id, { ...data, lastActivityAt: Date.now() });
}

export function get(id) {
  return store.get(id);
}

export function update(id, patch) {
  const existing = store.get(id);
  if (!existing) return;
  store.set(id, { ...existing, ...patch, lastActivityAt: Date.now() });
}

export function remove(id) {
  store.delete(id);
}

export function entries() {
  return [...store.entries()];
}
