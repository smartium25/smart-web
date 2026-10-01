/*!
 * smart-lock.js — Smart Ecosystem
 *
 * Uso (en Smart-Web, Smart-Chat, Smart-Call...; NUNCA en el Panel Admin):
 *
 *   <script src="./smart-lock.js"
 *           data-api="https://TU-TUNEL-MODERATION.trycloudflare.com"></script>
 *
 * o bien, antes de cargar el script:
 *
 *   <script>window.SMART_LOCK_CONFIG = { api: "https://..." };</script>
 *
 * Flujo:
 *   1. Consulta GET /api/ecosystem-lock (público). Si está apagado, no hace nada
 *      (ni siquiera pide ubicación).
 *   2. Si está activo: lee el token (knfoundation_token) y la ubicación.
 *   3. Consulta GET /api/ecosystem-lock/check y, si blocked = true,
 *      cubre la pantalla. Repite cada pollMs para detectar cambios.
 */
(function () {
  "use strict";

  if (window.__smartLockLoaded) return;
  window.__smartLockLoaded = true;

  // ==========================================================
  // CONFIGURACIÓN
  // ==========================================================

  var script = document.currentScript;

  var cfg = Object.assign(
    {
      // URL del servicio Smart-Educational / moderation.py (puerto 8004).
      api:
        (script && script.dataset && script.dataset.api) ||
        "https://analysts-coating-sticks-mixer.trycloudflare.com",

      tokenKey: "knfoundation_token",

      // Cada cuánto vuelve a consultar (ms).
      pollMs: 10000,

      // Qué hacer si el servidor no responde:
      //   "open"   = dejar pasar (mantiene el estado actual)
      //   "closed" = bloquear hasta poder verificar
      failMode: "open",
    },
    window.SMART_LOCK_CONFIG || {}
  );

  cfg.api = String(cfg.api).replace(/\/+$/, "");

  // ==========================================================
  // ESTADO
  // ==========================================================

  var busy = false;
  var blocked = false;
  var host = null;
  var shadow = null;
  var titleEl = null;
  var textEl = null;
  var metaEl = null;
  var retryBtn = null;
  var timer = null;

  // ==========================================================
  // UTILIDADES
  // ==========================================================

  function getToken() {
    try {
      return localStorage.getItem(cfg.tokenKey) || "";
    } catch (e) {
      return "";
    }
  }

  async function getJSON(path, token) {
    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 8000);

    try {
      var headers = {};
      if (token) headers["Authorization"] = "Bearer " + token;

      var response = await fetch(cfg.api + path, {
        method: "GET",
        headers: headers,
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        var error = new Error("HTTP " + response.status);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function getPosition() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("Sin geolocalización"));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });
    });
  }

  // ==========================================================
  // PANTALLA DE BLOQUEO
  // ==========================================================

  var CSS =
    ":host{all:initial}" +
    ".wrap{position:fixed;inset:0;display:flex;align-items:center;" +
    "justify-content:center;background:#121212;color:#fff;" +
    "font-family:'Segoe UI',Arial,sans-serif;padding:24px;box-sizing:border-box}" +
    ".card{width:100%;max-width:380px;background:#202020;" +
    "border:1px solid #2c2c2c;border-radius:8px;padding:32px 28px;" +
    "text-align:center}" +
    ".icon{width:44px;height:44px;margin:0 auto 18px;color:#00bcd4}" +
    "h1{margin:0 0 8px;font-size:20px;font-weight:600}" +
    "p{margin:0;font-size:14px;color:#a0a0a0;line-height:1.5}" +
    ".meta{margin-top:16px;font-size:12px;color:#7a7a7a}" +
    "button{margin-top:20px;background:#2c2c2c;color:#fff;" +
    "border:1px solid #3a3a3a;border-radius:6px;padding:9px 18px;" +
    "font:inherit;font-size:13px;cursor:pointer}" +
    "button:hover,button:focus-visible{border-color:#00f0ff;" +
    "box-shadow:0 0 10px rgba(0,240,255,.35);outline:none}" +
    "button[hidden]{display:none}";

  function buildOverlay() {
    host = document.createElement("div");
    host.setAttribute("data-smart-lock", "");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:block;";

    shadow = host.attachShadow({ mode: "closed" });

    shadow.innerHTML =
      "<style>" +
      CSS +
      "</style>" +
      '<div class="wrap" role="alertdialog" aria-live="assertive">' +
      '<div class="card">' +
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="4" y="11" width="16" height="10" rx="2"/>' +
      '<path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
      "<h1></h1><p></p>" +
      '<div class="meta"></div>' +
      '<button type="button" hidden>Reintentar</button>' +
      "</div></div>";

    titleEl = shadow.querySelector("h1");
    textEl = shadow.querySelector("p");
    metaEl = shadow.querySelector(".meta");
    retryBtn = shadow.querySelector("button");

    retryBtn.addEventListener("click", function () {
      tick();
    });
  }

  function show(info) {
    if (!host) buildOverlay();

    info = info || {};

    if (info.reason === "location") {
      titleEl.textContent = "Ubicación requerida";
      textEl.textContent = "Activa la ubicación para continuar.";
      metaEl.textContent = "";
      retryBtn.hidden = false;
    } else if (info.reason === "error") {
      titleEl.textContent = "Sin conexión";
      textEl.textContent = "No se pudo verificar el acceso.";
      metaEl.textContent = "";
      retryBtn.hidden = false;
    } else {
      titleEl.textContent = "Acceso bloqueado";
      textEl.textContent = "Estás dentro de la zona restringida.";
      metaEl.textContent =
        info.distance != null
          ? Math.round(info.distance) + " m · radio " + info.radius + " m"
          : "";
      retryBtn.hidden = true;
    }

    if (!host.isConnected) {
      document.documentElement.appendChild(host);
    }

    if (!blocked) {
      blocked = true;
      document.documentElement.style.overflow = "hidden";
      if (document.body && "inert" in document.body) {
        document.body.inert = true;
      }
    }
  }

  function hide() {
    if (!blocked) return;

    blocked = false;

    if (host && host.isConnected) host.remove();

    document.documentElement.style.overflow = "";

    if (document.body && "inert" in document.body) {
      document.body.inert = false;
    }
  }

  // Si alguien elimina el overlay desde las devtools, se vuelve a poner.
  // (Es una barrera del lado del cliente; ver nota en la documentación.)
  new MutationObserver(function () {
    if (blocked && host && !host.isConnected) {
      document.documentElement.appendChild(host);
    }
  }).observe(document.documentElement, { childList: true });

  // ==========================================================
  // COMPROBACIÓN
  // ==========================================================

  async function tick() {
    if (busy) return;
    busy = true;

    try {
      // 1. ¿Está activo el bloqueo? (endpoint público)
      var status = await getJSON("/api/ecosystem-lock");

      if (!status.enabled) {
        hide();
        return;
      }

      // 2. Sin sesión no hay nada que verificar.
      var token = getToken();

      if (!token) {
        hide();
        return;
      }

      // 3. Ubicación actual.
      var position;

      try {
        position = await getPosition();
      } catch (e) {
        show({ reason: "location" });
        return;
      }

      // 4. Consulta al servidor.
      var url =
        "/api/ecosystem-lock/check?latitude=" +
        encodeURIComponent(position.coords.latitude) +
        "&longitude=" +
        encodeURIComponent(position.coords.longitude);

      var result = await getJSON(url, token);

      if (result.blocked) {
        show({
          distance: result.distance_meters,
          radius: result.radius_meters,
        });
      } else {
        hide();
      }
    } catch (error) {
      // Sesión caducada: la app se encarga del login.
      if (error && error.status === 401) {
        hide();
        return;
      }

      if (cfg.failMode === "closed") {
        show({ reason: "error" });
      }
      // failMode "open": se mantiene el estado actual.
    } finally {
      busy = false;
    }
  }

  function start() {
    tick();

    if (timer) clearInterval(timer);
    timer = setInterval(tick, cfg.pollMs);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") tick();
  });

  window.addEventListener("online", tick);

  // API mínima por si otra parte de la app la necesita.
  window.SmartLock = {
    check: tick,
    isBlocked: function () {
      return blocked;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
