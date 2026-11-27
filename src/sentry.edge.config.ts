import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://19febee5b2b669137454b7f88c33cdcf@o4511998804819968.ingest.us.sentry.io/4512503800725504",
  // Em desenvolvimento nada vai para o Sentry.
  enabled: process.env.NODE_ENV !== "development",
  tracesSampleRate: 0.1,
});
