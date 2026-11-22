"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, CameraIcon } from "@/components/Art";
import { ChildBirthFields } from "@/components/ChildProfile";
import { FamilyAccess, FamilyData } from "@/components/FamilyAccess";
import { PhotoCropper } from "@/components/PhotoCropper";
import { ApiError } from "@/lib/api";
import { useReadyApp } from "@/components/AppData";
import { PushSettings } from "@/components/PushSettings";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ThemeSetting } from "@/components/ThemeSetting";
import { CHILD_COLORS, type Child } from "@/lib/types";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function PerfilScreen() {
  const { state, now, actions } = useReadyApp();
  const kids = state.children;
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Perfil" />
      <div className="flex flex-col gap-6">
      <section aria-labelledby="voce-titulo" id="voce" className="flex scroll-mt-4 flex-col gap-2">
        <h2 id="voce-titulo" className="group-label">Você</h2>
        <div className="card flex flex-col gap-1 p-4">
          <label htmlFor="meu-nome" className="text-sm font-semibold text-ink-soft">Seu nome</label>
          <input
            id="meu-nome"
            className="field"
            defaultValue={state.deviceName ?? ""}
            placeholder="Ex.: Ana"
            maxLength={30}
            autoComplete="given-name"
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name !== (state.deviceName ?? "")) {
                actions.setDeviceName(name).catch(() => (e.target.value = state.deviceName ?? ""));
              }
            }}
          />
          <p className="text-sm text-ink-soft">Aparece na saudação do Início. Cada celular da família tem o seu.</p>
        </div>
      </section>

      <section aria-labelledby="bebes" className="flex flex-col gap-2">
        <h2 id="bebes" className="group-label">Minhas crianças</h2>
        {kids.map((k) => (
          <div key={k.id} id={`crianca-${k.id}`} className="card flex scroll-mt-4 flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <ChildPhoto child={k} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={`nome-${k.id}`} className="text-sm font-semibold text-ink-soft">Nome da criança</label>
                <input
                  id={`nome-${k.id}`}
                  className="field"
                  defaultValue={k.name}
                  placeholder="Ex.: Davi, Bianca"
                  maxLength={30}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== k.name) actions.updateChild(k.id, { name }).catch(() => (e.target.value = k.name));
                    else e.target.value = k.name;
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2" role="group" aria-label={`Cor de ${k.name}`}>
              {CHILD_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => actions.updateChild(k.id, { fill: c.fill })}
                  aria-label={c.label}
                  aria-pressed={k.fill === c.fill}
                  className="size-11 rounded-full border border-line"
                  style={{
                    background: c.fill,
                    boxShadow: k.fill === c.fill ? "0 0 0 3px var(--color-white), 0 0 0 5px var(--color-accent)" : "none",
                  }}
                />
              ))}
            </div>
            <ChildBirthFields child={k} now={now} />
            {(kids?.length ?? 0) > 1 && (
              <button
                onClick={() => {
                  if (window.confirm(`Remover ${k.name}? Os remédios, o histórico de doses e o diário dele(a) serão apagados de vez.`)) actions.deleteChild(k.id);
                }}
                className="self-start text-sm font-semibold text-ink-soft underline"
              >
                Remover {k.name}
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => actions.addChild()}
          className="flex h-16 items-center justify-center gap-3 rounded-[1.25rem] border-[1.5px] border-dashed border-brand/50 bg-white text-base font-bold text-brand"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-xl leading-none">+</span>
          Adicionar criança
        </button>
      </section>

      <PushSettings />

      <ThemeSetting />

      <FamilyAccess />

      <FamilyData />

      <section aria-labelledby="app" className="flex flex-col gap-2">
        <h2 id="app" className="group-label">Instalar o app</h2>
        <div className="card p-4" style={{ background: "var(--c-brand-soft)" }}>
          <p className="text-base leading-snug">
            Instale para abrir como app, direto da tela inicial.
          </p>
          {installEvent ? (
            <button onClick={() => installEvent.prompt()} className="btn btn-primary mt-3 h-12 px-5 text-base">
              Instalar app
            </button>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              No iPhone: Compartilhar, depois Adicionar à Tela de Início. No Chrome: menu, depois Instalar app.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="aviso" className="flex flex-col gap-2">
        <h2 id="aviso" className="group-label">Importante</h2>
        <p className="text-[15px] leading-snug text-ink-soft">
          Este app é só um lembrete de horários. Ele não calcula nem sugere doses: siga sempre a receita e as
          orientações do pediatra. Os remédios ficam guardados na sua família, não só neste aparelho.
        </p>
      </section>
      </div>
    </div>
  );
}

/** Foto da criança: tocar no avatar escolhe uma foto, que passa pelo ajuste de enquadramento antes de ser enviada. */
function ChildPhoto({ child }: { child: Child }) {
  const { actions } = useReadyApp();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => input.current?.click();

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={pick}
        aria-label={child.photoUrl ? `Trocar a foto de ${child.name}` : `Adicionar foto de ${child.name}`}
        className="relative rounded-full"
      >
        <Avatar fill={child.fill} photo={child.photoUrl} size={64} />
        <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-brand text-[#ffffff]">
          <CameraIcon size={15} />
        </span>
      </button>
      {child.photoUrl ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Remover a foto de ${child.name}?`)) return;
            setBusy(true);
            setError(null);
            try {
              await actions.removeChildPhoto(child.id);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Não foi possível remover.");
            } finally {
              setBusy(false);
            }
          }}
          className="text-xs font-bold text-ink-soft underline"
        >
          Remover foto
        </button>
      ) : (
        <button type="button" onClick={pick} className="text-xs font-bold text-brand underline">
          Adicionar foto
        </button>
      )}
      {error && <p role="alert" className="max-w-24 text-center text-xs font-bold text-danger">{error}</p>}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          if (chosen) {
            setError(null);
            setFile(chosen);
          }
        }}
      />

      {file && (
        <PhotoCropper
          file={file}
          name={child.name}
          fill={child.fill}
          onCancel={() => setFile(null)}
          onConfirm={async (photo) => {
            try {
              await actions.setChildPhoto(child.id, photo);
              setFile(null);
            } catch (err) {
              throw new Error(err instanceof ApiError ? err.message : "Não foi possível enviar a foto.");
            }
          }}
        />
      )}
    </div>
  );
}
