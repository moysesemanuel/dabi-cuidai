import { AppShell } from "@/components/AppShell";

// Telas do app: moldura, navegação e a sessão da família. Páginas públicas (como /privacidade) ficam fora deste grupo.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
