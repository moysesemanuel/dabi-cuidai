"use client";

import Link from "next/link";

const TABS = [
  { href: "/diario", label: "Registros" },
  { href: "/diario/crescimento", label: "Crescimento" },
  { href: "/diario/marcos", label: "Marcos" },
  { href: "/diario/resumo", label: "Resumo" },
] as const;

/** Abas internas do Diário. */
export function DiaryTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Seções do diário" className="grid grid-cols-4 gap-1 rounded-2xl bg-field p-1">
      {TABS.map((t) => {
        const on = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={
              "truncate rounded-xl px-0.5 py-2 text-center text-[12.5px] font-extrabold tracking-tight sm:text-[15px] sm:tracking-normal " +
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
