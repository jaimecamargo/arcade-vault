import { createClient } from "@/lib/supabase/server";
import HomeScreen from "@/components/home-screen";

export default async function Home() {
  const supabase = await createClient();
  const { data: games } = await supabase.from("games").select("*").order("created_at");

  return <HomeScreen games={games ?? []} />;
}
