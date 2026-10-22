/* Service worker do Hora do Remedinho.
   1) Avisos (push): mostra a notificação da dose e deixa marcar "Já dei" direto nela.
   2) Offline: páginas rede primeiro, arquivos estáticos cache primeiro. Nunca guarda /api/.
   Em localhost não guarda nada em cache (evita servir arquivos velhos durante o desenvolvimento). */
const CACHE = "remedinho-v3";
const IS_DEV = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  if (!IS_DEV) {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/novo", "/remedios", "/ajustes"])));
  }
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => IS_DEV || k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (IS_DEV || req.method !== "GET" || url.origin !== self.location.origin) return;
  // Dados da família e navegação do Next (RSC) nunca vêm do cache: ficariam presos a uma versão antiga.
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || req.headers.has("rsc")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // aviso sem corpo legível: mostra o texto padrão
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Hora do remédio", {
      body: data.body || "Abra o app para ver.",
      // Mesma tag + renotify: o lembrete repetido substitui o anterior e volta a tocar.
      tag: data.tag || "remedinho",
      renotify: true,
      // Fica na tela até alguém mexer, para não passar batido.
      requireInteraction: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200, 100, 200],
      data: { url: data.url || "/", doseId: data.doseId },
      actions: data.doseId ? [{ action: "given", title: "Já dei" }] : [],
    }),
  );
});

async function openApp(url) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = all.find((c) => c.url.startsWith(self.location.origin));
  if (open) {
    await open.focus();
    if ("navigate" in open) await open.navigate(url).catch(() => {});
    return;
  }
  await self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, doseId } = event.notification.data || {};

  if (event.action === "given" && doseId) {
    event.waitUntil(
      fetch(`/api/doses/${doseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ given: true }),
        credentials: "same-origin",
      })
        .then((res) => {
          if (!res.ok) throw new Error("falhou");
        })
        // Sem internet ou sessão expirada: abre o app para marcar à mão.
        .catch(() => openApp(url || "/")),
    );
    return;
  }
  event.waitUntil(openApp(url || "/"));
});
