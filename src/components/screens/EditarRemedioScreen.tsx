"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useReadyApp } from "@/components/AppData";
import { MedicationForm } from "@/components/MedicationForm";

function EditarRemedio() {
  const { id } = useParams<{ id: string }>();
  const { state } = useReadyApp();
  const medication = state.medications.find((m) => m.id === Number(id));

  if (!medication) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-3xl font-bold">Remédio não encontrado</h1>
        <Link href="/remedios" className="btn h-12 bg-white px-5 text-base">
          Voltar para Remédios
        </Link>
      </div>
    );
  }
  return <MedicationForm key={medication.id} medication={medication} />;
}

// `useParams` só tem valor em tempo de execução; o Suspense deixa o resto da rota ser pré-renderizado.
export function EditarRemedioScreen() {
  return (
    <Suspense fallback={null}>
      <EditarRemedio />
    </Suspense>
  );
}
