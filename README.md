# Hora do Remedinho

App web (PWA instalável) para lembrar os horários de remédios das crianças. Feito com Next.js (App Router), TypeScript e Tailwind. Os dados ficam em um banco Postgres compartilhado pela família (a versão antiga guardava só no aparelho; o app oferece importar esses dados uma vez).

## Como rodar (desenvolvimento)

```bash
npm install
cp .env.example .env.local   # preencha (veja o próprio .env.example). Local: PGHOST/PGDATABASE/PGUSER servem no lugar de DATABASE_URL
npm run db:migrate           # cria as tabelas no banco apontado pelo .env.local
npm run dev                  # http://localhost:3000
npm test                     # testes (horários e mensagens de aviso)
npm run build && npm start   # versão de produção
npm run icons                # regenera os ícones do PWA
```

## Como funciona agora

- Os remédios ficam **no servidor** (Postgres), ligados a uma **família**. O primeiro celular cria a família e recebe um código (`XXXX-XXXX-XXXX`); o segundo entra com esse código em Ajustes. Não há senha: quem tem o código vê os remédios, então ele deve ser compartilhado só com quem cuida dos bebês.
- **Avisos (web push):** em Ajustes, "Ativar avisos neste celular" inscreve o aparelho. Um agendador (Upstash QStash, a cada 2 minutos) chama `POST /api/cron/dispatch`, que avisa a família inteira das doses vencidas. Se ninguém marcar "Já dei", repete a cada 10 minutos, até 6 vezes. Doses com mais de 3 horas de atraso não geram aviso novo (seguem "atrasadas" na tela).
- A notificação tem o botão **Já dei**, que marca a dose sem abrir o app (no iPhone o botão não existe; tocar abre o app).
- iPhone: avisos só com o app instalado na Tela de Início (iOS 16.4+). Android: funciona no Chrome.

## Colocar no ar (Vercel + Neon + QStash)

1. **Neon**: crie um projeto Postgres e copie a connection string *pooled* → `DATABASE_URL`.
2. **Chaves de push**: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT=mailto:seu@email.com`.
3. **Upstash QStash**: copie `QSTASH_CURRENT_SIGNING_KEY` e `QSTASH_NEXT_SIGNING_KEY`.
4. **Vercel**: importe o projeto e cadastre as variáveis acima (Settings > Environment Variables). Faça o deploy.
5. **Tabelas**: uma vez, com a URL de produção: `DATABASE_URL="postgres://..." node scripts/migrate.mjs`.
6. **Agendador**: no QStash crie um *Schedule* com destino `https://SEU-DOMINIO/api/cron/dispatch`, método POST, cron `*/2 * * * *`. O plano gratuito do QStash (1.000 mensagens/dia) comporta isso (720/dia).
7. Em cada celular: abra o endereço, crie/entre na família, instale na Tela de Início (iPhone) e toque em **Ativar avisos** e depois em **Enviar aviso de teste**.

> A Vercel gratuita só roda cron uma vez por dia, por isso o relógio é o QStash. Se quiser tudo na Vercel, o plano Pro permite cron por minuto.

## O que já funciona (etapas 1 e 2 do plano)

- Instalável no celular e no desktop (manifest + service worker simples, abre sem internet).
- **Novo remédio**: bebê, nome, dose em texto livre (como na receita), horário da primeira dose, intervalo livre (atalhos 4/6/8/12 h ou horas + minutos digitados) e duração livre (atalhos ou 1 a 60 dias).
- Timeline ao vivo antes de salvar: régua de 24 h, régua com os números das horas, aviso de "hora de dormir" (20h–6h) e de coincidência com outros remédios.
- **Hoje**: próxima dose, "Já dei!", lista de doses pendentes e já dadas, filtro por bebê, desfazer.
- **Remédios** (lista com a timeline de cada um, **editar** e remover; ao editar, as doses pendentes de hoje em diante são refeitas; doses já dadas e dias anteriores ficam como estão) e **Ajustes** (nome e cor dos bebês, instalar o app).

## Estrutura

```
src/lib/schedule.ts   motor de horários (funções puras, testadas)
src/lib/db.ts         banco local (Dexie): children, medications, doses
src/app/              páginas: / (Hoje), /novo, /remedios, /ajustes
src/components/       AppShell (navegação), TimelinePreview, Art (carinhas e mascote)
public/sw.js          service worker
```

## Próximas etapas

3. Lembretes com o app fechado (Web Push com backend mínimo). No iPhone só funciona com o app instalado na tela inicial.
4. Pai e mãe no mesmo tratamento (sincronização, login) e aviso de dose já dada.
5. Histórico, editar/pausar remédio e tema escuro.

## Aviso

O app é só um lembrete de horários. Não calcula nem sugere doses.
