// ===================================================
// SIGA_APP - CONEXIÓN CENTRAL A BASE DE DATOS (LOCAL Y NUBE)
// ===================================================

// Capturar referencia segura a la librería original del SDK oficial de Supabase
if (typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function") {
    window._supabaseLib = window.supabase;
}

// Esquema oficial de columnas para Supabase PostgreSQL (evita error PGRST204 por campos cliente no existentes en SQL)
const ESQUEMA_COLUMNAS_SUPABASE = {
    programas: ['codigo_programa', 'nombre', 'descripcion', 'estado'],
    cursos: ['codigo_curso', 'nombre', 'hs_teoria', 'hs_practica', 'hs_totales', 'modalidad', 'estado'],
    instructores: ['codigo_instructor', 'nombre', 'apellido', 'dni', 'email', 'especialidad', 'tipo', 'estado'],
    dotacion: ['legajo', 'apellido', 'nombre', 'puesto', 'categoria', 'direccion', 'gerencia', 'jefatura', 'coordinacion', 'email', 'estado'],
    proveedores: ['codigo_proveedor', 'razon_social', 'ente', 'rubro', 'contacto', 'telefono', 'email', 'estado', 'carpetas_seguimiento'],
    capacitaciones: ['id_cap', 'programa', 'nombre_curso', 'estado', 'tema', 'fecha', 'hs_inicio', 'hs_fin', 'lugar', 'centro', 'instructor_1', 'instructor_2', 'observaciones', 'clase_nro', 'total_clases', 'fecha_eval_transferencia', 'estado_transferencia', 'fecha_envio_transferencia', 'fecha_tra', 'estado_tra', 'estado_sat', 'estado_encuesta'],
    asistentes: ['id', 'id_cap', 'legajo', 'apellido', 'nombre', 'puesto', 'categoria', 'direccion', 'gerencia', 'jefatura', 'email', 'calificacion', 'observaciones'],
    evaluaciones: ['id', 'id_cap', 'instructor', 'puntaje_objetivos', 'puntaje_aplicabilidad', 'puntaje_instructor', 'puntaje_material', 'puntaje_entorno', 'puntaje_general', 'puntaje_docente', 'puntaje_contenido', 'destacados', 'sugerencias', 'comentarios', 'fecha_registro'],
    transferencias: ['id', 'id_cap', 'jefatura', 'nombre_curso', 'fecha_curso', 'legajo', 'nombre', 'aplica_contenidos', 'motivo_dificultad', 'plan_accion', 'firma_responsable', 'fecha_registro'],
    profiles: ['id', 'usuario', 'clave', 'nombre', 'email', 'rol', 'estado', 'creado_el'],
    certificaciones_externas: ['id', 'codigo', 'alcance', 'categoria', 'subcategoria', 'legajo', 'apellido_nombre', 'puesto', 'area_jefatura', 'proveedor_id', 'proveedor_ente', 'fecha_emision', 'fecha_vencimiento', 'tiene_vencimiento', 'archivo_pdf_nombre', 'observaciones']
};

window.mapearNombreTablaSupabase = function(nombreTabla) {
    if (!nombreTabla) return '';
    const n = String(nombreTabla).trim().toLowerCase();
    if (n === 'usuarios') return 'profiles';
    if (n === 'asistencias') return 'asistentes';
    if (n === 'evaluaciones_satisfaccion' || n === 'evaluacion_satisfaccion') return 'evaluaciones';
    if (n === 'encuestas_transferencia' || n === 'encuestas_transferencias') return 'transferencias';
    return n;
};

window.sanitizarFilaParaSupabase = function(nombreTabla, fila) {
    if (!fila || typeof fila !== 'object') return fila;
    const tablaReal = window.mapearNombreTablaSupabase(nombreTabla);
    const columnasPermitidas = ESQUEMA_COLUMNAS_SUPABASE[tablaReal];
    if (!columnasPermitidas) return { ...fila };

    const limpia = {};
    columnasPermitidas.forEach(col => {
        if (fila[col] !== undefined && fila[col] !== null) {
            limpia[col] = fila[col];
        }
    });
    return limpia;
};

