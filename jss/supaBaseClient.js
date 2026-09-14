// ===================================================
// SIGA_APP - CONEXIÓN CENTRAL A BASE DE DATOS (LOCAL Y NUBE)
// ===================================================

// Capturar referencia segura a la librería original del SDK oficial de Supabase
if (typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function") {
    window._supabaseLib = window.supabase;
}

// 1. Configuración de Credenciales de Supabase (con soporte para configuración en UI)
(function() {
    const urlGuardada = localStorage.getItem('SIGA_SUPABASE_URL');
    const keyGuardada = localStorage.getItem('SIGA_SUPABASE_KEY');

    window.SUPABASE_URL = urlGuardada || window.SUPABASE_URL || "https://ktpogfjwfusdizebatiz.supabase.co";
    window.SUPABASE_KEY = keyGuardada || window.SUPABASE_KEY || "sb_publishable_DlMGRz8M7fu5a6brDZ5J7A__9DG2hdW";
})();

// 2. Inicialización del cliente Supabase oficial en la nube
window.supabaseCloudClient = null;
window.supabaseConectado = false;

function inicializarSupabaseCloud() {
    const lib = window._supabaseLib || (typeof supabase !== "undefined" && typeof supabase.createClient === "function" ? supabase : null);
    if (lib && window.SUPABASE_URL && window.SUPABASE_KEY) {
        try {
            window.supabaseCloudClient = lib.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            console.log("[SIGA Supabase] Cliente Cloud inicializado correctamente:", window.SUPABASE_URL);
        } catch (e) {
            console.warn("[SIGA Supabase] No se pudo crear cliente de Supabase:", e);
            window.supabaseCloudClient = null;
        }
    } else if (!lib && window.SUPABASE_URL && window.SUPABASE_KEY) {
        // Fallback REST directo si la librería JS global no estuviese disponible
        window.supabaseCloudClient = {
            from(tabla) {
                const baseURL = window.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + tabla;
                const headers = {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': 'Bearer ' + window.SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                };
                return {
                    select(columnas = '*') {
                        return {
                            limit: async (lim) => {
                                try {
                                    const r = await fetch(`${baseURL}?select=${encodeURIComponent(columnas)}&limit=${lim}`, { headers });
                                    if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}` } };
                                    const data = await r.json();
                                    return { data, error: null };
                                } catch (err) {
                                    return { data: null, error: err };
                                }
                            }
                        };
                    },
                    upsert: async (datos, opts = {}) => {
                        try {
                            const params = opts.onConflict ? `?on_conflict=${opts.onConflict}&resolution=merge-duplicates` : '';
                            const r = await fetch(baseURL + params, {
                                method: 'POST',
                                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                                body: JSON.stringify(datos)
                            });
                            if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}` } };
                            return { data: true, error: null };
                        } catch (err) {
                            return { data: null, error: err };
                        }
                    }
                };
            }
        };
        console.log("[SIGA Supabase] Cliente REST ligero inicializado correctamente.");
    }
}
inicializarSupabaseCloud();

// Verificar estado de conexión de forma no bloqueante
window.verificarConexionSupabase = async function() {
    if (!window.supabaseCloudClient) return false;
    try {
        const { data, error } = await window.supabaseCloudClient.from('profiles').select('id').limit(1);
        if (!error) {
            window.supabaseConectado = true;
            return true;
        }
        // Intentar con cursos si profiles tuviera RLS estricto
        const { error: err2 } = await window.supabaseCloudClient.from('cursos').select('codigo_curso').limit(1);
        window.supabaseConectado = !err2;
        return window.supabaseConectado;
    } catch (e) {
        window.supabaseConectado = false;
        return false;
    }
};

