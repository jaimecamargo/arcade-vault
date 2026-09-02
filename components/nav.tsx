"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/lib/user-context";

function isActive(pathname: string, name: "biblioteca" | "salon" | "auth") {
  if (name === "biblioteca") return pathname === "/" || pathname.startsWith("/juegos");
  if (name === "salon") return pathname === "/salon";
  return pathname === "/auth";
}

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useUser();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive(pathname, "biblioteca") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isActive(pathname, "salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close} />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isActive(pathname, "biblioteca") ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/salon" className={isActive(pathname, "salon") ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/auth" className={isActive(pathname, "auth") ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
