/**
 * Contrato do Dabi Hub — v1.
 *
 * Cada sistema plugado no hub expõe, autenticado por `Authorization: Bearer <DABI_HUB_TOKEN>`:
 *
 *   GET /api/hub/v1/health    → HubHealth
 *   GET /api/hub/v1/overview  → HubOverview
 *
 * Gestão de contas (opcional; quem não implementa responde 404 e o hub mostra "não disponível"),
 * autenticada por OUTRO segredo, `Authorization: Bearer <DABI_HUB_ADMIN_TOKEN>`:
 *
 *   GET  /api/hub/v1/accounts?q=<busca>             → HubAccountList
 *   POST /api/hub/v1/accounts/<id>/actions          → HubAccountActionResult (corpo: HubAccountAction)
 *
 * O token de leitura NÃO vale nas rotas de contas e o de contas NÃO vale nas de leitura:
 * um monitor que só conhece o primeiro não vê e-mails nem bloqueia ninguém.
 *
 * Este arquivo é a fonte da verdade. Os sistemas guardam uma CÓPIA dele
 * (ex.: `src/lib/hub/hub-contract.ts`). Ao mudar o contrato, suba a versão e
 * atualize as cópias. Campos e rotas novos devem ser opcionais para não quebrar quem
 * ainda está na versão anterior.
 */

export const HUB_CONTRACT_VERSION = 1 as const;

export const HUB_PATHS = {
  health: "/api/hub/v1/health",
  overview: "/api/hub/v1/overview",
  accounts: "/api/hub/v1/accounts",
  accountActions: (accountId: string) => `/api/hub/v1/accounts/${encodeURIComponent(accountId)}/actions`,
} as const;

/** Limites da busca de contas. A busca vazia devolve as contas mais recentes. */
export const HUB_ACCOUNT_SEARCH = { queryMax: 60, limit: 25 } as const;
/** Limites da prorrogação de teste, em dias. */
export const HUB_TRIAL_EXTENSION = { minDays: 1, maxDays: 365 } as const;

export type HubStatus = "ok" | "degraded" | "down";

export type HubHealthCheck = {
  /** Ex.: "database", "email", "mercadopago". */
  name: string;
  status: "ok" | "fail";
  latencyMs?: number;
  /** Mensagem curta e sem segredos. */
  detail?: string;
};

export type HubHealth = {
  contract: typeof HUB_CONTRACT_VERSION;
  /** Slug do sistema, igual ao do registro no hub. */
  system: string;
  /** Versão ou commit do deploy em execução, quando disponível. */
  version: string | null;
  environment: string;
  status: HubStatus;
  checks: HubHealthCheck[];
  generatedAt: string;
};

export type HubMetricFormat = "number" | "currency-brl-cents" | "percent";

export type HubMetric = {
  key: string;
  label: string;
  value: number | null;
  format: HubMetricFormat;
  /** Texto auxiliar curto, ex.: "últimos 30 dias". */
  hint?: string;
  /** Sinaliza que o número pede atenção (pagamentos falhos, tickets abertos…). */
  attention?: boolean;
};

export type HubOverview = {
  contract: typeof HUB_CONTRACT_VERSION;
  system: string;
  generatedAt: string;
  /** Contas de clientes do sistema (usuários, workspaces, licenças — o que fizer sentido). */
  accounts: {
    total: number;
    active: number;
    new30d: number;
  };
  /** Presente quando o sistema cobra assinatura. Valores em centavos de BRL. */
  billing?: {
    mrrCents: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    failedPayments: number;
  };
  /** Presente quando o sistema tem atendimento/suporte. */
  support?: {
    open: number;
  };
  /** Indicadores específicos do sistema, exibidos como cartões no hub. */
  metrics: HubMetric[];
};

// ── Gestão de contas ─────────────────────────────────────────────

/**
 * - active:  pode usar o sistema.
 * - pending: cadastrada, mas ainda não entrou (convite/primeiro acesso).
 * - expired: o teste acabou (só sistemas com teste).
 * - blocked: acesso suspenso por um administrador.
 */
export type HubAccountStatus = "active" | "pending" | "expired" | "blocked";

/** Ações que o sistema aceita. O hub só mostra os botões das ações anunciadas aqui. */
export type HubAccountCapability = "block" | "extend-trial";

export type HubAccount = {
  /** Identificador estável no sistema (opaco para o hub). */
  id: string;
  email: string;
  name: string | null;
  status: HubAccountStatus;
  createdAt: string;
  lastAccessAt: string | null;
  /**
   * Só em sistemas com teste. `null` = sem prazo (licença permanente ou paga);
   * ausente = o sistema não tem teste.
   */
  trialEndsAt?: string | null;
  /** Dias de teste ainda não iniciados (o prazo só começa no primeiro acesso). */
  trialDaysPending?: number | null;
  /** Conta da equipe/administração: o hub não pode bloqueá-la. */
  protected: boolean;
};

export type HubAccountList = {
  contract: typeof HUB_CONTRACT_VERSION;
  system: string;
  generatedAt: string;
  capabilities: HubAccountCapability[];
  accounts: HubAccount[];
  /** Há mais resultados além dos devolvidos: refine a busca. */
  truncated: boolean;
};

/**
 * Corpo de POST /accounts/<id>/actions.
 * `actor` é o e-mail de quem agiu no hub; o sistema grava na própria auditoria.
 * Bloquear exige `confirmEmail` igual ao e-mail da conta, conferido NO SISTEMA.
 */
export type HubAccountAction =
  | { action: "block"; actor: string; confirmEmail: string }
  | { action: "unblock"; actor: string }
  | { action: "extend-trial"; actor: string; days: number };

export type HubAccountActionResult = {
  contract: typeof HUB_CONTRACT_VERSION;
  system: string;
  account: HubAccount;
  /** false quando a conta já estava no estado pedido (nada mudou). */
  changed: boolean;
};

/**
 * Erros das rotas de contas: status HTTP 4xx com corpo `{ error: HubAccountErrorCode, message: string }`.
 * `message` é curta, em português e sem segredos; o hub a mostra ao administrador.
 */
export type HubAccountErrorCode =
  | "INVALID_REQUEST"
  | "ACCOUNT_NOT_FOUND"
  | "CONFIRMATION_MISMATCH"
  | "PROTECTED_ACCOUNT"
  | "NOT_A_TRIAL"
  | "UNSUPPORTED_ACTION";