// 3. Motor Híbrido Persistente (Dual Write + Cloud Query + Offline Fallback)
// Permite guardar automáticamente en Supabase PostgreSQL en la nube Y al mismo tiempo
// mantener sincronizada la base local en IndexedDB para máxima velocidad y tolerancia a fallos.
function crearClienteHibrido() {
    return {
        from(nombreTabla) {
            const cloudTable = window.supabaseCloudClient ? window.supabaseCloudClient.from(nombreTabla) : null;
            const localTable = window.dbLocal ? window.dbLocal.from(nombreTabla) : null;

            return {
                select(columnas = '*') {
                    return {
                        eq(col, val) {
                            return this._ejecutar('eq', col, val);
                        },
                        order(col, opts) {
                            return this._ejecutar('order', col, opts);
                        },
                        limit(num) {
                            return this._ejecutar('limit', num);
                        },
                        async _ejecutar(tipoFiltro, arg1, arg2) {
                            // Si Supabase Cloud está disponible, intentar consulta en nube
                            if (cloudTable) {
                                try {
                                    let q = cloudTable.select(columnas);
                                    if (tipoFiltro === 'eq') q = q.eq(arg1, arg2);
                                    else if (tipoFiltro === 'order') q = q.order(arg1, arg2);
                                    else if (tipoFiltro === 'limit') q = q.limit(arg1);

                                    const { data, error } = await q;
                                    if (!error && Array.isArray(data) && data.length > 0) {
                                        // Cachear en dbLocal silenciosamente
                                        if (window.dbLocal && window.dbLocal.raw && columnas === '*') {
                                            const actuales = window.dbLocal.raw.leerTabla(nombreTabla) || [];
                                            if (actuales.length === 0) {
                                                window.dbLocal.raw.escribirTabla(nombreTabla, data);
                                            }
                                        }
                                        return { data, error: null };
                                    }
                                } catch (e) {
                                    console.warn(`[SIGA DualDB] Fallo select cloud en ${nombreTabla}, usando local:`, e);
                                }
                            }
                            // Fallback transparente a dbLocal
                            if (localTable) {
                                let lq = localTable.select(columnas);
                                if (tipoFiltro === 'eq') lq = lq.eq(arg1, arg2);
                                else if (tipoFiltro === 'order') lq = lq.order(arg1, arg2);
                                else if (tipoFiltro === 'limit') lq = lq.limit(arg1);
                                return await lq;
                            }
                            return { data: [], error: null };
                        },
                        then(resolve, reject) {
                            // Ejecutar select general sin filtros
                            (async () => {
                                if (cloudTable) {
                                    try {
                                        const { data, error } = await cloudTable.select(columnas);
                                        if (!error && Array.isArray(data) && data.length > 0) {
                                            return resolve({ data, error: null });
                                        }
                                    } catch (e) {}
                                }
                                if (localTable) {
                                    const res = await localTable.select(columnas);
                                    return resolve(res);
                                }
                                resolve({ data: [], error: null });
                            })().catch(reject);
                        }
                    };
                },

                async insert(filas, opciones) {
                    const items = Array.isArray(filas) ? filas : [filas];
                    let resCloud = { data: null, error: null };

                    // 1. Guardar en Supabase PostgreSQL en la nube
                    if (cloudTable) {
                        try {
                            resCloud = await cloudTable.insert(filas, opciones);
                        } catch (err) {
                            console.warn(`[SIGA DualDB] Error insert en Supabase (${nombreTabla}):`, err);
                            resCloud = { data: null, error: err };
                        }
                    }

                    // 2. Guardar en Base de Datos Local
                    if (localTable) {
                        try {
                            await localTable.insert(filas);
                        } catch (e) {}
                    }

                    return resCloud.error && !localTable ? resCloud : { data: items, error: null };
                },

                async upsert(filas, opciones) {
                    const items = Array.isArray(filas) ? filas : [filas];
                    let resCloud = { data: null, error: null };

                    // 1. Upsert en Supabase PostgreSQL
                    if (cloudTable) {
                        try {
                            resCloud = await cloudTable.upsert(filas, opciones);
                        } catch (err) {
                            console.warn(`[SIGA DualDB] Error upsert en Supabase (${nombreTabla}):`, err);
                            resCloud = { data: null, error: err };
                        }
                    }

                    // 2. Upsert en Base de Datos Local
                    if (localTable) {
                        try {
                            await localTable.upsert(filas);
                        } catch (e) {}
                    }

                    return resCloud.error && !localTable ? resCloud : { data: items, error: null };
                },

                update(valores) {
                    return {
                        async eq(col, val) {
                            let resCloud = { data: null, error: null };
                            if (cloudTable) {
                                try {
                                    resCloud = await cloudTable.update(valores).eq(col, val);
                                } catch (err) {
                                    console.warn(`[SIGA DualDB] Error update en Supabase (${nombreTabla}):`, err);
                                    resCloud = { data: null, error: err };
                                }
                            }
                            if (localTable) {
                                try {
                                    await localTable.update(valores).eq(col, val);
                                } catch (e) {}
                            }
                            return resCloud.error && !localTable ? resCloud : { data: [valores], error: null };
                        }
                    };
                },

                delete() {
                    return {
                        async eq(col, val) {
                            let resCloud = { data: null, error: null };
                            if (cloudTable) {
                                try {
                                    resCloud = await cloudTable.delete().eq(col, val);
                                } catch (err) {
                                    console.warn(`[SIGA DualDB] Error delete en Supabase (${nombreTabla}):`, err);
                                    resCloud = { data: null, error: err };
                                }
                            }
                            if (localTable) {
                                try {
                                    await localTable.delete().eq(col, val);
                                } catch (e) {}
                            }
                            return resCloud.error && !localTable ? resCloud : { data: [], error: null };
                        }
                    };
                }
            };
        }
    };
}

