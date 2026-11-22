"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Avatar, ChevronIcon, Mascot, PlusIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { DiaryTabs } from "@/components/DiaryTabs";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePolled } from "@/hooks/usePolled";
import { parseCivilDate } from "@/lib/age";
import { api } from "@/lib/api";
import { CATEGORIES, fmtMilestoneDate, milestoneAge, type Milestone } from "@/lib/milestones";

/** A linha mostra os mais recentes; o resto abre em "Ver todos". */
const SHOWN = 5;

export function MarcosScreen() {
  const { state } = useReadyApp();
  const kids = state.children;
  const [childId, setChildId] = useState<number>(kids[0]?.id ?? 0);
  const [showAll, setShowAll] = useState(false);
  const child = kids.find((k) => k.id === childId) ?? kids[0];

  const fetcher = useCallback(
    () =>
      api<{ milestones: Milestone[] }>("GET", `/api/milestones?childId=${child.id}`).then((r) => ({
        childId: child.id,
        list: r.milestones,
      })),
    [child.id],
  );
  const { data, error } = usePolled(fetcher, "Não foi possível carregar os marcos.");
  const list = data?.childId === child.id ? data.list : null;

  const birth = child.birthDate ? parseCivilDate(child.birthDate) : null;
  const premature = child.premature === "yes";
  const visible = list && !showAll ? list.slice(0, SHOWN) : list;
  const newHref = `/diario/marcos/novo?crianca=${child.id}`;

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Diário"
        action={
          <Link href={newHref} aria-label="Novo marco" className="appbar-btn">
            <PlusIcon size={26} />
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <DiaryTabs current="/diario/marcos" />

        {kids.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Criança">
            {kids.map((k) => (
              <button
                key={k.id}
                type="button"
                className="chip pl-1.5"
                aria-pressed={k.id === child.id}
                onClick={() => {
                  setChildId(k.id);
                  setShowAll(false);
                }}
              >
                <Avatar fill={k.fill} photo={k.photoUrl} size={28} />
                {k.name}
              </button>
            ))}
          </div>
        )}

        {error && !list && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 font-bold">
            {error}
          </p>
        )}

        {list && list.length === 0 && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <Mascot size={120} />
            <h2 className="text-xl font-extrabold">Os momentos de {child.name}</h2>
            <p className="text-ink-soft">
              Guarde o primeiro sorriso, os primeiros passos, a primeira palavra… com a data exata ou só o mês.
            </p>
            <Link href={newHref} className="btn btn-primary h-14 px-6 text-lg">
              <PlusIcon size={22} /> Novo marco
            </Link>
          </section>
        )}

        {visible && visible.length > 0 && (
          <section aria-label={`Marcos de ${child.name}`}>
            <ol className="relative flex flex-col gap-3 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-0.5 before:bg-line">
              {visible.map((m) => {
                const age = milestoneAge(m.happenedOn, m.precision, birth, premature, child.gestationalAge);
                const category = CATEGORIES.find((c) => c.value === m.category)?.label;
                return (
                  <li key={m.id} className="relative pl-8">
                    <span
                      aria-hidden="true"
                      className="absolute left-[5px] top-4 size-3.5 rounded-full border-[3px] border-paper bg-brand ring-2 ring-brand/30"
                    />
                    <Link href={`/diario/marcos/${m.id}`} className="card flex items-center gap-3 p-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-base font-extrabold leading-snug">{m.title}</span>
                        <span className="mt-0.5 block text-sm font-semibold text-ink-soft">
                          {fmtMilestoneDate(m.happenedOn, m.precision)}
                          {age ? ` · ${age}` : ""}
                        </span>
                        {(category || m.note) && (
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {category && (
                              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-extrabold">{category}</span>
                            )}
                            {m.note && <span className="line-clamp-2 text-sm leading-snug">{m.note}</span>}
                          </span>
                        )}
                      </span>
                      <span className="text-ink-soft">
                        <ChevronIcon />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {list && list.length > SHOWN && (
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 h-11 w-full rounded-2xl border-[1.5px] border-dashed border-line text-[15px] font-extrabold text-brand"
              >
                {showAll ? "Mostrar só os mais recentes" : `Ver todos os ${list.length} marcos`}
              </button>
            )}
          </section>
        )}

        {list && list.length > 0 && (
          <p className="text-center text-sm leading-snug text-ink-soft">
            Os marcos são lembranças registradas pela família. Cada criança tem o seu ritmo: o app não compara crianças
            nem avalia o desenvolvimento.
          </p>
        )}
      </div>
    </div>
  );
}
