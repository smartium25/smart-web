/*
 * ============================================================
 * SMART-LOCK.JS
 * Smart-Ecosystem Geographical Lock
 * ============================================================
 *
 * En cada index.html añade:
 *
 * <script src="./smart-lock.js"></script>
 *
 * El sistema:
 * - Comprueba la ubicación del dispositivo.
 * - Consulta el bloqueo en Kn Foundation.
 * - Usa un radio de 100 metros.
 * - Oculta toda la aplicación si está bloqueada.
 * - Muestra la pantalla "Heads up!".
 * - Guarda el estado en localStorage.
 * - Sincroniza pestañas mediante BroadcastChannel.
 *
 * Requiere:
 * localStorage["knfoundation_token"]
 */

(() => {

    "use strict";


    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const CONFIG = {

        // API CENTRAL DE KN FOUNDATION
        API:
            "https://visitor-built-cells-disable.trycloudflare.com",

        // TOKEN CENTRAL DE KN FOUNDATION
        TOKEN_KEY:
            "knfoundation_token",

        // Cada cuánto revisar la ubicación
        CHECK_INTERVAL_MS:
            5000,

        // Tiempo máximo para obtener GPS
        LOCATION_TIMEOUT_MS:
            10000,

        // Edad máxima aceptada de una ubicación
        LOCATION_MAXIMUM_AGE_MS:
            3000,

        // ID de la pantalla de bloqueo
        OVERLAY_ID:
            "smart-ecosystem-lock-overlay",

        // Canal compartido
        CHANNEL_NAME:
            "smart-ecosystem-lock",

        // Estado guardado
        CACHE_KEY:
            "smart_ecosystem_lock_state"
    };


    /* ========================================================
       ESTADO INTERNO
       ======================================================== */

    let channel = null;

    let intervalId = null;

    let checking = false;


    /* ========================================================
       TOKEN
       ======================================================== */

    function getToken() {

        return localStorage.getItem(
            CONFIG.TOKEN_KEY
        );

    }


    /* ========================================================
       CREAR PANTALLA DE BLOQUEO
       ======================================================== */

    function createLockScreen() {

        let overlay =
            document.getElementById(
                CONFIG.OVERLAY_ID
            );


        if (overlay) {

            return overlay;

        }


        overlay =
            document.createElement(
                "div"
            );


        overlay.id =
            CONFIG.OVERLAY_ID;


        Object.assign(
            overlay.style,
            {

                position:
                    "fixed",

                inset:
                    "0",

                width:
                    "100vw",

                height:
                    "100vh",

                zIndex:
                    "2147483647",

                display:
                    "none",

                alignItems:
                    "center",

                justifyContent:
                    "center",

                padding:
                    "24px",

                boxSizing:
                    "border-box",

                background:
                    "#252a33",

                color:
                    "#ffffff",

                fontFamily:
                    '"Segoe UI", Arial, sans-serif',

                textAlign:
                    "center",

                overflow:
                    "auto"
            }
        );


        /* ====================================================
           TARJETA
           ==================================================== */

        const card =
            document.createElement(
                "div"
            );


        Object.assign(
            card.style,
            {

                width:
                    "min(560px, 100%)",

                padding:
                    "34px 28px",

                boxSizing:
                    "border-box",

                borderRadius:
                    "18px",

                background:
                    "#303640",

                border:
                    "1px solid #4a5059",

                boxShadow:
                    "0 18px 55px rgba(0,0,0,.30)"
            }
        );


        /* ====================================================
           TITULO
           ==================================================== */

        const title =
            document.createElement(
                "div"
            );


        title.textContent =
            "Heads up!";


        Object.assign(
            title.style,
            {

                fontSize:
                    "30px",

                fontWeight:
                    "800",

                marginBottom:
                    "18px",

                color:
                    "#00f0ff"
            }
        );


        /* ====================================================
           MENSAJE
           ==================================================== */

        const message =
            document.createElement(
                "div"
            );


        message.innerHTML =
            "Smart-Ecosystem está temporalmente bloqueado<br>" +
            "en tu ubicación actual.<br><br>" +
            "Sal de la escuela o espera a que<br>" +
            "el bloqueo sea desactivado.";


        Object.assign(
            message.style,
            {

                fontSize:
                    "15px",

                lineHeight:
                    "1.65",

                color:
                    "rgba(255,255,255,.76)"
            }
        );


        /* ====================================================
           ENSAMBLAR
           ==================================================== */

        card.appendChild(
            title
        );

        card.appendChild(
            message
        );

        overlay.appendChild(
            card
        );

        document.body.appendChild(
            overlay
        );


        return overlay;

    }


    /* ========================================================
       MOSTRAR BLOQUEO
       ======================================================== */

    function showLockScreen() {

        const overlay =
            createLockScreen();


        overlay.style.display =
            "flex";


        document.documentElement.style.overflow =
            "hidden";


        document.body.style.overflow =
            "hidden";

    }


    /* ========================================================
       OCULTAR BLOQUEO
       ======================================================== */

    function hideLockScreen() {

        const overlay =
            document.getElementById(
                CONFIG.OVERLAY_ID
            );


        if (overlay) {

            overlay.style.display =
                "none";

        }


        document.documentElement.style.overflow =
            "";


        document.body.style.overflow =
            "";

    }


    /* ========================================================
       OBTENER UBICACIÓN
       ======================================================== */

    function getCurrentLocation() {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                if (
                    !navigator.geolocation
                ) {

                    reject(
                        new Error(
                            "La geolocalización no está disponible."
                        )
                    );

                    return;

                }


                navigator.geolocation.getCurrentPosition(

                    position => {

                        resolve({

                            latitude:
                                position.coords.latitude,

                            longitude:
                                position.coords.longitude

                        });

                    },


                    error => {

                        reject(
                            error
                        );

                    },


                    {

                        enableHighAccuracy:
                            true,

                        timeout:
                            CONFIG.LOCATION_TIMEOUT_MS,

                        maximumAge:
                            CONFIG.LOCATION_MAXIMUM_AGE_MS

                    }

                );

            }
        );

    }


    /* ========================================================
       GUARDAR ESTADO EN CACHE
       ======================================================== */

    function saveState(
        state
    ) {

        const completeState = {

            ...state,

            timestamp:
                Date.now()

        };


        try {

            localStorage.setItem(

                CONFIG.CACHE_KEY,

                JSON.stringify(
                    completeState
                )

            );

        }

        catch (error) {

            console.warn(
                "Smart Lock localStorage:",
                error
            );

        }


        /* ====================================================
           BROADCAST CHANNEL
           ==================================================== */

        if (channel) {

            try {

                channel.postMessage(
                    completeState
                );

            }

            catch (error) {

                console.warn(
                    "Smart Lock BroadcastChannel:",
                    error
                );

            }

        }

    }


    /* ========================================================
       LEER CACHE
       ======================================================== */

    function loadCachedState() {

        try {

            const raw =
                localStorage.getItem(
                    CONFIG.CACHE_KEY
                );


            if (!raw) {

                return;

            }


            const state =
                JSON.parse(
                    raw
                );


            if (
                state &&
                state.blocked === true
            ) {

                showLockScreen();

            }


            if (
                state &&
                state.blocked === false
            ) {

                hideLockScreen();

            }

        }

        catch (error) {

            console.warn(
                "Smart Lock cache:",
                error
            );

        }

    }


    /* ========================================================
       BROADCAST CHANNEL
       ======================================================== */

    function setupBroadcastChannel() {

        if (
            !(
                "BroadcastChannel"
                in window
            )
        ) {

            return;

        }


        try {

            channel =
                new BroadcastChannel(
                    CONFIG.CHANNEL_NAME
                );


            channel.addEventListener(
                "message",
                event => {

                    const state =
                        event.data;


                    if (
                        !state ||
                        typeof state !==
                        "object"
                    ) {

                        return;

                    }


                    if (
                        state.blocked === true
                    ) {

                        showLockScreen();

                    }


                    if (
                        state.blocked === false
                    ) {

                        hideLockScreen();

                    }

                }
            );

        }

        catch (error) {

            console.warn(
                "Smart Lock BroadcastChannel:",
                error
            );

        }

    }


    /* ========================================================
       SINCRONIZACIÓN STORAGE
       ======================================================== */

    function setupStorageSync() {

        window.addEventListener(
            "storage",
            event => {

                if (
                    event.key !==
                    CONFIG.CACHE_KEY
                ) {

                    return;

                }


                if (
                    !event.newValue
                ) {

                    return;

                }


                try {

                    const state =
                        JSON.parse(
                            event.newValue
                        );


                    if (
                        state &&
                        state.blocked === true
                    ) {

                        showLockScreen();

                    }


                    if (
                        state &&
                        state.blocked === false
                    ) {

                        hideLockScreen();

                    }

                }

                catch (error) {

                    console.warn(
                        "Smart Lock storage:",
                        error
                    );

                }

            }
        );

    }


    /* ========================================================
       COMPROBAR BLOQUEO
       ======================================================== */

    async function checkLock() {

        if (checking) {

            return;

        }


        const token =
            getToken();


        /*
         * El endpoint actual de Kn Foundation
         * requiere autenticación.
         *
         * Por eso este archivo empieza a comprobar
         * cuando ya existe una sesión.
         */

        if (!token) {

            return;

        }


        checking =
            true;


        try {

            /* ================================================
               UBICACIÓN
               ================================================ */

            const location =
                await getCurrentLocation();


            /* ================================================
               URL
               ================================================ */

            const url =
                CONFIG.API +
                "/api/ecosystem-lock/check" +
                "?latitude=" +
                encodeURIComponent(
                    location.latitude
                ) +
                "&longitude=" +
                encodeURIComponent(
                    location.longitude
                );


            /* ================================================
               PETICIÓN
               ================================================ */

            const response =
                await fetch(
                    url,
                    {

                        method:
                            "GET",

                        headers: {

                            Authorization:
                                "Bearer " +
                                token

                        },

                        cache:
                            "no-store"

                    }
                );


            /* ================================================
               JSON
               ================================================ */

            let data =
                null;


            try {

                data =
                    await response.json();

            }

            catch {

                data =
                    null;

            }


            /* ================================================
               SESIÓN INVÁLIDA
               ================================================ */

            if (
                response.status ===
                401
            ) {

                localStorage.removeItem(
                    CONFIG.TOKEN_KEY
                );


                saveState({

                    blocked:
                        false,

                    sessionInvalid:
                        true

                });


                return;

            }


            if (
                !response.ok ||
                !data
            ) {

                return;

            }


            /* ================================================
               RESULTADO
               ================================================ */

            const isBlocked =
                data.blocked === true;


            if (
                isBlocked
            ) {

                showLockScreen();

            }

            else {

                hideLockScreen();

            }


            /* ================================================
               CACHE
               ================================================ */

            saveState({

                blocked:
                    isBlocked,

                allowed:
                    data.allowed !== false,

                distance_meters:
                    data.distance_meters ??
                    null,

                radius_meters:
                    data.radius_meters ??
                    100

            });

        }


        catch (error) {

            /*
             * Si GPS o red fallan temporalmente,
             * no destruimos el estado actual.
             */

            console.warn(
                "Smart Lock:",
                error
            );

        }


        finally {

            checking =
                false;

        }

    }


    /* ========================================================
       INICIAR
       ======================================================== */

    function start() {

        if (
            !document.body
        ) {

            window.addEventListener(
                "DOMContentLoaded",
                start,
                {
                    once: true
                }
            );

            return;

        }


        createLockScreen();

        loadCachedState();

        setupBroadcastChannel();

        setupStorageSync();

        checkLock();


        intervalId =
            window.setInterval(
                checkLock,
                CONFIG.CHECK_INTERVAL_MS
            );


        /* ====================================================
           LIMPIEZA
           ==================================================== */

        window.addEventListener(
            "beforeunload",
            () => {

                if (
                    intervalId
                ) {

                    clearInterval(
                        intervalId
                    );

                }


                if (
                    channel
                ) {

                    try {

                        channel.close();

                    }

                    catch {}

                }

            },
            {
                once: true
            }
        );

    }


    /* ========================================================
       ARRANCAR
       ======================================================== */

    start();

})();
