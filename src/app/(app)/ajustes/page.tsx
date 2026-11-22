import { redirect } from "next/navigation";

// "Ajustes" virou "Perfil". Mantém o endereço antigo para atalhos e avisos que ainda apontam para ele.
export default function Page() {
  redirect("/perfil");
}
