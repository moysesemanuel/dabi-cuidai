"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { syncPush } from "@/lib/push";
import { GearIcon, HomeIcon, Logo, MedIcon } from "./Art";
import { AppDataProvider, useApp } from "./AppData";
import { Welcome } from "./Welcome";

const NAV = [
  { href: "/", label: "Hoje", Icon: HomeIcon },
  { href: "/remedios", label: "Remédios", Icon: MedIcon },
  { href: "/ajustes", label: "Ajustes", Icon: GearIcon },
];

/** Links de navegação. Ficam isolados porque `usePathname` precisa de um <Suspense> em rotas dinâmicas. */
function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  // O cadastro de remédio pertence à aba Remédios.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/remedios" && pathname === "/novo");

  return NAV.map(({ href, label, Icon }) => {
    const active = isActive(href);
    if (variant === "side") {
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={
            "flex h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold " +
            (active ? "bg-brand text-[#ffffff]" : "text-ink-soft")
          }
        >
          <Icon />
          {label}
        </Link>
      );
    }
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex h-full flex-1 items-center justify-center"
      >
        <span
          className={
            "flex h-[3.6rem] w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold " +
            (active ? "bg-brand text-[#ffffff]" : "text-ink")
          }
        >
          <Icon />
          {label}
        </span>
      </Link>
    );
  });
}

/** Moldura do app. Antes de haver sessão, mostra só o carregamento ou a tela de entrada. */
function Frame({ children }: { children: React.ReactNode }) {
  const { status, retry } = useApp();
  useEffect(() => {
    if (status === "ready") syncPush().catch(() => {});
  }, [status]);
  if (status === "loading") return null;
  if (status === "signed-out") return <Welcome />;
  if (status === "unavailable") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <Logo size={36} />
        <h1 className="text-2xl font-extrabold">Não consegui carregar</h1>
        <p className="text-ink-soft">Confira a internet e tente de novo.</p>
        <button onClick={retry} className="btn btn-brand h-14 text-lg">Tentar de novo</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-white p-5 lg:flex">
        <div className="px-2 pt-2">
          <Logo size={34} />
        </div>
        <nav className="flex flex-col gap-2" aria-label="Principal">
          <Suspense fallback={null}>
            <NavLinks variant="side" />
          </Suspense>
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-md px-5 pb-32 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-8">{children}</main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[84px] items-stretch rounded-t-3xl border-t border-line bg-white px-3 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_rgb(28_58_62/0.06)] lg:hidden"
      >
        <Suspense fallback={null}>
          <NavLinks variant="bottom" />
        </Suspense>
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Em desenvolvimento o próprio sw.js não guarda nada em cache; ele só trata os avisos.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <AppDataProvider>
      <Frame>{children}</Frame>
    </AppDataProvider>
  );
}
