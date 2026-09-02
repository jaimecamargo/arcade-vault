const STORAGE_KEY = "av_scores";

export type ScoreEntry = { game: string; score: number; name: string };
export type StoredScore = ScoreEntry & { at: number };

export function saveScore(entry: ScoreEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: StoredScore[] = raw ? JSON.parse(raw) : [];
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
