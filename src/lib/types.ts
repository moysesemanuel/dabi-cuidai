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
  /** Endereço da foto (muda a cada troca). Sem foto, o app desenha o rostinho na cor da criança. */
  photoUrl?: string;
  /** Data civil "AAAA-MM-DD". */
  birthDate?: string;
  /** Nasceu prematuro? Sem valor: não informado. */
  premature?: "yes" | "no";
  /** Idade gestacional ao nascer, só quando prematuro. */
  gestationalAge?: { weeks: number; days: number };
}

/** Campos que a família pode mudar numa criança. `null` apaga o valor. */
export interface ChildPatch {
  name?: string;
  fill?: string;
  birthDate?: string | null;
  premature?: "yes" | "no" | null;
  gestationalAge?: { weeks: number; days: number } | null;
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

/** Uma dose no histórico, com o remédio como era quando a dose foi agendada. */
export interface DoseHistoryItem {
  id: number;
  childId: number;
  medicationId: number;
  medName: string;
  doseText: string;
  scheduledAt: number;
  status: DoseStatus;
  /** Quando alguém tocou em "Já dei". Sem isso e com status "given", a dose veio da versão antiga. */
  givenAt?: number;
  /** O remédio foi removido da lista depois; a dose continua no histórico. */
  medicationRemoved: boolean;
}

export interface NewMedication {
  childId: number;
  name: string;
  doseText: string;
  intervalMinutes: number;
  firstDoseAt: number;
  days: number;
}

/** Um registro do diário de saúde: o que a família observou, sem interpretação do app. */
export interface HealthEntry {
  id: number;
  childId: number;
  /** Quando aconteceu (pode ser diferente de quando foi registrado). */
  occurredAt: number;
  /** Temperatura medida, em °C com uma casa decimal. */
  temperature?: number;
  symptoms: string[];
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface HealthEntryInput {
  childId: number;
  occurredAt: number;
  temperature: number | null;
  symptoms: string[];
  note: string;
}

/** Sintomas oferecidos como atalho. A família pode escrever outros. */
export const COMMON_SYMPTOMS = [
  "Tosse",
  "Coriza",
  "Nariz entupido",
  "Vômito",
  "Diarreia",
  "Dor de barriga",
  "Dor de ouvido",
  "Dor de garganta",
  "Manchas na pele",
  "Sem apetite",
  "Mais sonolento",
  "Mais irritado",
] as const;

/** Tudo que as telas precisam, vindo do servidor. */
export interface AppState {
  familyCode: string;
  deviceId: string;
  /** Nome de quem usa este aparelho ("Ana"), para a saudação. Cada responsável põe o seu. */
  deviceName?: string;
  deviceCount: number;
  /** Quantos celulares da família têm os avisos ligados. */
  pushDeviceCount: number;
  children: Child[];
  medications: Medication[];
  /** Doses de ontem à noite até o fim de hoje (ver `dayStart` na requisição). */
  doses: DoseEvent[];
}
