// ===================================================================
// SIGA-AP - MOTOR DE BASE DE DATOS LOCAL Y PERSISTENCIA OFFLINE
// ===================================================================
// Diseñado para funcionar 100% en PC local sin servidores externos.
// Soporta las 10 tablas del sistema con consultas, inserciones, actualizaciones y borrados.
// Utiliza IndexedDB de alta capacidad + caché en memoria + fallback localStorage.

(function () {
    const TABLAS = [
        'dotacion',
        'capacitaciones',
        'asistentes',
        'cursos',
        'programas',
        'instructores',
        'evaluaciones_satisfaccion',
        'transferencias',
        'encuestas_transferencia',
        'profiles',
        'certificaciones_externas',
        'proveedores'
    ];

    const STORAGE_PREFIX = 'SIGA_DB_';
    const IDB_NAME = 'SIGA_APP_DB';
    const IDB_VERSION = 1;
    const IDB_STORE = 'tablas';

    // Caché en memoria para acceso sincrónico instantáneo
    window._SIGA_MEM_DB = window._SIGA_MEM_DB || {};
    const CACHE_TABLAS = window._SIGA_MEM_DB;

    // 1. Datos iniciales por defecto (catálogos básicos)
    const DATOS_INICIALES = {
        programas: [
            { id: 1, codigo_programa: 'PRO-001', nombre: 'Seguridad y Prevención', estado: 'Activo' },
            { id: 2, codigo_programa: 'PRO-002', nombre: 'Operaciones y Mantenimiento', estado: 'Activo' },
            { id: 3, codigo_programa: 'PRO-003', nombre: 'Calidad y Servicio al Cliente', estado: 'Activo' },
            { id: 4, codigo_programa: 'PRO-004', nombre: 'Liderazgo y Gestión', estado: 'Activo' },
            { id: 5, codigo_programa: 'PRO-005', nombre: 'Tecnología y Sistemas', estado: 'Activo' }
        ],
        cursos: [
            { id: 1, codigo_curso: 'CUR-001', nombre: 'Mantenimiento Mecánico Básico', modalidad: 'Presencial', hs_teoria: 10, hs_practica: 10, hs_totales: 20, estado: 'Activo' },
            { id: 2, codigo_curso: 'CUR-002', nombre: 'Seguridad Operacional y Normativas', modalidad: 'Presencial', hs_teoria: 8, hs_practica: 4, hs_totales: 12, estado: 'Activo' },
            { id: 3, codigo_curso: 'CUR-003', nombre: 'Manejo de Redes de Alta Tensión', modalidad: 'Presencial', hs_teoria: 15, hs_practica: 15, hs_totales: 30, estado: 'Activo' },
            { id: 4, codigo_curso: 'CUR-004', nombre: 'Liderazgo y Gestión de Equipos', modalidad: 'Virtual Sincrónico', hs_teoria: 12, hs_practica: 4, hs_totales: 16, estado: 'Activo' },
            { id: 5, codigo_curso: 'CUR-005', nombre: 'Telecomunicaciones Ferroviarias', modalidad: 'Híbrido', hs_teoria: 10, hs_practica: 10, hs_totales: 20, estado: 'Activo' },
            { id: 6, codigo_curso: 'CUR-006', nombre: 'Primeros Auxilios y RCP en Planta', modalidad: 'Presencial', hs_teoria: 4, hs_practica: 4, hs_totales: 8, estado: 'Activo' },
            { id: 7, codigo_curso: 'CUR-007', nombre: 'Electroneumática e Hidráulica Industrial', modalidad: 'Presencial', hs_teoria: 10, hs_practica: 10, hs_totales: 20, estado: 'Activo' },
            { id: 8, codigo_curso: 'CUR-008', nombre: 'Protocolos de Evacuación y Emergencias', modalidad: 'Presencial', hs_teoria: 4, hs_practica: 4, hs_totales: 8, estado: 'Activo' },
            { id: 9, codigo_curso: 'CUR-009', nombre: 'Gestión de Calidad en la Atención al Usuario', modalidad: 'Virtual Sincrónico', hs_teoria: 8, hs_practica: 2, hs_totales: 10, estado: 'Activo' },
            { id: 10, codigo_curso: 'CUR-010', nombre: 'Sistemas de Señalización Automática', modalidad: 'Presencial', hs_teoria: 15, hs_practica: 15, hs_totales: 30, estado: 'Activo' }
        ],
        instructores: [
            { id: 1, codigo_instructor: 'INS-001', nombre: 'Carlos', apellido: 'Rodríguez', especialidad: 'Mecánica', tipo: 'Interno', estado: 'Activo' },
            { id: 2, codigo_instructor: 'INS-002', nombre: 'Mariana', apellido: 'López', especialidad: 'Seguridad e Higiene', tipo: 'Interno', estado: 'Activo' },
            { id: 3, codigo_instructor: 'INS-003', nombre: 'Gustavo', apellido: 'Fernández', especialidad: 'Electricidad y Tracción', tipo: 'Externo', estado: 'Activo' },
            { id: 4, codigo_instructor: 'INS-004', nombre: 'Patricia', apellido: 'Gómez', especialidad: 'Atención al Pasajero', tipo: 'Interno', estado: 'Activo' },
            { id: 5, codigo_instructor: 'INS-005', nombre: 'Sebastián', apellido: 'Díaz', especialidad: 'Telecomunicaciones', tipo: 'Interno', estado: 'Activo' }
        ],
        profiles: [
            { id: 1, usuario: 'Admin', clave: 'CFT2026', nombre: 'Ariel Pizzutto', email: 'ariel.pizzutto@alumnos.udemm.edu.ar', rol: 'Administrador', estado: 'Activo', creado_el: '2026-08-19' },
            { id: 2, usuario: 'Operador', clave: 'CFT2026', nombre: 'Operador Capacitación', email: 'capacitacion@empresa.com', rol: 'Operador', estado: 'Activo', creado_el: '2026-08-19' },
            { id: 3, usuario: 'Auditor', clave: 'CFT2026', nombre: 'Consulta Reportes', email: 'reportes@empresa.com', rol: 'Reportes', estado: 'Activo', creado_el: '2026-08-19' }
        ],
        dotacion: [],
        capacitaciones: [],
        asistentes: [],
        evaluaciones_satisfaccion: [],
        evaluaciones: [],
        transferencias: [],
        encuestas_transferencia: [],
        certificaciones_externas: [
            {
                id: 1,
                codigo: "IRAM-UT-2024-884",
                alcance: "Nivel II (IRAM-ISO 9712)",
                categoria: "END",
                subcategoria: "Ultrasonido",
                legajo: 1002,
                apellido_nombre: "ALBARRACIN, CARLOS",
                puesto: "Técnico Especialista de Ensayos",
                area_jefatura: "Jefatura Material Rodante",
                proveedor_id: "PRV-001",
                proveedor_ente: "IRAM - UTN",
                fecha_emision: "2024-04-10",
                fecha_vencimiento: "2027-04-10",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Certificado_UT_Albarracin.pdf",
                observaciones: "Ensayos ultrasónicos en ejes y ruedas ferroviarias s/ IRAM-ISO 9712"
            },
            {
                id: 2,
                codigo: "BV-UT-2024-109",
                alcance: "Nivel II",
                categoria: "END",
                subcategoria: "Ultrasonido",
                legajo: 1005,
                apellido_nombre: "BENITEZ, DANIEL",
                puesto: "Inspector de Vía y Obras",
                area_jefatura: "Jefatura de Vías",
                proveedor_id: "PRV-002",
                proveedor_ente: "Bureau Veritas",
                fecha_emision: "2024-10-15",
                fecha_vencimiento: "2026-10-15",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Certificado_UT_Benitez.pdf",
                observaciones: "Inspección ultrasónica en soldaduras y rieles"
            },
            {
                id: 3,
                codigo: "TUV-LP-2025-412",
                alcance: "Nivel II",
                categoria: "END",
                subcategoria: "Líquidos Penetrantes",
                legajo: 1008,
                apellido_nombre: "CASTRO, ESTEBAN",
                puesto: "Analista de Control de Calidad",
                area_jefatura: "Gerencia de Calidad",
                proveedor_id: "PRV-003",
                proveedor_ente: "TÜV Rheinland",
                fecha_emision: "2025-05-18",
                fecha_vencimiento: "2027-05-18",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Certificado_LP_Castro.pdf",
                observaciones: "Método Fluorescente y Visible s/ ISO 9712 Nivel II"
            },
            {
                id: 4,
                codigo: "CNEA-PM-2024-302",
                alcance: "Nivel I",
                categoria: "END",
                subcategoria: "Partículas Magnetizables",
                legajo: 1012,
                apellido_nombre: "DIAZ, FERNANDO",
                puesto: "Técnico Mecánico de Taller",
                area_jefatura: "Jefatura de Mantenimiento Mecánico",
                proveedor_id: "PRV-004",
                proveedor_ente: "CNEA / AAENDE",
                fecha_emision: "2024-11-20",
                fecha_vencimiento: "2026-11-20",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Certificado_PM_Diaz.pdf",
                observaciones: "Yugo electromagnético y bobina de magnetización"
            },
            {
                id: 5,
                codigo: "THERMIT-ALU-2025-55",
                alcance: "Rieles Vignole (Norma FA 7040)",
                categoria: "Soldadores",
                subcategoria: "Soldadura Aluminotérmica",
                legajo: 1015,
                apellido_nombre: "ESTEVEZ, GABRIEL",
                puesto: "Oficial Soldador de Vía",
                area_jefatura: "Jefatura Vías y Obras",
                proveedor_id: "PRV-006",
                proveedor_ente: "Elektro-Thermit / IRAM",
                fecha_emision: "2025-06-12",
                fecha_vencimiento: "2026-12-12",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Certificado_Aluminotermica_Estevez.pdf",
                observaciones: "Soldadura en rieles UIC 54 y Vignole"
            },
            {
                id: 6,
                codigo: "UTN-SMAW-2025-901",
                alcance: "Posición 6G (AWS D1.1)",
                categoria: "Soldadores",
                subcategoria: "Soldadura SMAW",
                legajo: 1019,
                apellido_nombre: "FARIAS, HECTOR",
                puesto: "Soldador de Estructuras",
                area_jefatura: "Jefatura Taller Central",
                proveedor_id: "PRV-005",
                proveedor_ente: "UTN FRBA",
                fecha_emision: "2025-03-10",
                fecha_vencimiento: "2027-03-10",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Certificado_SMAW_Farias.pdf",
                observaciones: "Calificación según código AWS D1.1 posición 6G"
            },
            {
                id: 7,
                codigo: "IRAM-3923-HIDRO-741",
                alcance: "Hasta 30 Tn/m",
                categoria: "Equipos de Izaje",
                subcategoria: "Hidrogrúa",
                legajo: 1022,
                apellido_nombre: "GIMENEZ, IGNACIO",
                puesto: "Operador de Hidrogrúa y Auxilio",
                area_jefatura: "Jefatura de Logística y Transporte",
                proveedor_id: "PRV-007",
                proveedor_ente: "IRAM 3923 / IAPG",
                fecha_emision: "2024-10-30",
                fecha_vencimiento: "2026-10-30",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Carnet_Hidrogrua_Gimenez.pdf",
                observaciones: "Operación de Grúas Articuladas hasta 30 Tn/m"
            },
            {
                id: 8,
                codigo: "BV-PTE-GRUA-2025-110",
                alcance: "Hasta 50 Tn",
                categoria: "Equipos de Izaje",
                subcategoria: "Puente Grúa",
                legajo: 1025,
                apellido_nombre: "HERRERA, JAVIER",
                puesto: "Operador de Puente Grúa Nave Principal",
                area_jefatura: "Jefatura Mantenimiento Pesado",
                proveedor_id: "PRV-002",
                proveedor_ente: "Bureau Veritas",
                fecha_emision: "2025-01-15",
                fecha_vencimiento: "2027-01-15",
                tiene_vencimiento: true,
                archivo_pdf_nombre: "Carnet_Puente_Herrera.pdf",
                observaciones: "Operación de Puente Grúa con Cabina y Mando Radial hasta 50 Tn"
            }
        ],
        proveedores: [
            { id: 1, codigo_proveedor: "PRV-001", razon_social: "IRAM - Instituto Argentino de Normalización y Certificación", ente: "IRAM", rubro: "Normas Técnicas, END y Soldadura", contacto: "Ing. Gustavo Martínez", telefono: "+54 11 4346-0600", email: "certificaciones@iram.org.ar", estado: "Activo" },
            { id: 2, codigo_proveedor: "PRV-002", razon_social: "Bureau Veritas Argentina S.A.", ente: "Bureau Veritas", rubro: "Inspección, END e Izaje", contacto: "Lic. Mariana Gómez", telefono: "+54 11 4338-0000", email: "info.ar@bureauveritas.com", estado: "Activo" },
            { id: 3, codigo_proveedor: "PRV-003", razon_social: "TÜV Rheinland Argentina S.A.", ente: "TÜV Rheinland", rubro: "Certificación y Calificación Técnica", contacto: "Ing. Roberto Soler", telefono: "+54 11 4555-8800", email: "certificaciones@ar.tuv.com", estado: "Activo" },
            { id: 4, codigo_proveedor: "PRV-004", razon_social: "CNEA - Comisión Nacional de Energía Atómica / AAENDE", ente: "CNEA / AAENDE", rubro: "Ensayos No Destructivos ISO 9712", contacto: "Dr. Fernando Morales", telefono: "+54 11 6772-7000", email: "calificacion@cnea.gob.ar", estado: "Activo" },
            { id: 5, codigo_proveedor: "PRV-005", razon_social: "UTN FRBA - Facultad Regional Buenos Aires", ente: "UTN FRBA", rubro: "Capacitación y Homologación Técnica", contacto: "Ing. Pablo Rossi", telefono: "+54 11 4867-7500", email: "extension@frba.utn.edu.ar", estado: "Activo" },
            { id: 6, codigo_proveedor: "PRV-006", razon_social: "Elektro-Thermit Argentina S.R.L.", ente: "Elektro-Thermit / IRAM", rubro: "Soldadura Ferroviaria y Aluminotérmica", contacto: "Ing. Javier Bianchi", telefono: "+54 11 4756-1200", email: "tecnica@thermit.com.ar", estado: "Activo" },
            { id: 7, codigo_proveedor: "PRV-007", razon_social: "IAPG - Instituto Argentino del Petróleo y del Gas", ente: "IAPG / IRAM 3923", rubro: "Certificación de Grúas y Equipos de Izaje", contacto: "Ing. Marcelo Domínguez", telefono: "+54 11 5277-4274", email: "certificaciones@iapg.org.ar", estado: "Activo" },
            { id: 8, codigo_proveedor: "PRV-008", razon_social: "SGS Argentina S.A.", ente: "SGS", rubro: "Inspección y Ensayos Industriales", contacto: "Ing. Carolina Varela", telefono: "+54 11 4124-2000", email: "ar.industrial@sgs.com", estado: "Activo" },
            { id: 9, codigo_proveedor: "PRV-009", razon_social: "DNV GL Argentina", ente: "DNV", rubro: "Certificación Industrial y Calidad", contacto: "Lic. Andrés Bellini", telefono: "+54 11 4310-9100", email: "argentina@dnv.com", estado: "Activo" },
            { id: 10, codigo_proveedor: "PRV-010", razon_social: "Lincoln Electric Argentina S.A.", ente: "Lincoln Electric / IRAM", rubro: "Calificación Soldadura SMAW/MIG", contacto: "Ing. Daniel Pereyra", telefono: "+54 11 4762-8000", email: "calidad@lincolnelectric.com.ar", estado: "Activo" }
        ]
    };

    // Helper IndexedDB y Promesa de DB Lista
    let idbPromise = null;
    let resolverDBReady = null;
    window._SIGA_DB_IS_READY = false;
    window._SIGA_DB_READY_PROMISE = new Promise((resolve) => {
        resolverDBReady = resolve;
    });

    function getIDB() {
        if (!idbPromise) {
            idbPromise = new Promise((resolve, reject) => {
                if (typeof indexedDB === 'undefined') {
                    console.warn("[SIGA DB] IndexedDB no soportado en este entorno.");
                    resolve(null);
                    return;
                }
                const req = indexedDB.open(IDB_NAME, IDB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE, { keyPath: 'tabla' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => {
                    console.error("[SIGA DB] IndexedDB error al abrir:", e);
                    resolve(null);
                };
            });
        }
        return idbPromise;
    }

    function guardarEnIndexedDB(tabla, datos) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await getIDB();
                if (!db) {
                    resolve(false);
                    return;
                }
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                const req = store.put({ tabla: tabla, datos: datos, fecha: Date.now(), total: (Array.isArray(datos) ? datos.length : 0) });
                
                tx.oncomplete = () => {
                    resolve(true);
                };
                tx.onerror = (err) => {
                    console.error(`[SIGA DB] Error en transacción IndexedDB (${tabla}):`, err);
                    resolve(false);
                };
                req.onerror = (err) => {
                    console.error(`[SIGA DB] Error en put IndexedDB (${tabla}):`, err);
                    resolve(false);
                };
            } catch (err) {
                console.error(`[SIGA DB] Excepción guardando en IndexedDB (${tabla}):`, err);
                resolve(false);
            }
        });
    }

    async function cargarDesdeIndexedDB() {
        try {
            const db = await getIDB();
            if (!db) {
                await finalizarCargaInicial();
                return;
            }
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.getAll();
            req.onsuccess = async () => {
                const registros = req.result || [];
                registros.forEach(item => {
                    if (item && item.tabla && Array.isArray(item.datos) && item.datos.length > 0) {
                        CACHE_TABLAS[item.tabla] = item.datos;
                    }
                });
                await finalizarCargaInicial();
            };
            req.onerror = async (err) => {
                console.error("[SIGA DB] Error leyendo store en IndexedDB:", err);
                await finalizarCargaInicial();
            };
        } catch (err) {
            console.error("[SIGA DB] Error cargando IndexedDB:", err);
            await finalizarCargaInicial();
        }
    }

    // Exponer datos iniciales para fallbacks seguros
    window.SIGA_DATOS_INICIALES = DATOS_INICIALES;

    async function finalizarCargaInicial() {
        // Detectar si el sistema ya fue inicializado o si ya existen datos reales en memoria o en IndexedDB
        let yaInicializado = localStorage.getItem('SIGA_SISTEMA_INICIALIZADO') === 'true' || 
                             localStorage.getItem('SIGA_USUARIO_DATOS_IMPORTADOS') === 'true' ||
                             (CACHE_TABLAS['_meta_flags'] && CACHE_TABLAS['_meta_flags'].inicializado === true);

        // Si ya hay registros persistidos en tablas críticas, marcar como inicializado para nunca sobreescribir datos reales
        const tablasPrincipales = ['dotacion', 'capacitaciones', 'asistentes', 'certificaciones_externas'];
        for (const t of tablasPrincipales) {
            if (Array.isArray(CACHE_TABLAS[t]) && CACHE_TABLAS[t].length > 0) {
                yaInicializado = true;
                break;
            }
        }

        // Asegurar que proveedores tenga datos iniciales si es el primer arranque y quedó vacía
        if (!yaInicializado && (!CACHE_TABLAS['proveedores'] || CACHE_TABLAS['proveedores'].length === 0)) {
            if (DATOS_INICIALES['proveedores'] && DATOS_INICIALES['proveedores'].length > 0) {
                CACHE_TABLAS['proveedores'] = [...DATOS_INICIALES['proveedores']];
                guardarTablaAsync('proveedores', CACHE_TABLAS['proveedores']);
            }
        }

        // Asegurar que certificaciones_externas tenga datos si es el primer arranque y quedó vacía
        if (!yaInicializado && (!CACHE_TABLAS['certificaciones_externas'] || CACHE_TABLAS['certificaciones_externas'].length === 0)) {
            if (DATOS_INICIALES['certificaciones_externas'] && DATOS_INICIALES['certificaciones_externas'].length > 0) {
                CACHE_TABLAS['certificaciones_externas'] = [...DATOS_INICIALES['certificaciones_externas']];
                guardarTablaAsync('certificaciones_externas', CACHE_TABLAS['certificaciones_externas']);
            }
        } else if (CACHE_TABLAS['certificaciones_externas']) {
            // Migrar o asignar alcance en certificados existentes que no lo posean
            let certsActualizados = false;
            CACHE_TABLAS['certificaciones_externas'].forEach(c => {
                if (!c.alcance || String(c.alcance).trim() === '') {
                    if (c.categoria === 'END') c.alcance = 'Nivel II';
                    else if (c.subcategoria && c.subcategoria.includes('SMAW')) c.alcance = 'Posición 6G';
                    else if (c.subcategoria && c.subcategoria.includes('Aluminotérmica')) c.alcance = 'Rieles Vignole';
                    else if (c.categoria === 'Equipos de Izaje') c.alcance = 'Hasta 30 Tn';
                    else c.alcance = 'Nivel Estándar';
                    certsActualizados = true;
                }
            });
            if (certsActualizados) {
                guardarTablaAsync('certificaciones_externas', CACHE_TABLAS['certificaciones_externas']);
            }
        }

        // Cargar desde data/*.json ÚNICAMENTE si es el primer inicio virgen (nunca se importaron ni persistieron datos)
        if (!yaInicializado) {
            const tablasCriticas = ['capacitaciones', 'asistentes', 'cursos', 'programas', 'dotacion', 'evaluaciones_satisfaccion'];
            await Promise.all(tablasCriticas.map(async tabla => {
                if (!CACHE_TABLAS[tabla] || CACHE_TABLAS[tabla].length === 0) {
                    const rutas = [`data/${tabla}.json?v=${Date.now()}`, `/data/${tabla}.json`, `./data/${tabla}.json`];
                    for (const ruta of rutas) {
                        try {
                            const res = await fetch(ruta);
                            if (res && res.ok) {
                                const datos = await res.json();
                                if (Array.isArray(datos) && datos.length > 0) {
                                    CACHE_TABLAS[tabla] = datos;
                                    await guardarTablaAsync(tabla, datos);
                                    if (tabla === 'dotacion' || tabla === 'asistentes') {
                                        actualizarVariableGlobalEmpleados();
                                    }
                                    break;
                                }
                            }
                        } catch (e) {}
                    }
                }
            }));
            try {
                localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
            } catch (e) {}
        }

        // Normalizar y reparar catálogos básicos si faltan códigos o hay registros undefined
        normalizarCatalogosBasicos();
        actualizarVariableGlobalEmpleados();
        normalizarEstadosSeriesCapacitaciones();

        window._SIGA_DB_IS_READY = true;
        if (typeof resolverDBReady === 'function') {
            resolverDBReady(true);
        }

        // Notificar que la base de datos está totalmente lista
        window.dispatchEvent(new CustomEvent('siga_db_ready', { detail: { tablas: Object.keys(CACHE_TABLAS) } }));
        if (typeof window.actualizarFechaDotacionUI === 'function') {
            window.actualizarFechaDotacionUI();
        }
    }

    async function esperarDBLista() {
        if (window._SIGA_DB_IS_READY) return true;
        if (window._SIGA_DB_READY_PROMISE) {
            await window._SIGA_DB_READY_PROMISE;
        }
        return true;
    }

    // Normaliza la consistencia de estados para capacitaciones multi-clase
    // Regla de negocio: Cada clase mantiene su estado independiente (ej. Programado para fechas futuras).
    // Ninguna clase se finaliza automáticamente por la existencia o guardado de otra clase en la serie.
    // La finalización se produce exclusivamente al registrar y cerrar la asistencia de cada clase específica.
    function normalizarEstadosSeriesCapacitaciones() {
        // Mantener función segura como no-op para compatibilidad con llamadas existentes
        return;
    }

    // Función universal para convertir fechas de Excel (números seriales como 46309.87) a formato legible
    function normalizarFecha(val) {
        if (!val) return '';
        const num = Number(val);
        if (!isNaN(num) && num > 30000 && num < 75000) {
            const ms = Math.round((num - 25569) * 86400 * 1000);
            const d = new Date(ms);
            if (!isNaN(d.getTime())) {
                const anio = d.getUTCFullYear();
                const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dia = String(d.getUTCDate()).padStart(2, '0');
                return `${anio}-${mes}-${dia}`;
            }
        }
        const str = String(val).trim();
        if (str.includes('/')) {
            const partes = str.split('/');
            if (partes.length === 3) {
                const dia = partes[0].padStart(2, '0');
                const mes = partes[1].padStart(2, '0');
                const anio = partes[2].length === 2 ? '20' + partes[2] : partes[2];
                return `${anio}-${mes}-${dia}`;
            }
        }
        if (str.includes('T')) {
            return str.split('T')[0];
        }
        return str;
    }

    function formatearFechaLegible(val) {
        if (!val) return '-';
        const iso = normalizarFecha(val);
        if (!iso) return '-';
        const partes = iso.split('-');
        if (partes.length === 3 && partes[0].length === 4) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return val;
    }

    // Normalizar y reparar catálogos básicos si faltan códigos o hay registros undefined
    function normalizarCatalogosBasicos() {
        // 1. Programas
        const progs = CACHE_TABLAS['programas'] || [];
        if (Array.isArray(progs) && progs.length > 0) {
            let cambios = false;
            const validos = [];
            progs.forEach((p, idx) => {
                if (!p || (typeof p === 'object' && Object.keys(p).length === 0)) return;
                if (!p.nombre && !p.codigo_programa && !p.id) return;

                let cod = p.codigo_programa;
                if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
                    cod = p.codigo || (p.id ? `PRO-${String(p.id).padStart(3, '0')}` : `PRO-${String(idx + 1).padStart(3, '0')}`);
                    p.codigo_programa = cod;
                    cambios = true;
                }
                if (!p.id) {
                    p.id = idx + 1;
                    cambios = true;
                }
                if (!p.estado) {
                    p.estado = 'Activo';
                    cambios = true;
                }
                validos.push(p);
            });
            if (cambios || validos.length !== progs.length) {
                CACHE_TABLAS['programas'] = validos;
                escribirTabla('programas', validos);
            }
        }

        // 2. Cursos
        const cursos = CACHE_TABLAS['cursos'] || [];
        if (Array.isArray(cursos) && cursos.length > 0) {
            let cambios = false;
            const validos = [];
            cursos.forEach((c, idx) => {
                if (!c || (typeof c === 'object' && Object.keys(c).length === 0)) return;
                if (!c.nombre && !c.codigo_curso && !c.id) return;

                let cod = c.codigo_curso;
                if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
                    cod = c.codigo || (c.id ? `CUR-${String(c.id).padStart(3, '0')}` : `CUR-${String(idx + 1).padStart(3, '0')}`);
                    c.codigo_curso = cod;
                    cambios = true;
                }
                if (!c.id) {
                    c.id = idx + 1;
                    cambios = true;
                }
                if (!c.estado) {
                    c.estado = 'Activo';
                    cambios = true;
                }
                if (c.hs_totales === undefined || c.hs_totales === null) {
                    c.hs_totales = (Number(c.hs_teoria) || 0) + (Number(c.hs_practica) || 0);
                    cambios = true;
                }
                validos.push(c);
            });
            if (cambios || validos.length !== cursos.length) {
                CACHE_TABLAS['cursos'] = validos;
                escribirTabla('cursos', validos);
            }
        }

        // 3. Instructores
        const insts = CACHE_TABLAS['instructores'] || [];
        if (Array.isArray(insts) && insts.length > 0) {
            let cambios = false;
            const validos = [];
            insts.forEach((i, idx) => {
                if (!i || (typeof i === 'object' && Object.keys(i).length === 0)) return;
                if (!i.nombre && !i.apellido && !i.codigo_instructor && !i.id) return;

                let cod = i.codigo_instructor;
                if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
                    cod = i.codigo || (i.id ? `INS-${String(i.id).padStart(3, '0')}` : `INS-${String(idx + 1).padStart(3, '0')}`);
                    i.codigo_instructor = cod;
                    cambios = true;
                }
                if (!i.id) {
                    i.id = idx + 1;
                    cambios = true;
                }
                if (!i.estado) {
                    i.estado = 'Activo';
                    cambios = true;
                }
                validos.push(i);
            });
            if (cambios || validos.length !== insts.length) {
                CACHE_TABLAS['instructores'] = validos;
                escribirTabla('instructores', validos);
            }
        }

        // 4. Dotación: asegurar que todos los campos oficiales de RRHH estén correctamente sincronizados
        const dota = CACHE_TABLAS['dotacion'] || [];
        if (Array.isArray(dota) && dota.length > 0) {
            let cambiosDota = false;
            dota.forEach(emp => {
                if (!emp || typeof emp !== 'object') return;
                const dc = emp.datos_completos || {};
                
                const colVal = (idx, fallbackName) => {
                    const c = `col_${idx}`;
                    if (emp[c] !== undefined && emp[c] !== null && String(emp[c]).trim() !== '') return String(emp[c]).trim();
                    if (dc[c] !== undefined && dc[c] !== null && String(dc[c]).trim() !== '') return String(dc[c]).trim();
                    if (fallbackName && emp[fallbackName] !== undefined && emp[fallbackName] !== null && String(emp[fallbackName]).trim() !== '') return String(emp[fallbackName]).trim();
                    if (fallbackName && dc[fallbackName] !== undefined && dc[fallbackName] !== null && String(dc[fallbackName]).trim() !== '') return String(dc[fallbackName]).trim();
                    return '';
                };

                const valPuesto = colVal(4, 'Puesto');
                const valCategoria = colVal(8, 'Categoría');
                const valDireccion = colVal(13, 'Departamento nivel 1');
                const valGerencia = colVal(14, 'Departamento nivel 2');
                const valCoord = colVal(15, 'Departamento nivel 3');
                const valJefatura = colVal(16, 'Departamento nivel 4');
                const valManager = colVal(19, 'Nombre del mánager');
                const valEmail = colVal(37, 'Correo electrónico principal');

                if (valPuesto && (!emp.puesto || /^\d+$/.test(emp.puesto))) { emp.puesto = valPuesto; cambiosDota = true; }
                if (valCategoria && (!emp.categoria || emp.categoria === '-')) { emp.categoria = valCategoria; cambiosDota = true; }
                if (valDireccion && (!emp.direccion || emp.direccion === '-')) { emp.direccion = valDireccion; cambiosDota = true; }
                if (valGerencia && (!emp.gerencia || emp.gerencia === '-')) { emp.gerencia = valGerencia; cambiosDota = true; }
                if (valCoord && (!emp.coordinacion || emp.coordinacion === '-')) { emp.coordinacion = valCoord; cambiosDota = true; }
                if (valJefatura && (!emp.jefatura || emp.jefatura === '-')) { emp.jefatura = valJefatura; cambiosDota = true; }
                if (valManager && (!emp.manager || emp.manager === '-')) { emp.manager = valManager; cambiosDota = true; }
                if (valEmail && (!emp.email || emp.email === '-')) { emp.email = valEmail; cambiosDota = true; }
            });
            if (cambiosDota) {
                CACHE_TABLAS['dotacion'] = dota;
                escribirTabla('dotacion', dota);
            }
        }
    }

    // Inicializar almacenamiento sincrónico inicial
    function inicializarTablas() {
        const yaInicializado = localStorage.getItem('SIGA_SISTEMA_INICIALIZADO') === 'true' || localStorage.getItem('SIGA_USUARIO_DATOS_IMPORTADOS') === 'true';

        TABLAS.forEach(tabla => {
            const clave = STORAGE_PREFIX + tabla;
            try {
                const raw = localStorage.getItem(clave);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length === 0 && !yaInicializado && DATOS_INICIALES[tabla] && DATOS_INICIALES[tabla].length > 0) {
                        CACHE_TABLAS[tabla] = [...DATOS_INICIALES[tabla]];
                        try {
                            localStorage.setItem(clave, JSON.stringify(CACHE_TABLAS[tabla]));
                        } catch (e) {}
                    } else {
                        CACHE_TABLAS[tabla] = parsed;
                    }
                } else {
                    const inicial = (!yaInicializado && DATOS_INICIALES[tabla]) ? DATOS_INICIALES[tabla] : [];
                    CACHE_TABLAS[tabla] = inicial;
                    try {
                        localStorage.setItem(clave, JSON.stringify(inicial));
                    } catch (e) {}
                }
            } catch (e) {
                CACHE_TABLAS[tabla] = (!yaInicializado && DATOS_INICIALES[tabla]) ? DATOS_INICIALES[tabla] : [];
            }
        });

        normalizarCatalogosBasicos();
        // Cargar datos pesados desde IndexedDB
        cargarDesdeIndexedDB();
        actualizarVariableGlobalEmpleados();
    }

    function normalizarNombreTabla(nombre) {
        if (!nombre) return '';
        const nom = String(nombre).trim().toLowerCase();
        if (nom === 'usuarios') return 'profiles';
        if (nom === 'evaluaciones' || nom === 'evaluacion' || nom === 'encuesta_satisfaccion' || nom === 'encuestas_satisfaccion') {
            return 'evaluaciones_satisfaccion';
        }
        if (nom === 'encuestas_transferencias') {
            return 'encuestas_transferencia';
        }
        return nom;
    }

    function leerTabla(nombreTabla) {
        nombreTabla = normalizarNombreTabla(nombreTabla);
        if (CACHE_TABLAS[nombreTabla] && Array.isArray(CACHE_TABLAS[nombreTabla])) {
            return CACHE_TABLAS[nombreTabla];
        }

        const clave = STORAGE_PREFIX + nombreTabla;
        try {
            const raw = localStorage.getItem(clave);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    CACHE_TABLAS[nombreTabla] = parsed;
                    return parsed;
                }
            }
        } catch (e) {}

        const def = DATOS_INICIALES[nombreTabla] || [];
        CACHE_TABLAS[nombreTabla] = def;
        return def;
    }

    function escribirTabla(nombreTabla, datos) {
        nombreTabla = normalizarNombreTabla(nombreTabla);
        const lista = Array.isArray(datos) ? datos : [];
        
        // 1. Guardar en memoria de inmediato (sincrónico)
        CACHE_TABLAS[nombreTabla] = lista;

        if (nombreTabla === 'dotacion') {
            actualizarVariableGlobalEmpleados();
            try {
                const ahora = new Date();
                const fechaHora = ahora.toLocaleDateString('es-AR') + ' ' + ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ` hs (${lista.length} empleados)`;
                localStorage.setItem('fechaUltimaDotacion', fechaHora);
                localStorage.setItem('SIGA_META_DOTACION_CANTIDAD', String(lista.length));
            } catch (e) {}
        }

        // 2. Guardar en IndexedDB (sin límite de 5MB)
        guardarEnIndexedDB(nombreTabla, lista);
        guardarEnIndexedDB('_meta_flags', { inicializado: true, usuarioDatosImportados: true, fecha: Date.now() });

        // Marcar flags de sistema inicializado prioritariamente en localStorage
        try {
            localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
            localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
        } catch (e) {}

        // 3. Intentar guardar copia en localStorage (con salvaguarda por si excede cuota de 5MB)
        const clave = STORAGE_PREFIX + nombreTabla;
        try {
            // Solo intentar guardar en localStorage si el tamaño estimado es razonable (< 2MB)
            if (lista.length < 5000) {
                localStorage.setItem(clave, JSON.stringify(lista));
            }
        } catch (e) {
            console.warn(`[SIGA DB] localStorage excedió cuota para '${nombreTabla}' (datos asegurados en IndexedDB).`);
        }

        // Notificar actualización de datos en caliente
        try {
            window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { tabla: nombreTabla } }));
        } catch (e) {}

        return true;
    }

    async function guardarTablaAsync(nombreTabla, datos) {
        nombreTabla = normalizarNombreTabla(nombreTabla);
        const lista = Array.isArray(datos) ? datos : [];
        CACHE_TABLAS[nombreTabla] = lista;

        if (nombreTabla === 'dotacion') {
            actualizarVariableGlobalEmpleados();
            try {
                const ahora = new Date();
                const fechaHora = ahora.toLocaleDateString('es-AR') + ' ' + ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ` hs (${lista.length} empleados)`;
                localStorage.setItem('fechaUltimaDotacion', fechaHora);
                localStorage.setItem('SIGA_META_DOTACION_CANTIDAD', String(lista.length));
            } catch (e) {}
        }

        // Marcar flags de inicialización inmediatamente
        try {
            localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
            localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
        } catch (e) {}

        // Esperar persistencia física completa en IndexedDB
        const ok = await guardarEnIndexedDB(nombreTabla, lista);
        await guardarEnIndexedDB('_meta_flags', { inicializado: true, usuarioDatosImportados: true, fecha: Date.now() });

        // Fallback secundario a localStorage si cabe
        const clave = STORAGE_PREFIX + nombreTabla;
        try {
            if (lista.length < 5000) {
                localStorage.setItem(clave, JSON.stringify(lista));
            }
        } catch (e) {
            console.warn(`[SIGA DB] localStorage excedió cuota para '${nombreTabla}' (datos asegurados en IndexedDB).`);
        }

        // Notificar actualización de datos en caliente
        try {
            window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { tabla: nombreTabla } }));
        } catch (e) {}

        return ok;
    }

    function actualizarVariableGlobalEmpleados() {
        const dot = CACHE_TABLAS['dotacion'] || leerTabla('dotacion') || [];
        window.empleadosData = dot;
        window.empleados = dot;
        window.dotacion = dot;
    }

    // Query Builder que emula la API fluida y encadenable de Supabase (select, delete, update, insert, upsert)
    class LocalQueryBuilder {
        constructor(nombreTabla) {
            this.nombreTabla = normalizarNombreTabla(nombreTabla);
            this.filtros = [];
            this.orden = null;
            this.limiteMax = null;
            this.tipoOperacion = 'select'; // 'select' | 'delete' | 'update'
            this.valoresUpdate = null;
        }

        select(columnas = '*') {
            this.tipoOperacion = 'select';
            this.columnas = columnas;
            return this;
        }

        update(valores) {
            this.tipoOperacion = 'update';
            this.valoresUpdate = valores || {};
            return this;
        }

        delete() {
            this.tipoOperacion = 'delete';
            return this;
        }

        eq(columna, valor) {
            this.filtros.push(item => {
                let valItem = item[columna];
                // Si la columna consultada no existe en el item, buscar en alias comunes
                if (valItem === undefined || valItem === null) {
                    if (columna === 'codigo_curso') valItem = item.codigo_curso || item.codigo || item.id || item.nombre;
                    else if (columna === 'codigo_programa') valItem = item.codigo_programa || item.codigo || item.id || item.nombre;
                    else if (columna === 'codigo_instructor') valItem = item.codigo_instructor || item.codigo || item.id;
                    else if (columna === 'usuario') valItem = item.usuario || item.id;
                    else if (columna === 'id_cap') valItem = item.id_cap || item.id;
                    else if (columna === 'id_tra') valItem = item.id_tra || item.id;
                    else if (columna === 'legajo') valItem = item.legajo || item.id;
                    else if (columna === 'id') valItem = item.id || item.codigo_curso || item.codigo_programa || item.codigo_instructor || item.usuario;
                }
                if (valItem === undefined || valItem === null) return valor === null || valor === '';
                return String(valItem).trim().toLowerCase() === String(valor).trim().toLowerCase();
            });
            return this;
        }

        neq(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                return String(valItem).trim().toLowerCase() !== String(valor).trim().toLowerCase();
            });
            return this;
        }

        gte(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                if (valItem === undefined || valItem === null) return false;
                return valItem >= valor;
            });
            return this;
        }

        lte(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                if (valItem === undefined || valItem === null) return false;
                return valItem <= valor;
            });
            return this;
        }

        gt(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                if (valItem === undefined || valItem === null) return false;
                return valItem > valor;
            });
            return this;
        }

        lt(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                if (valItem === undefined || valItem === null) return false;
                return valItem < valor;
            });
            return this;
        }

        in(columna, valores) {
            const arr = Array.isArray(valores) ? valores : [valores];
            this.filtros.push(item => {
                const valItem = item[columna];
                return arr.some(v => String(v).trim().toLowerCase() === String(valItem).trim().toLowerCase());
            });
            return this;
        }

        is(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                if (valor === null) return valItem === null || valItem === undefined;
                return valItem === valor;
            });
            return this;
        }

        contains(columna, valor) {
            this.filtros.push(item => {
                const valItem = item[columna];
                if (Array.isArray(valItem)) {
                    if (Array.isArray(valor)) return valor.every(v => valItem.includes(v));
                    return valItem.includes(valor);
                }
                return String(valItem || '').toLowerCase().includes(String(valor || '').toLowerCase());
            });
            return this;
        }

        ilike(columna, patron) {
            const termino = String(patron).replace(/%/g, '').toLowerCase();
            this.filtros.push(item => {
                const valItem = String(item[columna] || '').toLowerCase();
                return valItem.includes(termino);
            });
            return this;
        }

        order(columna, { ascending = true } = {}) {
            this.orden = { columna, ascending };
            return this;
        }

        limit(num) {
            this.limiteMax = num;
            return this;
        }

        // Operaciones de inserción / modificación
        async insert(registros) {
            try {
                await esperarDBLista();
                const actuales = leerTabla(this.nombreTabla);
                const nuevos = Array.isArray(registros) ? registros : [registros];
                
                let maxId = actuales.reduce((acc, curr) => Math.max(acc, Number(curr.id) || 0), 0);
                
                nuevos.forEach(nuevo => {
                    if (!nuevo.id && !nuevo.id_cap && !nuevo.id_tra && !nuevo.legajo) {
                        maxId++;
                        nuevo.id = maxId;
                    }
                    actuales.push(nuevo);
                });

                await guardarTablaAsync(this.nombreTabla, actuales);
                return { data: nuevos, error: null };
            } catch (err) {
                console.error(`Error en insert sobre ${this.nombreTabla}:`, err);
                return { data: null, error: err };
            }
        }

        async upsert(registros, opciones = {}) {
            try {
                await esperarDBLista();
                const actuales = leerTabla(this.nombreTabla);
                const items = Array.isArray(registros) ? registros : [registros];
                let claveConflict = opciones.onConflict || 'id';

                if (this.nombreTabla === 'dotacion') claveConflict = 'legajo';
                else if (this.nombreTabla === 'capacitaciones') claveConflict = 'id_cap';
                else if (this.nombreTabla === 'transferencias') claveConflict = 'id_tra';
                else if (this.nombreTabla === 'cursos') claveConflict = 'codigo_curso';
                else if (this.nombreTabla === 'programas') claveConflict = 'codigo_programa';
                else if (this.nombreTabla === 'instructores') claveConflict = 'codigo_instructor';
                else if (this.nombreTabla === 'profiles') claveConflict = 'usuario';

                items.forEach(item => {
                    const valorPK = item[claveConflict];
                    const index = actuales.findIndex(x => {
                        const valX = x[claveConflict];
                        if (valX !== undefined && valorPK !== undefined && String(valX).trim().toLowerCase() === String(valorPK).trim().toLowerCase()) {
                            return true;
                        }
                        if (x.id !== undefined && item.id !== undefined && String(x.id) === String(item.id)) {
                            return true;
                        }
                        if (x.codigo !== undefined && valorPK !== undefined && String(x.codigo).trim().toLowerCase() === String(valorPK).trim().toLowerCase()) {
                            return true;
                        }
                        if (item.codigo !== undefined && valX !== undefined && String(item.codigo).trim().toLowerCase() === String(valX).trim().toLowerCase()) {
                            return true;
                        }
                        return false;
                    });

                    if (index >= 0) {
                        actuales[index] = { ...actuales[index], ...item };
                    } else {
                        actuales.push(item);
                    }
                });

                await guardarTablaAsync(this.nombreTabla, actuales);
                return { data: items, error: null };
            } catch (err) {
                console.error(`Error en upsert sobre ${this.nombreTabla}:`, err);
                return { data: null, error: err };
            }
        }

        // Ejecutor Promise / Thenable para 'select', 'delete' y 'update'
        async then(resolve, reject) {
            try {
                await esperarDBLista();
                let datos = leerTabla(this.nombreTabla);

                // Aplicar filtros
                if (this.filtros.length > 0) {
                    datos = datos.filter(item => this.filtros.every(f => f(item)));
                }

                // DELETE
                if (this.tipoOperacion === 'delete') {
                    const datosCompletos = leerTabla(this.nombreTabla);
                    const restantes = datosCompletos.filter(item => !this.filtros.every(f => f(item)));
                    await guardarTablaAsync(this.nombreTabla, restantes);
                    resolve({ data: datos, error: null });
                    return;
                }

                // UPDATE
                if (this.tipoOperacion === 'update') {
                    const datosCompletos = leerTabla(this.nombreTabla);
                    datosCompletos.forEach(item => {
                        if (this.filtros.every(f => f(item))) {
                            Object.assign(item, this.valoresUpdate);
                        }
                    });
                    await guardarTablaAsync(this.nombreTabla, datosCompletos);
                    resolve({ data: datosCompletos, error: null });
                    return;
                }

                // SELECT: Ordenamiento
                if (this.orden) {
                    const { columna, ascending } = this.orden;
                    datos.sort((a, b) => {
                        const valA = a[columna] || '';
                        const valB = b[columna] || '';
                        if (valA < valB) return ascending ? -1 : 1;
                        if (valA > valB) return ascending ? 1 : -1;
                        return 0;
                    });
                }

                // SELECT: Límite
                if (this.limiteMax && this.limiteMax > 0) {
                    datos = datos.slice(0, this.limiteMax);
                }

                // SELECT: Proyección de columnas
                let resultado = datos;
                if (this.columnas && this.columnas !== '*') {
                    const cols = this.columnas.split(',').map(c => c.trim());
                    resultado = datos.map(item => {
                        const obj = {};
                        cols.forEach(c => {
                            if (item.hasOwnProperty(c)) {
                                obj[c] = item[c];
                            } else if (c === 'nombre_curso') {
                                obj[c] = item.nombre || item.curso || '';
                            } else if (c === 'codigo_curso') {
                                obj[c] = item.codigo_curso || item.codigo || item.id || '';
                            } else {
                                obj[c] = item[c] || '';
                            }
                        });
                        return obj;
                    });
                }

                resolve({ data: resultado ? JSON.parse(JSON.stringify(resultado)) : null, error: null });
            } catch (err) {
                console.error(`Error en query sobre ${this.nombreTabla}:`, err);
                resolve({ data: null, error: err });
            }
        }
    }

    function vaciarTabla(nombreTabla) {
        nombreTabla = normalizarNombreTabla(nombreTabla);
        if (nombreTabla === 'profiles') {
            escribirTabla('profiles', [
                { id: 1, usuario: 'Admin', clave: 'CFT2026', nombre: 'Ariel Pizzutto', email: 'ariel.pizzutto@alumnos.udemm.edu.ar', rol: 'Administrador', estado: 'Activo', creado_el: new Date().toISOString().split('T')[0] }
            ]);
        } else {
            escribirTabla(nombreTabla, []);
        }
    }

    function vaciarTodasLasTablas() {
        TABLAS.forEach(t => {
            if (t === 'profiles') {
                escribirTabla('profiles', [
                    { id: 1, usuario: 'Admin', clave: 'CFT2026', nombre: 'Ariel Pizzutto', email: 'ariel.pizzutto@alumnos.udemm.edu.ar', rol: 'Administrador', estado: 'Activo', creado_el: new Date().toISOString().split('T')[0] }
                ]);
            } else {
                escribirTabla(t, []);
            }
        });
    }

    // Objeto central de base de datos local
    const dbLocal = {
        from: function (nombreTabla) {
            return new LocalQueryBuilder(nombreTabla);
        },
        ready: function () {
            return esperarDBLista();
        },
        isReady: function () {
            return window._SIGA_DB_IS_READY === true;
        },
        normalizarFecha: normalizarFecha,
        formatearFechaLegible: formatearFechaLegible,
        raw: {
            leerTabla,
            escribirTabla,
            guardarTabla: escribirTabla,
            guardarTablaAsync,
            vaciarTabla,
            vaciarTodasLasTablas,
            inicializarTablas,
            normalizarEstadosSeriesCapacitaciones,
            esperarDBLista
        }
    };

    // Auto-inicializar tablas al cargar
    inicializarTablas();
    normalizarEstadosSeriesCapacitaciones();

    // Solicitar almacenamiento persistente al navegador
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(concedido => {
            if (concedido) {
                console.log("💾 Almacenamiento local SIGA configurado como PERSISTENTE.");
            }
        }).catch(() => {});
    }

    // Exportar al entorno global
    window.dbLocal = dbLocal;
    window.supabaseClient = dbLocal;
    window.supabase = dbLocal;
    window.normalizarFecha = normalizarFecha;
    window.formatearFecha = formatearFechaLegible;
    window.normalizarEstadosSeriesCapacitaciones = normalizarEstadosSeriesCapacitaciones;
})();