// Instanciar cliente híbrido global
window.supabaseClient = crearClienteHibrido();
window.supabase = window.supabaseClient;

// Helper universal para obtener el cliente de base de datos óptimo
window.obtenerClienteDBCFT = function() {
    return window.supabaseClient || window.dbLocal || window.supabaseCloudClient || null;
};

// Variable de conveniencia local
var supabaseClient = window.supabaseClient;

// 4. Métodos de Gestión y Sincronización Supabase Cloud
window.guardarConfigSupabase = function(url, key) {
    if (!url || !key) return { exito: false, mensaje: "URL y Clave son obligatorias." };
    localStorage.setItem('SIGA_SUPABASE_URL', url.trim());
    localStorage.setItem('SIGA_SUPABASE_KEY', key.trim());
    window.SUPABASE_URL = url.trim();
    window.SUPABASE_KEY = key.trim();
    inicializarSupabaseCloud();
    window.supabaseClient = crearClienteHibrido();
    window.supabase = window.supabaseClient;
    return { exito: true, mensaje: "Credenciales guardadas exitosamente." };
};

// Subir todas las tablas locales a Supabase Cloud
window.sincronizarTodoASupabase = async function(onProgreso) {
    if (!window.supabaseCloudClient) {
        throw new Error("Cliente Supabase no inicializado. Verificá la URL y Anon Key.");
    }
    const tablas = [
        { nombre: 'profiles', pk: 'usuario' },
        { nombre: 'programas', pk: 'codigo_programa' },
        { nombre: 'cursos', pk: 'codigo_curso' },
        { nombre: 'instructores', pk: 'codigo_instructor' },
        { nombre: 'dotacion', pk: 'legajo' },
        { nombre: 'proveedores', pk: 'codigo_proveedor' },
        { nombre: 'capacitaciones', pk: 'id_cap' },
        { nombre: 'asistentes', pk: 'id' },
        { nombre: 'evaluaciones_satisfaccion', pk: 'id' },
        { nombre: 'transferencias', pk: 'id' },
        { nombre: 'certificaciones_externas', pk: 'id' }
    ];

    let totalSubidos = 0;
    for (let i = 0; i < tablas.length; i++) {
        const { nombre, pk } = tablas[i];
        if (typeof onProgreso === 'function') {
            onProgreso(`Sincronizando tabla ${i + 1}/${tablas.length}: ${nombre}...`, Math.round(((i) / tablas.length) * 100));
        }

        let datos = [];
        if (window.dbLocal && window.dbLocal.raw) {
            datos = window.dbLocal.raw.leerTabla(nombre) || [];
        }

        if (datos.length > 0) {
            try {
                // Upsert por lotes de 50 registros para evitar límites de payload
                const LOTE = 50;
                for (let j = 0; j < datos.length; j += LOTE) {
                    const lote = datos.slice(j, j + LOTE);
                    const opts = pk ? { onConflict: pk } : {};
                    const { error } = await window.supabaseCloudClient.from(nombre).upsert(lote, opts);
                    if (error) {
                        console.warn(`[Sincronización] Aviso en tabla ${nombre}:`, error.message);
                    }
                }
                totalSubidos += datos.length;
            } catch (err) {
                console.error(`Error subiendo tabla ${nombre} a Supabase:`, err);
            }
        }
    }

    if (typeof onProgreso === 'function') {
        onProgreso("¡Sincronización a Supabase Cloud completada!", 100);
    }
    return { exito: true, totalRegistros: totalSubidos };
};