// 1. Configuración de Credenciales de Supabase (con soporte para configuración en UI)
(function() {
    const PROYECTO_ACTUAL_URL = "https://hhksfdwzeesmydgllubh.supabase.co";
    const PROYECTO_ACTUAL_KEY = "sb_publishable_9IbGC-KAl8JtoX6jSjRHnQ_HantPIRf";

    let urlGuardada = localStorage.getItem('SIGA_SUPABASE_URL');
    let keyGuardada = localStorage.getItem('SIGA_SUPABASE_KEY');

    // Si el usuario tenía guardada la URL vieja o un proyecto previo inválido, migrar al proyecto oficial activo
    if (urlGuardada && (urlGuardada.includes('ktpogfjwfusdizebatiz') || (urlGuardada.includes('supabase.co') && !urlGuardada.includes('hhksfdwzeesmydgllubh')))) {
        console.warn("[SIGA Supabase] Detectada URL previa obsoleta (" + urlGuardada + "). Migrando a proyecto activo:", PROYECTO_ACTUAL_URL);
        localStorage.setItem('SIGA_SUPABASE_URL', PROYECTO_ACTUAL_URL);
        localStorage.setItem('SIGA_SUPABASE_KEY', PROYECTO_ACTUAL_KEY);
        urlGuardada = PROYECTO_ACTUAL_URL;
        keyGuardada = PROYECTO_ACTUAL_KEY;
    }

    window.SUPABASE_URL = urlGuardada || window.SUPABASE_URL || PROYECTO_ACTUAL_URL;
    window.SUPABASE_KEY = keyGuardada || window.SUPABASE_KEY || PROYECTO_ACTUAL_KEY;

    try {
        localStorage.setItem('SIGA_SUPABASE_URL', window.SUPABASE_URL);
        localStorage.setItem('SIGA_SUPABASE_KEY', window.SUPABASE_KEY);
    } catch(e) {}
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
            from(tablaOriginal) {
                const tabla = window.mapearNombreTablaSupabase(tablaOriginal);
                const baseURL = window.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + tabla;
                const headers = {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': 'Bearer ' + window.SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                };
                return {
                    select(columnas = '*') {
                        const ejecutarQuery = async (extraParams = '') => {
                            try {
                                const sep = extraParams ? (extraParams.startsWith('?') || extraParams.startsWith('&') ? extraParams : '&' + extraParams) : '';
                                const url = `${baseURL}?select=${encodeURIComponent(columnas)}${sep}`;
                                const r = await fetch(url, { headers });
                                if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}` } };
                                const data = await r.json();
                                return { data, error: null };
                            } catch (err) {
                                return { data: null, error: err };
                            }
                        };
                        return {
                            eq(col, val) {
                                return ejecutarQuery(`&${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`);
                            },
                            order(col, opts = {}) {
                                const dir = opts.ascending === false ? 'desc' : 'asc';
                                return ejecutarQuery(`&order=${encodeURIComponent(col)}.${dir}`);
                            },
                            limit(lim) {
                                return ejecutarQuery(`&limit=${lim}`);
                            },
                            then(resolve, reject) {
                                ejecutarQuery('').then(resolve, reject);
                            }
                        };
                    },
                    insert: async (datos, opts = {}) => {
                        try {
                            const filas = Array.isArray(datos) ? datos : [datos];
                            const filasSanitizadas = filas.map(f => window.sanitizarFilaParaSupabase(tabla, f));
                            const r = await fetch(baseURL, {
                                method: 'POST',
                                headers: { ...headers },
                                body: JSON.stringify(filasSanitizadas)
                            });
                            if (!r.ok) {
                                const errJson = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
                                return { data: null, error: errJson };
                            }
                            const data = await r.json().catch(() => true);
                            return { data, error: null };
                        } catch (err) {
                            return { data: null, error: err };
                        }
                    },
                    upsert: async (datos, opts = {}) => {
                        try {
                            const filas = Array.isArray(datos) ? datos : [datos];
                            const filasSanitizadas = filas.map(f => window.sanitizarFilaParaSupabase(tabla, f));
                            const params = opts.onConflict ? `?on_conflict=${encodeURIComponent(opts.onConflict)}` : '';
                            const r = await fetch(baseURL + params, {
                                method: 'POST',
                                headers: {
                                    ...headers,
                                    'Prefer': 'resolution=merge-duplicates,return=representation'
                                },
                                body: JSON.stringify(filasSanitizadas)
                            });
                            if (!r.ok) {
                                const errJson = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
                                return { data: null, error: errJson };
                            }
                            const data = await r.json().catch(() => true);
                            return { data, error: null };
                        } catch (err) {
                            return { data: null, error: err };
                        }
                    },
                    delete: () => ({
                        eq: async (col, val) => {
                            try {
                                const r = await fetch(`${baseURL}?${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`, {
                                    method: 'DELETE',
                                    headers: { ...headers }
                                });
                                if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}` } };
                                return { data: [], error: null };
                            } catch (err) {
                                return { data: null, error: err };
                            }
                        }
                    })
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

// Hidratación inicial automática desde Supabase Cloud a la base local
window.sincronizarCacheDesdeSupabase = async function() {
    if (!window.supabaseCloudClient) return false;
    try {
        const tablasCriticas = [
            { nube: 'programas', local: 'programas' },
            { nube: 'cursos', local: 'cursos' },
            { nube: 'instructores', local: 'instructores' },
            { nube: 'dotacion', local: 'dotacion' },
            { nube: 'proveedores', local: 'proveedores' },
            { nube: 'profiles', local: 'profiles' }
        ];
        
        await Promise.all(tablasCriticas.map(async ({ nube, local }) => {
            try {
                const { data, error } = await window.supabaseCloudClient.from(nube).select('*');
                if (!error && Array.isArray(data) && data.length > 0) {
                    if (window.dbLocal && window.dbLocal.raw) {
                        window.dbLocal.raw.escribirTabla(local, data);
                        window.dbLocal.raw.guardarTablaAsync(local, data).catch(() => {});
                    }
                }
            } catch (e) {}
        }));
        console.log("[SIGA Supabase] Caché local sincronizada con éxito desde Supabase Cloud.");
        return true;
    } catch (e) {
        console.warn("[SIGA Supabase] Fallo al sincronizar caché inicial:", e);
        return false;
    }
};

// Ejecutar sincronización de caché en segundo plano
if (typeof window !== "undefined") {
    setTimeout(() => {
        window.sincronizarCacheDesdeSupabase().catch(() => {});
    }, 100);
}

// 3. Motor Híbrido Persistente (Dual Write + Cloud Query + Offline Fallback)
// Permite guardar automáticamente en Supabase PostgreSQL en la nube Y al mismo tiempo
// mantener sincronizada la base local en IndexedDB para máxima velocidad y tolerancia a fallos.
function crearClienteHibrido() {
    return {
        from(nombreTabla) {
            const tablaNube = typeof window.mapearNombreTablaSupabase === 'function' ? window.mapearNombreTablaSupabase(nombreTabla) : nombreTabla;
            const cloudTable = window.supabaseCloudClient ? window.supabaseCloudClient.from(tablaNube) : null;
            const localTable = window.dbLocal ? window.dbLocal.from(nombreTabla) : null;

            return {
                select(columnas = '*') {
                    const self = {
                        _filtros: { tipo: null, arg1: null, arg2: null },
                        eq(col, val) {
                            this._filtros = { tipo: 'eq', arg1: col, arg2: val };
                            return this;
                        },
                        order(col, opts) {
                            this._filtros = { tipo: 'order', arg1: col, arg2: opts };
                            return this;
                        },
                        limit(num) {
                            this._filtros = { tipo: 'limit', arg1: num, arg2: null };
                            return this;
                        },
                        async _ejecutar() {
                            const { tipo, arg1, arg2 } = this._filtros;
                            // 1. Si Supabase Cloud está disponible, intentar consulta en nube
                            if (cloudTable) {
                                try {
                                    let q = cloudTable.select(columnas);
                                    if (tipo === 'eq') q = q.eq(arg1, arg2);
                                    else if (tipo === 'order') {
                                        if (typeof arg2 === 'object') q = q.order(arg1, arg2);
                                        else q = q.order(arg1, { ascending: arg2 !== false });
                                    }
                                    else if (tipo === 'limit') q = q.limit(arg1);

                                    const { data, error } = await q;
                                    if (!error && Array.isArray(data)) {
                                        // Cachear / actualizar en dbLocal silenciosamente si no es consulta puntual filtrada
                                        if (window.dbLocal && window.dbLocal.raw && columnas === '*' && tipo !== 'eq') {
                                            window.dbLocal.raw.escribirTabla(nombreTabla, data);
                                            window.dbLocal.raw.guardarTablaAsync(nombreTabla, data).catch(() => {});
                                        }
                                        return { data, error: null };
                                    }
                                    if (error) {
                                        console.warn(`[SIGA DualDB] Error select cloud en ${tablaNube}:`, error.message || error);
                                    }
                                } catch (e) {
                                    console.warn(`[SIGA DualDB] Fallo select cloud en ${tablaNube}, usando local:`, e);
                                }
                            }
                            // 2. Fallback transparente a dbLocal
                            if (localTable) {
                                let lq = localTable.select(columnas);
                                if (tipo === 'eq') lq = lq.eq(arg1, arg2);
                                else if (tipo === 'order') lq = lq.order(arg1, arg2);
                                else if (tipo === 'limit') lq = lq.limit(arg1);
                                return await lq;
                            }
                            return { data: [], error: null };
                        },
                        then(resolve, reject) {
                            this._ejecutar().then(resolve, reject);
                        }
                    };
                    return self;
                },

                async insert(filas, opciones) {
                    const items = Array.isArray(filas) ? filas : [filas];
                    let resCloud = { data: null, error: null };

                    // Sanitizar filas para el esquema de Supabase PostgreSQL
                    const filasSanitizadas = items.map(f => window.sanitizarFilaParaSupabase(tablaNube, f));

                    // 1. Guardar en Supabase PostgreSQL en la nube
                    if (cloudTable) {
                        try {
                            resCloud = await cloudTable.insert(filasSanitizadas, opciones);
                            if (resCloud.error) {
                                console.warn(`[SIGA DualDB] Error insert en Supabase (${tablaNube}):`, resCloud.error.message || resCloud.error);
                            }
                        } catch (err) {
                            console.warn(`[SIGA DualDB] Error insert en Supabase (${tablaNube}):`, err);
                            resCloud = { data: null, error: err };
                        }
                    }

                    // 2. Guardar en Base de Datos Local
                    if (localTable) {
                        try {
                            await localTable.insert(items);
                        } catch (e) {}
                    }

                    return resCloud.error && !localTable ? resCloud : { data: items, error: resCloud.error };
                },

                async upsert(filas, opciones) {
                    const items = Array.isArray(filas) ? filas : [filas];
                    let resCloud = { data: null, error: null };

                    // Sanitizar filas para el esquema de Supabase PostgreSQL
                    const filasSanitizadas = items.map(f => window.sanitizarFilaParaSupabase(tablaNube, f));

                    // 1. Upsert en Supabase PostgreSQL
                    if (cloudTable) {
                        try {
                            resCloud = await cloudTable.upsert(filasSanitizadas, opciones);
                            if (resCloud.error) {
                                console.warn(`[SIGA DualDB] Error upsert en Supabase (${tablaNube}):`, resCloud.error.message || resCloud.error);
                            }
                        } catch (err) {
                            console.warn(`[SIGA DualDB] Error upsert en Supabase (${tablaNube}):`, err);
                            resCloud = { data: null, error: err };
                        }
                    }

                    // 2. Upsert en Base de Datos Local
                    if (localTable) {
                        try {
                            await localTable.upsert(items);
                        } catch (e) {}
                    }

                    return resCloud.error && !localTable ? resCloud : { data: items, error: resCloud.error };
                },

                update(valores) {
                    const valoresSanitizados = window.sanitizarFilaParaSupabase(tablaNube, valores);
                    return {
                        async eq(col, val) {
                            let resCloud = { data: null, error: null };
                            if (cloudTable) {
                                try {
                                    resCloud = await cloudTable.update(valoresSanitizados).eq(col, val);
                                    if (resCloud.error) {
                                        console.warn(`[SIGA DualDB] Error update en Supabase (${tablaNube}):`, resCloud.error.message || resCloud.error);
                                    }
                                } catch (err) {
                                    console.warn(`[SIGA DualDB] Error update en Supabase (${tablaNube}):`, err);
                                    resCloud = { data: null, error: err };
                                }
                            }
                            if (localTable) {
                                try {
                                    await localTable.update(valores).eq(col, val);
                                } catch (e) {}
                            }
                            return resCloud.error && !localTable ? resCloud : { data: [valores], error: resCloud.error };
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
                                    if (resCloud.error) {
                                        console.warn(`[SIGA DualDB] Error delete en Supabase (${tablaNube}):`, resCloud.error.message || resCloud.error);
                                    }
                                } catch (err) {
                                    console.warn(`[SIGA DualDB] Error delete en Supabase (${tablaNube}):`, err);
                                    resCloud = { data: null, error: err };
                                }
                            }
                            if (localTable) {
                                try {
                                    await localTable.delete().eq(col, val);
                                } catch (e) {}
                            }
                            return resCloud.error && !localTable ? resCloud : { data: [], error: resCloud.error };
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
        if (typeof inicializarSupabaseCloud === 'function') inicializarSupabaseCloud();
    }
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
        { nombre: 'evaluaciones', pk: 'id' },
        { nombre: 'transferencias', pk: 'id' },
        { nombre: 'certificaciones_externas', pk: 'id' }
    ];

    let totalSubidos = 0;
    let erroresReportados = [];

    for (let i = 0; i < tablas.length; i++) {
        const { nombre, pk } = tablas[i];
        if (typeof onProgreso === 'function') {
            onProgreso(`Sincronizando tabla ${i + 1}/${tablas.length}: ${nombre}...`, Math.round(((i) / tablas.length) * 100));
        }

        let datos = [];
        if (window.dbLocal && window.dbLocal.raw) {
            datos = window.dbLocal.raw.leerTabla(nombre) || [];
            if (datos.length === 0 && nombre === 'evaluaciones') {
                datos = window.dbLocal.raw.leerTabla('evaluaciones_satisfaccion') || [];
            }
        }

        if (datos.length > 0) {
            try {
                const datosSanitizados = datos.map(f => window.sanitizarFilaParaSupabase(nombre, f));
                const LOTE = 50;
                for (let j = 0; j < datosSanitizados.length; j += LOTE) {
                    const lote = datosSanitizados.slice(j, j + LOTE);
                    const opts = pk ? { onConflict: pk } : {};
                    const { error } = await window.supabaseCloudClient.from(nombre).upsert(lote, opts);
                    if (error) {
                        console.error(`[Sincronización] Error en tabla ${nombre}:`, error.message);
                        erroresReportados.push(`${nombre}: ${error.message}`);
                    } else {
                        totalSubidos += lote.length;
                    }
                }
            } catch (err) {
                console.error(`Error subiendo tabla ${nombre} a Supabase:`, err);
                erroresReportados.push(`${nombre}: ${err.message}`);
            }
        }
    }

    if (typeof onProgreso === 'function') {
        onProgreso("¡Sincronización a Supabase Cloud completada!", 100);
    }
    return { exito: true, totalRegistros: totalSubidos, errores: erroresReportados };
};

// Descargar todas las tablas de Supabase Cloud a dbLocal
window.descargarTodoDeSupabase = async function(onProgreso) {
    if (!window.supabaseCloudClient) {
        if (typeof inicializarSupabaseCloud === 'function') inicializarSupabaseCloud();
    }
    if (!window.supabaseCloudClient) {
        throw new Error("Cliente Supabase no inicializado. Verificá la URL y Anon Key.");
    }
    const tablas = [
        { nube: 'profiles', local: 'profiles' },
        { nube: 'programas', local: 'programas' },
        { nube: 'cursos', local: 'cursos' },
        { nube: 'instructores', local: 'instructores' },
        { nube: 'dotacion', local: 'dotacion' },
        { nube: 'proveedores', local: 'proveedores' },
        { nube: 'capacitaciones', local: 'capacitaciones' },
        { nube: 'asistentes', local: 'asistentes' },
        { nube: 'evaluaciones', local: 'evaluaciones_satisfaccion' },
        { nube: 'transferencias', local: 'transferencias' },
        { nube: 'certificaciones_externas', local: 'certificaciones_externas' }
    ];

    let totalDescargados = 0;
    for (let i = 0; i < tablas.length; i++) {
        const { nube, local } = tablas[i];
        if (typeof onProgreso === 'function') {
            onProgreso(`Descargando tabla ${i + 1}/${tablas.length}: ${nube}...`, Math.round(((i) / tablas.length) * 100));
        }
        try {
            const { data, error } = await window.supabaseCloudClient.from(nube).select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                if (window.dbLocal && window.dbLocal.raw) {
                    window.dbLocal.raw.escribirTabla(local, data);
                    await window.dbLocal.raw.guardarTablaAsync(local, data);
                    if (nube === 'evaluaciones') {
                        window.dbLocal.raw.escribirTabla('evaluaciones', data);
                        await window.dbLocal.raw.guardarTablaAsync('evaluaciones', data);
                    }
                }
                totalDescargados += data.length;
            }
        } catch (e) {
            console.warn(`Error al descargar tabla ${nube}:`, e);
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
