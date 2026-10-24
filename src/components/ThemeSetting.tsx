"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const OPTIONS: { id: Theme; label: string }[] = [
  { id: "system", label: "Do celular" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
];

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("tema");
    else localStorage.setItem("tema", theme);
  } catch {
    // sem localStorage: o tema vale só até fechar o app
  }
}

/** Escolha da aparência: segue o celular ou força claro/escuro. */
export function ThemeSetting() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  return (
    <section aria-labelledby="aparencia" className="flex flex-col gap-2">
      <h2 id="aparencia" className="group-label">Aparência</h2>
      <div className="card flex flex-col gap-3 p-4">
        <div>
          <p className="text-base font-semibold">Tema</p>
          <p className="text-sm text-ink-soft">Seguir o celular ou escolher claro ou escuro.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-track p-1" role="group" aria-label="Tema do app">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              aria-pressed={theme === o.id}
              onClick={() => {
                setTheme(o.id);
                apply(o.id);
              }}
              className={
                "h-10 flex-1 rounded-[0.65rem] text-[15px] font-semibold " +
                (theme === o.id ? "bg-white text-accent shadow-sm" : "text-ink-soft")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
