import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GamePlayerScreen from "@/components/game-player-screen";

export default async function GamePlayerPage(props: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: game } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (!game) notFound();

  return <GamePlayerScreen game={game} />;
}
