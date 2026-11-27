import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cuidaí Kids",
  description: "Lembrete de remédios para a saúde das crianças.",
  applicationName: "Cuidaí Kids",
  appleWebApp: { capable: true, title: "Cuidaí Kids", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // A barra de status acompanha a faixa verde do topo das telas.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F6E6C" },
    { media: "(prefers-color-scheme: dark)", color: "#2A9D96" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema escolhido antes da primeira pintura, para a tela não piscar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        {/* Contagem de visitas e páginas (Vercel Web Analytics, sem cookies), lida pelo Dabi Hub. */}
        <Analytics />
      </body>
    </html>
  );
}
