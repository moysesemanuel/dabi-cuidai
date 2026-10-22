import Dexie from "dexie";
import type { Child, DoseEvent, Medication } from "./types";

/**
 * Banco local da versão antiga do app (antes dos dados irem para o servidor).
 * Só é lido uma vez, para importar os remédios que já estavam neste aparelho.
 */
const LEGACY_DB = "lembrete-remedios";

export interface LegacyData {
  children: Child[];
  medications: Medication[];
  doses: DoseEvent[];
}

function openLegacy(): Dexie {
  const legacy = new Dexie(LEGACY_DB);
  legacy.version(1).stores({
    children: "++id",
    medications: "++id, childId",
    doses: "++id, medicationId, scheduledAt, status",
  });
  return legacy;
}

/** Devolve os dados locais antigos, ou null se não há remédio nenhum para importar. */
export async function readLegacyData(): Promise<LegacyData | null> {
  if (!(await Dexie.exists(LEGACY_DB))) return null;
  const legacy = openLegacy();
  try {
    const [children, medications, doses] = await Promise.all([
      legacy.table<Child>("children").toArray(),
      legacy.table<Medication>("medications").toArray(),
      legacy.table<DoseEvent>("doses").toArray(),
    ]);
    return medications.length > 0 ? { children, medications, doses } : null;
  } finally {
    legacy.close();
  }
}
