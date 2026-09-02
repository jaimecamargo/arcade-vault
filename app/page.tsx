export default function Home() {
  return (
    <section className="av-hero">
      <h1 className="pixel flicker">Arcade Vault</h1>
      <p className="sub">
        <span className="neon-cyan">Jugá</span>
        {" · "}
        <span className="neon-magenta">Competí</span>
        {" · "}
        <span className="neon-yellow">Dominá el ranking</span>
        <span className="blink">_</span>
      </p>
      <div className="detail-actions" style={{ justifyContent: "center", marginTop: 32 }}>
        <button className="btn xl pulse" type="button">
          Entrar al salón
        </button>
        <button className="btn ghost xl" type="button">
          Ver juegos
        </button>
      </div>
    </section>
  );
}
