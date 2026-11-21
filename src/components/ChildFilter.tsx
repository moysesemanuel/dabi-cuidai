"use client";

import { Avatar, FamilyIcon } from "./Art";
import type { Child } from "@/lib/types";

/** Pílulas "Todos / Davi / Bianca" para filtrar por criança. Some quando há só uma criança. */
export function ChildFilter({
  label,
  kids,
  value,
  onChange,
}: {
  label: string;
  kids: Child[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  if (kids.length < 2) return null;
  return (
    <div>
      <p className="mb-2 text-[15px] font-bold">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        <button onClick={() => onChange(null)} aria-pressed={value === null} className="chip">
          <FamilyIcon size={20} />
          Todos
        </button>
        {kids.map((k) => (
          <button key={k.id} onClick={() => onChange(k.id)} aria-pressed={value === k.id} className="chip pl-1.5">
            <Avatar fill={k.fill} photo={k.photoUrl} size={28} />
            {k.name}
          </button>
        ))}
      </div>
    </div>
  );
}
