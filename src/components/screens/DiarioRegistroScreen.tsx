"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { HealthEntryForm } from "@/components/HealthEntryForm";
import { api, ApiError } from "@/lib/api";
import type { HealthEntry } from "@/lib/types";

function NovoRegistro() {
  const crianca = Number(useSearchParams().get("crianca"));
  return <HealthEntryForm initialChildId={Number.isSafeInteger(crianca) && crianca > 0 ? crianca : undefined} />;
}

function EditarRegistro() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{ id: string; entry?: HealthEntry; error?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ entry: HealthEntry }>("GET", `/api/diary/${encodeURIComponent(id)}`)
      .then(({ entry }) => alive && setResult({ id, entry }))
      .catch((err) => alive && setResult({ id, error: err instanceof ApiError ? err.message : "Não foi possível carregar." }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!result || result.id !== id) return null;
  if (!result.entry) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-3xl font-extrabold">{result.error ?? "Registro não encontrado"}</h1>
        <Link href="/diario" className="btn btn-outline h-12 px-5 text-base">
          Voltar para o Diário
        </Link>
      </div>
    );
  }
  return <HealthEntryForm key={result.entry.id} entry={result.entry} />;
}

// `useParams` e `useSearchParams` só têm valor em tempo de execução; o Suspense deixa o resto ser pré-renderizado.
export function NovoRegistroScreen() {
  return (
    <Suspense fallback={null}>
      <NovoRegistro />
    </Suspense>
  );
}

export function EditarRegistroScreen() {
  return (
    <Suspense fallback={null}>
      <EditarRegistro />
    </Suspense>
  );
}
