// ==========================================================
// sw.js - Service Worker
// Roda em segundo plano, entre o app e a internet.
// Estratégia "rede primeiro": tenta buscar na internet (versão mais nova);
// se estiver offline, entrega a cópia guardada no cache.
// ==========================================================

// Mude o número da versão sempre que alterar a lista de arquivos abaixo
const PREFIXO_CACHE = "cafe-mobile-" + self.registration.scope;
const CACHE = PREFIXO_CACHE + "v3";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/dados.js",
  "./js/app.js",
  "./js/camera.js",
  "./js/pwa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// 1) INSTALAÇÃO: baixa e guarda todos os arquivos do app no cache
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ARQUIVOS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// 2) ATIVAÇÃO: apaga caches de versões antigas
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes
          // Não apaga caches de outros projetos no mesmo GitHub Pages.
          .filter(function (nome) { return nome.startsWith(PREFIXO_CACHE) && nome !== CACHE; })
          .map(function (nome) { return caches.delete(nome); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 3) BUSCA: toda requisição do app passa por aqui
self.addEventListener("fetch", function (evento) {
  const url = new URL(evento.request.url);
  if (evento.request.method !== "GET" ||
      url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) {
    return; // só guardamos requisições GET
  }

  evento.respondWith(
    fetch(evento.request)
      .then(async function (resposta) {
        // Online: guarda uma cópia atualizada no cache e devolve a resposta
        if (resposta.ok) {
          try {
            const cache = await caches.open(CACHE);
            await cache.put(evento.request, resposta.clone());
          } catch (erro) {
            // Falhar ao atualizar o cache não impede a resposta online.
            console.log("Não foi possível atualizar o cache:", erro.message);
          }
        }
        return resposta;
      })
      .catch(async function () {
        // Offline: devolve o que está no cache
        const cache = await caches.open(CACHE);
        const salva = await cache.match(evento.request, { ignoreSearch: true });
        if (salva) {
          return salva;
        }
        if (evento.request.mode === "navigate") {
          const inicio = await cache.match("./index.html");
          if (inicio) {
            return inicio;
          }
        }
        return new Response("Arquivo indisponível offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
});
