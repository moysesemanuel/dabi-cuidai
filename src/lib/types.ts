export const CHILD_COLORS = [
  { id: "coral", fill: "#FFAFA3", label: "Coral" },
  { id: "sky", fill: "#8FD0FF", label: "Azul" },
  { id: "mint", fill: "#7BE0B5", label: "Verde" },
  { id: "lilac", fill: "#C9B8FF", label: "Roxo" },
  { id: "sun", fill: "#FFD54A", label: "Amarelo" },
] as const;

export interface Child {
  id: number;
  name: string;
  fill: string;
}

export interface Medication {
  id: number;
  childId: number;
  name: string;
  /** Texto livre, como está na receita. O app nunca calcula nem sugere dose. */
  doseText: string;
  intervalMinutes: number;
  firstDoseAt: number;
  days: number;
  createdAt: number;
}

export type DoseStatus = "pending" | "given";

export interface DoseEvent {
  id: number;
  medicationId: number;
  scheduledAt: number;
  status: DoseStatus;
  givenAt?: number;
}

export interface NewMedication {
  childId: number;
  name: string;
  doseText: string;
  intervalMinutes: number;
  firstDoseAt: number;
  days: number;
}

/** Tudo que as telas precisam, vindo do servidor. */
export interface AppState {
  familyCode: string;
  deviceId: string;
  deviceCount: number;
  /** Quantos celulares da família têm os avisos ligados. */
  pushDeviceCount: number;
  children: Child[];
  medications: Medication[];
  /** Doses de ontem à noite até o fim de hoje (ver `dayStart` na requisição). */
  doses: DoseEvent[];
}
