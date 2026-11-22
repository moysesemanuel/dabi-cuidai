"use client";

import { useState } from "react";
import { AsNeededForm, MedicationKindSwitch } from "@/components/AsNeeded";
import { MedicationForm } from "@/components/MedicationForm";

/** Novo remédio: com horário fixo (gera horários e avisos) ou "se necessário" (registra quando der). */
export function NovoRemedioScreen() {
  const [kind, setKind] = useState<"scheduled" | "as_needed">("scheduled");
  const top = <MedicationKindSwitch value={kind} onChange={setKind} />;
  return kind === "scheduled" ? <MedicationForm top={top} /> : <AsNeededForm top={top} />;
}
