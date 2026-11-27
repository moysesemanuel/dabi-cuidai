"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Erro que derruba o layout raiz: registra no Sentry e mostra uma tela simples para tentar de novo.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ padding: "48px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h1>Algo deu errado.</h1>
          <p>Já fomos avisados. Tente novamente em instantes.</p>
          <button onClick={() => reset()} style={{ marginTop: "16px" }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
