"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MilestoneForm } from "@/components/MilestoneForm";
import { api, ApiError } from "@/lib/api";
import type { Milestone } from "@/lib/milestones";

function NovoMarco() {
  const crianca = Number(useSearchParams().get("crianca"));
  return <MilestoneForm initialChildId={Number.isSafeInteger(crianca) && crianca > 0 ? crianca : undefined} />;
}

function EditarMarco() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{ id: string; milestone?: Milestone; error?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ milestone: Milestone }>("GET", `/api/milestones/${encodeURIComponent(id)}`)
      .then(({ milestone }) => alive && setResult({ id, milestone }))
      .catch((err) => alive && setResult({ id, error: err instanceof ApiError ? err.message : "Não foi possível carregar." }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!result || result.id !== id) return null;
  if (!result.milestone) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-3xl font-extrabold">{result.error ?? "Marco não encontrado"}</h1>
        <Link href="/diario/marcos" className="btn btn-outline h-12 px-5 text-base">
          Voltar para os Marcos
        </Link>
      </div>
    );
  }
  return <MilestoneForm key={result.milestone.id} milestone={result.milestone} />;
}

// `useParams` e `useSearchParams` só têm valor em tempo de execução; o Suspense deixa o resto ser pré-renderizado.
export function NovoMarcoScreen() {
  return (
    <Suspense fallback={null}>
      <NovoMarco />
    </Suspense>
  );
}

export function EditarMarcoScreen() {
  return (
    <Suspense fallback={null}>
      <EditarMarco />
    </Suspense>
  );
}
