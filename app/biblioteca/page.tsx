import { createClient } from "@/lib/supabase/server";
import LibraryScreen from "@/components/library-screen";

export default async function Biblioteca() {
  const supabase = await createClient();

  const [{ data: games }, { data: scores }] = await Promise.all([
    supabase.from("games").select("*").order("created_at"),
    supabase.from("scores").select("game_id, score"),
  ]);

  const bestByGame = new Map<string, number>();
  for (const s of scores ?? []) {
    const current = bestByGame.get(s.game_id);
    if (current === undefined || s.score > current) bestByGame.set(s.game_id, s.score);
  }

  const gamesWithBest = (games ?? []).map((g) => ({
    ...g,
    best: bestByGame.get(g.id) ?? null,
  }));

  return <LibraryScreen games={gamesWithBest} />;
}
