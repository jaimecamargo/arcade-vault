import { createClient } from "@/lib/supabase/server";
import HallOfFameScreen from "@/components/hall-of-fame-screen";

export default async function Salon() {
  const supabase = await createClient();
  const { data: games } = await supabase.from("games").select("*").order("created_at");

  return <HallOfFameScreen games={games ?? []} />;
}
