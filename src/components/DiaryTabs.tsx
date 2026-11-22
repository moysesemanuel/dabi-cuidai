"use client";

import Link from "next/link";

const TABS = [
  { href: "/diario", label: "Registros" },
  { href: "/diario/crescimento", label: "Crescimento" },
  { href: "/diario/marcos", label: "Marcos" },
] as const;

/** Abas internas do Diário. O Resumo entra aqui quando ficar pronto. */
export function DiaryTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Seções do diário" className="grid grid-cols-3 gap-1 rounded-2xl bg-field p-1">
      {TABS.map((t) => {
        const on = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={
              "rounded-xl py-2 text-center text-[15px] font-extrabold " +
              (on ? "bg-white text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]" : "text-ink-soft")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
