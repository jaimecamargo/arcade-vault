import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function GameDetailPage(props: PageProps<"/juegos/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: game } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (!game) notFound();

  const { data: scores } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", id)
    .order("score", { ascending: false })
    .limit(10);

  const rows = scores ?? [];
  const best = rows[0]?.score ?? null;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Mejor global</div>
              <div className="v" style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>
                {best !== null ? best.toLocaleString("es-ES") : "—"}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/juegos/${game.id}/jugar`}>
              ▶ JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/biblioteca">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {rows.length === 0 ? (
            <div style={{ padding: "24px 8px", color: "var(--ink-faint)", textAlign: "center" }}>
              Sé el primero en entrar al salón de la fama
            </div>
          ) : (
            rows.map((r, i) => (
              <div key={r.id} className={"lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">
                  {r.player_name}
                  <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                    {new Date(r.created_at).toLocaleDateString("es-ES")}
                  </div>
                </div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
