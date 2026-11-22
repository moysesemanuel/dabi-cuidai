"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GrowthForm } from "@/components/GrowthForm";
import { api, ApiError } from "@/lib/api";
import type { GrowthMeasurement } from "@/lib/growth";

function NovaMedicao() {
  const crianca = Number(useSearchParams().get("crianca"));
  return <GrowthForm initialChildId={Number.isSafeInteger(crianca) && crianca > 0 ? crianca : undefined} />;
}

function EditarMedicao() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{ id: string; measurement?: GrowthMeasurement; error?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ measurement: GrowthMeasurement }>("GET", `/api/growth/${encodeURIComponent(id)}`)
      .then(({ measurement }) => alive && setResult({ id, measurement }))
      .catch((err) => alive && setResult({ id, error: err instanceof ApiError ? err.message : "Não foi possível carregar." }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!result || result.id !== id) return null;
  if (!result.measurement) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-3xl font-extrabold">{result.error ?? "Medição não encontrada"}</h1>
        <Link href="/diario/crescimento" className="btn btn-outline h-12 px-5 text-base">
          Voltar para o Crescimento
        </Link>
      </div>
    );
  }
  return <GrowthForm key={result.measurement.id} measurement={result.measurement} />;
}

// `useParams` e `useSearchParams` só têm valor em tempo de execução; o Suspense deixa o resto ser pré-renderizado.
export function NovaMedicaoScreen() {
  return (
    <Suspense fallback={null}>
      <NovaMedicao />
    </Suspense>
  );
}

export function EditarMedicaoScreen() {
  return (
    <Suspense fallback={null}>
      <EditarMedicao />
    </Suspense>
  );
}
