import * as Sentry from "@sentry/nextjs";

// Erros do navegador vão para o Sentry (projeto dabi-cuidai), que avisa por e-mail e pelo app.
// O DSN é público por natureza (vai no JavaScript do site); NEXT_PUBLIC_SENTRY_DSN sobrescreve.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://19febee5b2b669137454b7f88c33cdcf@o4511998804819968.ingest.us.sentry.io/4512503800725504",
  // Em desenvolvimento nada vai para o Sentry: HMR e erros de hidratação só geram ruído.
  enabled: process.env.NODE_ENV !== "development",
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
