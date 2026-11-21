"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon } from "./Art";
import { Banners } from "./Banners";

/**
 * Barra verde do topo de cada tela, com os avisos gerais (sem conexão, importar) logo abaixo.
 * Com `back`, mostra a seta de voltar e centraliza o título, como no cadastro de remédio.
 */
export function ScreenHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <>
      <header className="appbar">
        {back && (
          <Link href={back} aria-label="Voltar" className="appbar-btn -ml-2">
            <BackIcon />
          </Link>
        )}
        <h1 className={"min-w-0 flex-1 truncate font-display text-[1.6rem] font-semibold " + (back ? "text-center" : "")}>
          {title}
        </h1>
        {back ? <span className="w-10 shrink-0" aria-hidden="true" /> : action}
      </header>
      <Banners />
    </>
  );
}
