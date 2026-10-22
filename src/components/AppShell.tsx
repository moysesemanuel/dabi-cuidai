"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { syncPush } from "@/lib/push";
import { Mascot } from "./Art";
import { AppDataProvider, useApp } from "./AppData";
import { ImportBanner } from "./ImportBanner";
import { Welcome } from "./Welcome";

const NAV = [
  {
    href: "/",
    label: "Hoje",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    href: "/remedios",
    label: "Remédios",
    icon: (
      <>
        <rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-35 12 12.5)" />
        <path d="M10.2 7.6l5.2 7.4" />
      </>
    ),
  },
  {
    href: "/ajustes",
    label: "Ajustes",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </>
    ),
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Links de navegação. Ficam isolados porque `usePathname` precisa de um <Suspense> em rotas dinâmicas. */
function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return NAV.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={
        variant === "side"
          ? "flex h-12 items-center gap-3 rounded-2xl px-4 text-base " +
            (isActive(item.href)
              ? "border-[2.5px] border-ink bg-sun font-semibold shadow-[0_3px_0_var(--color-ink)]"
              : "font-medium text-ink-soft")
          : "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[13px] " +
            (isActive(item.href) ? "border-[2.5px] border-ink bg-sun font-semibold" : "font-medium text-ink-soft")
      }
    >
      <Icon>{item.icon}</Icon>
      {item.label}
    </Link>
  ));
}

function Banners() {
  const { offline } = useApp();
  return (
    <>
      {offline && (
        <p role="status" className="mb-4 rounded-2xl border-[2.5px] border-ink bg-blush p-2.5 text-sm font-semibold">
          Sem conexão: mostrando o que já estava na tela. Os avisos só chegam com internet.
        </p>
      )}
      <ImportBanner />
    </>
  );
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
        <h1 className="text-2xl font-bold">Não consegui carregar</h1>
        <p className="text-ink-soft">Confira a internet e tente de novo.</p>
        <button onClick={retry} className="btn h-14 bg-sun text-lg">Tentar de novo</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r-[3px] border-ink bg-white p-5 lg:flex">
        <div className="flex items-center gap-2">
          <Mascot size={48} />
          <div className="text-xl font-bold leading-tight">
            Hora do
            <br />
            remedinho
          </div>
        </div>
        <nav className="flex flex-col gap-2" aria-label="Principal">
          <Suspense fallback={null}>
            <NavLinks variant="side" />
          </Suspense>
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-md px-5 pb-32 pt-6 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-8">
        <Banners />
        {children}
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[76px] items-center gap-1.5 border-t-[3px] border-ink bg-white px-3 lg:hidden"
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
