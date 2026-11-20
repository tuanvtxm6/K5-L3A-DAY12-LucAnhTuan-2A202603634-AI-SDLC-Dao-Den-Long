// Local leaderboard rules (Ticket-04 §3). Pure: storage lives in scripts/serve.js (disk) / web fallback.
export const MAX_ENTRIES = 10;

// 3-12 characters of [A-Za-z0-9_]; Vietnamese letters with diacritics are also accepted (bonus).
export function validName(name) {
  if (typeof name !== 'string') return false;
  const n = name.normalize('NFC');
  const len = [...n].length;
  return len >= 3 && len <= 12 && /^[\p{L}\p{M}\p{N}_]+$/u.test(n);
}

// ISO 8601 with the local UTC offset, e.g. 2026-11-20T16:05:09+07:00
export function isoWithOffset(date = new Date()) {
  const pad = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}

export function validEntry(e) {
  return e && validName(e.name) && Number.isInteger(e.score) && e.score >= 0
    && Number.isInteger(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3
    && typeof e.achieved_at === 'string' && !Number.isNaN(Date.parse(e.achieved_at)) && Number.isInteger(e.seed);
}

// score desc; equal score -> whoever achieved it first stays above (stable for equal times too)
export function sortEntries(entries) {
  return entries
    .map((e, i) => [e, i])
    .sort(([a, i], [b, j]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || i - j)
    .map(([e]) => e);
}

export function addEntry(entries, entry) {
  if (!validEntry(entry)) throw new Error('invalid leaderboard entry');
  const clean = { name: entry.name.normalize('NFC'), score: entry.score, nights_won: entry.nights_won, achieved_at: entry.achieved_at, seed: entry.seed };
  const all = sortEntries([...entries, clean]);
  return { entries: all.slice(0, MAX_ENTRIES), rank: all.indexOf(clean) + 1 };
}