// Descargar todas las tablas de Supabase Cloud a dbLocal
window.descargarTodoDeSupabase = async function(onProgreso) {
    if (!window.supabaseCloudClient) {
        throw new Error("Cliente Supabase no inicializado. Verificá la URL y Anon Key.");
    }
    const tablas = ['profiles', 'programas', 'cursos', 'instructores', 'dotacion', 'proveedores', 'capacitaciones', 'asistentes', 'evaluaciones_satisfaccion', 'transferencias', 'certificaciones_externas'];

    let totalDescargados = 0;
    for (let i = 0; i < tablas.length; i++) {
        const t = tablas[i];
        if (typeof onProgreso === 'function') {
            onProgreso(`Descargando tabla ${i + 1}/${tablas.length}: ${t}...`, Math.round(((i) / tablas.length) * 100));
        }
        try {
            const { data, error } = await window.supabaseCloudClient.from(t).select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                if (window.dbLocal && window.dbLocal.raw) {
                    window.dbLocal.raw.escribirTabla(t, data);
                    await window.dbLocal.raw.guardarTablaAsync(t, data);
                }
                totalDescargados += data.length;
            }
        } catch (e) {
            console.warn(`Error al descargar tabla ${t}:`, e);
        }
    }
    if (typeof onProgreso === 'function') {
        onProgreso("¡Descarga desde Supabase Cloud completada!", 100);
    }
    return { exito: true, totalRegistros: totalDescargados };
};

// ===================================================
// LÓGICA DEL MENÚ RESPONSIVE Y RAIL INTELIGENTE (ESTILO HBO TV)
// ===================================================

// Normalizar enlaces del sidebar para estructurar icono y texto automáticamente
function inicializarSidebarHBO() {
    const navLinks = document.querySelectorAll('.sidebar nav a');
    navLinks.forEach(link => {
        if (!link.querySelector('.nav-icon')) {
            const fullText = link.textContent.trim();
            // Detectar icono al inicio (emoji o símbolo)
            const match = fullText.match(/^(\p{Extended_Pictographic}|\p{Emoji}|[^\w\s])\s*(.*)$/u);
            if (match) {
                const icon = match[1];
                const label = match[2];
                link.innerHTML = `<span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>`;
                if (!link.getAttribute('title')) link.setAttribute('title', label);
            }
        }
    });

    // Actualizar títulos o textos del logo si faltan clases
    const logoTitle = document.querySelector('.sidebar .logo h1');
    if (logoTitle && !logoTitle.classList.contains('logo-title')) {
        logoTitle.classList.add('logo-title');
    }
    const logoSub = document.querySelector('.sidebar .logo p');
    if (logoSub && !logoSub.classList.contains('logo-sub')) {
        logoSub.classList.add('logo-sub');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSidebarHBO);
} else {
    inicializarSidebarHBO();
}

// Función global para abrir/cerrar el menú al tocar el botón ☰
window.toggleMenu = function() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
};

// Cierra el menú automáticamente si el usuario hace clic/tap fuera de él
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const btnMenu = document.querySelector('.btn-hamburger');
    
    if (sidebar && sidebar.classList.contains('active')) {
        // Si el clic NO fue dentro del sidebar ni en el botón hamburguesa, lo cerramos
        if (!sidebar.contains(e.target) && !btnMenu?.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});
