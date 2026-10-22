import { MedicationForm } from "@/components/MedicationForm";

// A tela depende da sessão do aparelho (carregada no cliente), então não há o que validar como navegação instantânea.
export const instant = false;

export default function Page() {
  return <MedicationForm />;
}
