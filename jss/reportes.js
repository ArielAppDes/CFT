// ===================================================
// SIGA_APP - MÓDULO DE REPORTES Y ANALÍTICAS
// MOTOR DE FILTRADO Y SEGMENTACIÓN MULTIDIMENSIONAL (POWER BI STYLE)
// ===================================================

let instanceChartMeses = null;
let instanceChartHoras = null;
let instanceChartPersonas = null;
let instanceChartModalidad = null;

// Almacén en memoria de datos sin procesar
let rawCapacitaciones = [];
let rawAsistentes = [];
let rawDotacion = [];
let rawCursos = [];
let rawProgramas = [];
let listaDotacionUnificada = [];

// Mapas auxiliares para búsquedas ultrarrápidas
const mapDotacionPorLegajo = new Map();
const mapModalidadPorCurso = new Map();
const mapAsistentesPorCapacitacion = new Map();

// Estado actual de filtros aplicados
let filtrosActuales = {
    direccion: '',
    gerencia: '',
    coordinacion: '',
    jefatura: '',
    categoria: '',
    puesto: '',
    legajo: '',
    programa: '',
    curso: '',
    centro: '',
    lugar: '',
    fechaDesde: '',
    fechaHasta: ''
};

// Sección activa de visualización
let seccionActivaActual = 'generales';

// ===================================================
// 1. INICIALIZACIÓN ROBUSTA (ONLINE & OFFLINE)
// ===================================================
let _metricasCargando = false;

async function iniciarCargaReportes() {
    if (_metricasCargando) return;
    _metricasCargando = true;
    try {
        if (window.dbLocal && typeof window.dbLocal.ready === 'function') {
            await window.dbLocal.ready();
        }
        await cargarMetricasSIGA();
    } finally {
        _metricasCargando = false;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarCargaReportes);
} else {
    iniciarCargaReportes();
}

window.addEventListener('siga_db_ready', () => {
    iniciarCargaReportes();
});

window.addEventListener('siga_data_updated', () => {
    iniciarCargaReportes();
});

window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('SIGA_DB_')) {
        iniciarCargaReportes();
    }
});

// ===================================================
// 2. CARGA DE DATOS DESDE BASE DE DATOS LOCAL Y MEMORIA
// ===================================================

// Helper ultra-robusto para cargar cualquier tabla del sistema SIGA
// PRIORIDAD ABSOLUTA: dbLocal en memoria e IndexedDB, donde residen los datos importados por el usuario.
async function cargarColeccionRobusta(nombreTabla) {
    const tablasAlternativas = [nombreTabla];
    if (nombreTabla === 'asistentes') tablasAlternativas.push('asistencias');
    if (nombreTabla === 'capacitaciones') tablasAlternativas.push('actividades');

    for (const tabla of tablasAlternativas) {
        // 1. dbLocal en memoria (CACHE_TABLAS) - Fuente viva y activa de datos
        if (window.dbLocal && window.dbLocal.raw && typeof window.dbLocal.raw.leerTabla === 'function') {
            try {
                const localData = window.dbLocal.raw.leerTabla(tabla);
                if (Array.isArray(localData) && localData.length > 0) {
                    console.log(`[Reportes] ${tabla} cargada desde dbLocal en memoria (${localData.length} registros).`);
                    return localData;
                }
            } catch (e) {}
        }

        // 2. Fallback a localStorage
        try {
            const ls = localStorage.getItem('SIGA_DB_' + tabla);
            if (ls) {
                const parsed = JSON.parse(ls);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log(`[Reportes] ${tabla} cargada desde localStorage (${parsed.length} registros).`);
                    return parsed;
                }
            }
        } catch (e) {}

        // 3. Fallback directo a IndexedDB físico (en caso de que la memoria aún no haya sincronizado)
        for (const dbName of ['SIGA_APP_DB', 'SIGA_DATABASE']) {
            try {
                const idbData = await new Promise((resolve) => {
                    if (typeof indexedDB === 'undefined') return resolve(null);
                    const req = indexedDB.open(dbName);
                    req.onsuccess = (ev) => {
                        try {
                            const db = ev.target.result;
                            if (!db.objectStoreNames.contains('tablas')) return resolve(null);
                            const tx = db.transaction('tablas', 'readonly');
                            const store = tx.objectStore('tablas');
                            const getReq = store.get(tabla);
                            getReq.onsuccess = () => {
                                const item = getReq.result;
                                if (item && Array.isArray(item.datos) && item.datos.length > 0) {
                                    resolve(item.datos);
                                } else {
                                    resolve(null);
                                }
                            };
                            getReq.onerror = () => resolve(null);
                        } catch (e) {
                            resolve(null);
                        }
                    };
                    req.onerror = () => resolve(null);
                });
                if (Array.isArray(idbData) && idbData.length > 0) {
                    console.log(`[Reportes] ${tabla} cargada desde ${dbName} directo (${idbData.length} registros).`);
                    return idbData;
                }
            } catch (e) {}
        }
    }

    // 4. Fallback ÚNICAMENTE si la base local está completamente virgen o vacía
    const rutasJson = [
        `data/${nombreTabla}.json?v=${Date.now()}`,
        `/data/${nombreTabla}.json`,
        `./data/${nombreTabla}.json`
    ];
    for (const ruta of rutasJson) {
        try {
            const resLocal = await fetch(ruta);
            if (resLocal && resLocal.ok) {
                const dataLocal = await resLocal.json();
                if (Array.isArray(dataLocal) && dataLocal.length > 0) {
                    console.log(`[Reportes] ${nombreTabla} cargada desde JSON inicial ${ruta} (${dataLocal.length} registros).`);
                    return dataLocal;
                }
            }
        } catch (e) {}
    }

    // 5. Supabase Cloud SDK o REST como último recurso
    if (window.supabaseCloudClient) {
        try {
            const { data, error } = await window.supabaseCloudClient.from(nombreTabla).select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                console.log(`[Reportes] ${nombreTabla} cargada desde Supabase Cloud SDK (${data.length} registros).`);
                return data;
            }
        } catch (e) {}
    }

    console.warn(`[Reportes] No se encontraron registros para la tabla "${nombreTabla}".`);
    return [];
}

async function cargarMetricasSIGA() {
    try {
        const [asis, caps, curs, progs, dota] = await Promise.all([
            cargarColeccionRobusta('asistentes'),
            cargarColeccionRobusta('capacitaciones'),
            cargarColeccionRobusta('cursos'),
            cargarColeccionRobusta('programas'),
            cargarColeccionRobusta('dotacion')
        ]);

        rawAsistentes = Array.isArray(asis) ? asis : [];
        rawCapacitaciones = Array.isArray(caps) ? caps : [];
        rawCursos = Array.isArray(curs) ? curs : [];
        rawProgramas = Array.isArray(progs) ? progs : [];
        rawDotacion = Array.isArray(dota) ? dota : [];

        console.log(`[CFT Reportes] Datos cargados exitosamente: ${rawCapacitaciones.length} capacitaciones, ${rawAsistentes.length} asistentes, ${rawCursos.length} cursos, ${rawProgramas.length} programas, ${rawDotacion.length} dotación.`);

        // Indexar mapas auxiliares
        construirIndicesAuxiliares();

        // Normalizar capacitaciones
        normalizarCapacitaciones();

        // Poblar las opciones de los selectores de Power BI
        poblarOpcionesFiltrosUI();

        // Aplicar filtros iniciales y renderizar métricas
        aplicarFiltrosReportes();

    } catch (error) {
        console.error("Error general al inicializar reportes:", error);
    }
}

// ===================================================
// 3. CONSTRUCCIÓN DE ÍNDICES Y NORMALIZACIÓN
// ===================================================
function construirIndicesAuxiliares() {
    mapDotacionPorLegajo.clear();
    mapModalidadPorCurso.clear();
    mapAsistentesPorCapacitacion.clear();

    // 1. Indexar Dotación por Legajo (soporta números, ceros a la izquierda y strings)
    rawDotacion.forEach(emp => {
        const leg = extraerPropiedadDotacion(emp, 'legajo');
        if (leg) {
            const legTrim = String(leg).trim().toLowerCase();
            mapDotacionPorLegajo.set(legTrim, emp);

            const legNum = parseInt(legTrim.replace(/\D/g, ''), 10);
            if (!isNaN(legNum)) {
                mapDotacionPorLegajo.set(String(legNum), emp);
                mapDotacionPorLegajo.set(String(legNum).padStart(5, '0'), emp);
                mapDotacionPorLegajo.set(String(legNum).padStart(6, '0'), emp);
            }
        }
    });

    // 2. Indexar Cursos por Nombre -> Modalidad
    rawCursos.forEach(cur => {
        const nombre = cur.nombre || cur.nombre_curso;
        if (nombre) {
            const clean = String(nombre).trim().toLowerCase();
            mapModalidadPorCurso.set(clean, cur.modalidad || cur.tipo || '');
        }
    });

    // 3. Indexar Asistentes por id_cap
    rawAsistentes.forEach(a => {
        const idCap = normalizarIdCapacitacion(a.id_cap || a.id_capacitacion || a.ID_CAP);
        if (idCap) {
            if (!mapAsistentesPorCapacitacion.has(idCap)) {
                mapAsistentesPorCapacitacion.set(idCap, []);
            }
            mapAsistentesPorCapacitacion.get(idCap).push(a);
        }
    });

    // 4. Construir nómina maestra unificada para cascada jerárquica
    listaDotacionUnificada = [];
    const legajosVistos = new Set();

    rawDotacion.forEach(emp => {
        const leg = extraerPropiedadDotacion(emp, 'legajo');
        const item = {
            direccion: String(extraerPropiedadDotacion(emp, 'direccion') || '').trim(),
            gerencia: String(extraerPropiedadDotacion(emp, 'gerencia') || '').trim(),
            coordinacion: String(extraerPropiedadDotacion(emp, 'coordinacion') || '').trim(),
            jefatura: String(extraerPropiedadDotacion(emp, 'jefatura') || '').trim(),
            categoria: String(extraerPropiedadDotacion(emp, 'categoria') || '').trim(),
            puesto: String(extraerPropiedadDotacion(emp, 'puesto') || '').trim(),
            legajo: String(leg || '').trim(),
            nombre: String(extraerPropiedadDotacion(emp, 'nombre') || '').trim()
        };
        listaDotacionUnificada.push(item);
        if (item.legajo) legajosVistos.add(item.legajo.toLowerCase());
    });

    rawAsistentes.forEach(a => {
        const leg = String(a.legajo || a.dni || a.empleado_id || '').trim();
        if (leg && !legajosVistos.has(leg.toLowerCase())) {
            const item = {
                direccion: String(extraerPropiedadAsistente(a, 'direccion') || '').trim(),
                gerencia: String(extraerPropiedadAsistente(a, 'gerencia') || '').trim(),
                coordinacion: String(extraerPropiedadAsistente(a, 'coordinacion') || '').trim(),
                jefatura: String(extraerPropiedadAsistente(a, 'jefatura') || '').trim(),
                categoria: String(extraerPropiedadAsistente(a, 'categoria') || '').trim(),
                puesto: String(extraerPropiedadAsistente(a, 'puesto') || '').trim(),
                legajo: leg,
                nombre: String(a.nombre || a.apellido_nombre || '').trim()
            };
            listaDotacionUnificada.push(item);
            legajosVistos.add(leg.toLowerCase());
        }
    });
}

function normalizarCapacitaciones() {
    rawCapacitaciones = rawCapacitaciones.map(c => {
        const nombreCurso = extraerPropiedadCapacitacion(c, 'curso');
        const modalidadCatalogo = mapModalidadPorCurso.get(nombreCurso.toLowerCase()) || '';
        const modDetectada = c.modalidad || modalidadCatalogo || obtenerModalidad(c) || 'Presencial';

        return {
            ...c,
            _id_normalizado: normalizarIdCapacitacion(c.id_cap || c.id || c.codigo || c.id_capacitacion),
            _curso_normalizado: nombreCurso,
            _programa_normalizado: extraerPropiedadCapacitacion(c, 'programa'),
            _centro_normalizado: extraerPropiedadCapacitacion(c, 'centro'),
            _lugar_normalizado: extraerPropiedadCapacitacion(c, 'lugar'),
            _fecha_iso: normalizarAFechaISO(c.fecha || c.fecha_curso || c.created_at),
            modalidad: modDetectada
        };
    });
}

function normalizarIdCapacitacion(id) {
    if (id === null || id === undefined) return '';
    return String(id).trim();
}

function normalizarAFechaISO(fechaStr) {
    if (!fechaStr) return '';
    const str = String(fechaStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.substring(0, 10);
    }
    const partes = str.split(/[\/\-]/);
    if (partes.length === 3) {
        if (partes[2].length === 4) {
            return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        } else if (partes[0].length === 4) {
            return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
        }
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().substring(0, 10);
    }
    return '';
}

// Extractor unificado para Dotación
function extraerPropiedadDotacion(emp, propiedad) {
    if (!emp) return '';
    const prop = propiedad.toLowerCase();

    if (prop === 'direccion') {
        return emp.direccion || emp.col_13 || emp.col13 || emp.departamento_nivel_1 ||
            (emp.datos_completos && (emp.datos_completos.col_13 || emp.datos_completos.direccion)) || '';
    }
    if (prop === 'gerencia') {
        return emp.gerencia || emp.col_14 || emp.col14 || emp.departamento_nivel_2 ||
            (emp.datos_completos && (emp.datos_completos.col_14 || emp.datos_completos.gerencia)) || '';
    }
    if (prop === 'coordinacion') {
        return emp.coordinacion || emp.col_15 || emp.col15 || emp.departamento_nivel_3 ||
            (emp.datos_completos && (emp.datos_completos.col_15 || emp.datos_completos.coordinacion)) || '';
    }
    if (prop === 'jefatura') {
        return emp.jefatura || emp.col_16 || emp.col16 || emp.departamento_nivel_4 ||
            (emp.datos_completos && (emp.datos_completos.col_16 || emp.datos_completos.jefatura)) || '';
    }
    if (prop === 'categoria') {
        return emp.categoria || emp.col_8 || emp.col8 || emp.convenio ||
            (emp.datos_completos && (emp.datos_completos.col_8 || emp.datos_completos.categoria)) || '';
    }
    if (prop === 'puesto') {
        return emp.puesto || emp.col_4 || emp.col4 || emp.cargo ||
            (emp.datos_completos && (emp.datos_completos.col_4 || emp.datos_completos.puesto)) || '';
    }
    if (prop === 'legajo') {
        return emp.legajo || emp.Legajo || emp.LEGAJO || emp.id || emp.dni || '';
    }
    if (prop === 'nombre') {
        return emp.nombre || emp.Nombre || emp.apellido_nombre ||
            (emp.col_2 ? `${emp.col_2} ${emp.col_3 || ''}` : '') || '';
    }
    return emp[propiedad] || '';
}

// Extractor unificado para Asistentes (con cruce a dotación por legajo)
function extraerPropiedadAsistente(asis, propiedad) {
    if (!asis) return '';
    const prop = propiedad.toLowerCase();

    // 1. Propiedad directa en el registro de asistente
    if (asis[prop] !== undefined && asis[prop] !== null && String(asis[prop]).trim() !== '') {
        return String(asis[prop]).trim();
    }
    const propUpper = propiedad.toUpperCase();
    if (asis[propUpper] !== undefined && asis[propUpper] !== null && String(asis[propUpper]).trim() !== '') {
        return String(asis[propUpper]).trim();
    }

    // 2. Cruce con maestro de dotación por legajo
    const leg = String(asis.legajo || asis.Legajo || asis.LEGAJO || asis.dni || asis.empleado_id || '').trim();
    if (leg) {
        const emp = mapDotacionPorLegajo.get(leg.toLowerCase()) ||
                    mapDotacionPorLegajo.get(String(parseInt(leg.replace(/\D/g, ''), 10))) ||
                    mapDotacionPorLegajo.get(leg.padStart(5, '0'));
        if (emp) {
            return extraerPropiedadDotacion(emp, propiedad);
        }
    }

    return '';
}

// Extractor unificado para Capacitaciones
function extraerPropiedadCapacitacion(c, propiedad) {
    if (!c) return '';
    const prop = propiedad.toLowerCase();

    if (prop === 'programa') {
        return c.programa || c.Programa || c.nombre_programa || '';
    }
    if (prop === 'curso') {
        return c.nombre_curso || c.nombre || c.curso || c.NombreCurso || '';
    }
    if (prop === 'centro') {
        return c.centro || c.Centro || c.centro_capacitacion || '';
    }
    if (prop === 'lugar') {
        return c.lugar || c.Lugar || c.lugar_capacitacion || c.aula || c.ubicacion || '';
    }
    if (prop === 'fecha') {
        return c.fecha || c.fecha_curso || c.created_at || '';
    }
    return c[propiedad] || '';
}

// ===================================================
// 4. POBLADO Y CASCADA JERÁRQUICA DE SELECTORES (POWER BI STYLE)
// ===================================================
function poblarOpcionesFiltrosUI() {
    // 1. Llenar Dirección raíz (Nivel 1 de Dotación)
    const setDirecciones = new Set();
    listaDotacionUnificada.forEach(emp => {
        if (emp.direccion) setDirecciones.add(emp.direccion);
    });
    llenarSelectCascada('filtroDireccion', Array.from(setDirecciones), '(Todas las Direcciones)', getSelectVal('filtroDireccion'));

    // 2. Llenar Programa raíz (Nivel 1 de Capacitaciones)
    const setProgramas = new Set();
    rawCapacitaciones.forEach(c => {
        if (c._programa_normalizado) setProgramas.add(c._programa_normalizado);
    });
    rawProgramas.forEach(p => {
        const nom = p.nombre || p.nombre_programa;
        if (nom) setProgramas.add(String(nom).trim());
    });
    llenarSelectCascada('filtroPrograma', Array.from(setProgramas), '(Todos los Programas)', getSelectVal('filtroPrograma'));

    // 3. Inicializar todos los niveles dependientes en cascada completa
    actualizarSelectoresEnCascada(null);
}

function actualizarSelectoresEnCascada(filtroModificado) {
    const dirVal = getSelectVal('filtroDireccion');
    let gerVal = getSelectVal('filtroGerencia');
    let cooVal = getSelectVal('filtroCoordinacion');
    let jefVal = getSelectVal('filtroJefatura');
    let catVal = getSelectVal('filtroCategoria');
    let pueVal = getSelectVal('filtroPuesto');

    let progVal = getSelectVal('filtroPrograma');
    let curVal = getSelectVal('filtroCurso');
    let cenVal = getSelectVal('filtroCentro');
    let lugVal = getSelectVal('filtroLugar');

    // ----------------------------------------------------
    // CASCADA JERÁRQUICA A NIVEL DOTACIÓN:
    // Dirección -> Gerencia -> Coordinación -> Jefatura -> Categoría -> Puesto -> Legajo
    // ----------------------------------------------------

    // Nivel 2: Gerencia (depende de Dirección)
    if (!filtroModificado || filtroModificado === 'direccion') {
        const gerenciasDisponibles = new Set();
        listaDotacionUnificada.forEach(emp => {
            if (!dirVal || coincideTextoFiltro(emp.direccion, dirVal)) {
                if (emp.gerencia) gerenciasDisponibles.add(emp.gerencia);
            }
        });
        gerVal = llenarSelectCascada('filtroGerencia', Array.from(gerenciasDisponibles), '(Todas las Gerencias)', gerVal);
    }

    // Nivel 3: Coordinación (depende de Dirección + Gerencia)
    if (!filtroModificado || filtroModificado === 'direccion' || filtroModificado === 'gerencia') {
        const coordinacionesDisponibles = new Set();
        listaDotacionUnificada.forEach(emp => {
            const matchDir = !dirVal || coincideTextoFiltro(emp.direccion, dirVal);
            const matchGer = !gerVal || coincideTextoFiltro(emp.gerencia, gerVal);
            if (matchDir && matchGer && emp.coordinacion) {
                coordinacionesDisponibles.add(emp.coordinacion);
            }
        });
        cooVal = llenarSelectCascada('filtroCoordinacion', Array.from(coordinacionesDisponibles), '(Todas las Coordinaciones)', cooVal);
    }

    // Nivel 4: Jefatura (depende de Dirección + Gerencia + Coordinación)
    if (!filtroModificado || filtroModificado === 'direccion' || filtroModificado === 'gerencia' || filtroModificado === 'coordinacion') {
        const jefaturasDisponibles = new Set();
        listaDotacionUnificada.forEach(emp => {
            const matchDir = !dirVal || coincideTextoFiltro(emp.direccion, dirVal);
            const matchGer = !gerVal || coincideTextoFiltro(emp.gerencia, gerVal);
            const matchCoo = !cooVal || coincideTextoFiltro(emp.coordinacion, cooVal);
            if (matchDir && matchGer && matchCoo && emp.jefatura) {
                jefaturasDisponibles.add(emp.jefatura);
            }
        });
        jefVal = llenarSelectCascada('filtroJefatura', Array.from(jefaturasDisponibles), '(Todas las Jefaturas)', jefVal);
    }

    // Nivel 5: Categoría (depende de Dirección + Gerencia + Coordinación + Jefatura)
    if (!filtroModificado || filtroModificado === 'direccion' || filtroModificado === 'gerencia' || filtroModificado === 'coordinacion' || filtroModificado === 'jefatura') {
        const categoriasDisponibles = new Set();
        listaDotacionUnificada.forEach(emp => {
            const matchDir = !dirVal || coincideTextoFiltro(emp.direccion, dirVal);
            const matchGer = !gerVal || coincideTextoFiltro(emp.gerencia, gerVal);
            const matchCoo = !cooVal || coincideTextoFiltro(emp.coordinacion, cooVal);
            const matchJef = !jefVal || coincideTextoFiltro(emp.jefatura, jefVal);
            if (matchDir && matchGer && matchCoo && matchJef && emp.categoria) {
                categoriasDisponibles.add(emp.categoria);
            }
        });
        catVal = llenarSelectCascada('filtroCategoria', Array.from(categoriasDisponibles), '(Todas las Categorías)', catVal);
    }

    // Nivel 6: Puesto (depende de Dirección + Gerencia + Coordinación + Jefatura + Categoría)
    if (!filtroModificado || filtroModificado === 'direccion' || filtroModificado === 'gerencia' || filtroModificado === 'coordinacion' || filtroModificado === 'jefatura' || filtroModificado === 'categoria') {
        const puestosDisponibles = new Set();
        listaDotacionUnificada.forEach(emp => {
            const matchDir = !dirVal || coincideTextoFiltro(emp.direccion, dirVal);
            const matchGer = !gerVal || coincideTextoFiltro(emp.gerencia, gerVal);
            const matchCoo = !cooVal || coincideTextoFiltro(emp.coordinacion, cooVal);
            const matchJef = !jefVal || coincideTextoFiltro(emp.jefatura, jefVal);
            const matchCat = !catVal || coincideTextoFiltro(emp.categoria, catVal);
            if (matchDir && matchGer && matchCoo && matchJef && matchCat && emp.puesto) {
                puestosDisponibles.add(emp.puesto);
            }
        });
        pueVal = llenarSelectCascada('filtroPuesto', Array.from(puestosDisponibles), '(Todos los Puestos)', pueVal);
    }

    // Nivel 7: Legajo (Datalist filtrado por la jerarquía activa)
    const esFiltroDotacion = !filtroModificado || ['direccion', 'gerencia', 'coordinacion', 'jefatura', 'categoria', 'puesto'].includes(filtroModificado);
    if (esFiltroDotacion) {
        actualizarDatalistLegajos(dirVal, gerVal, cooVal, jefVal, catVal, pueVal);
    }

    // ----------------------------------------------------
    // CASCADA JERÁRQUICA A NIVEL CAPACITACIONES:
    // Programa -> Curso -> Centro -> Lugares
    // ----------------------------------------------------

    // Nivel 2: Curso (depende de Programa)
    if (!filtroModificado || filtroModificado === 'programa') {
        const cursosDisponibles = new Set();
        rawCapacitaciones.forEach(c => {
            if (!progVal || coincideTextoFiltro(c._programa_normalizado, progVal)) {
                if (c._curso_normalizado) cursosDisponibles.add(c._curso_normalizado);
            }
        });
        rawCursos.forEach(cur => {
            const nomCur = cur.nombre || cur.nombre_curso;
            const progCur = cur.programa || cur.nombre_programa;
            if (!progVal || (progCur && coincideTextoFiltro(progCur, progVal))) {
                if (nomCur) cursosDisponibles.add(String(nomCur).trim());
            }
        });
        curVal = llenarSelectCascada('filtroCurso', Array.from(cursosDisponibles), '(Todos los Cursos)', curVal);
    }

    // Nivel 3: Centro (depende de Programa + Curso)
    if (!filtroModificado || filtroModificado === 'programa' || filtroModificado === 'curso') {
        const centrosDisponibles = new Set();
        rawCapacitaciones.forEach(c => {
            const matchProg = !progVal || coincideTextoFiltro(c._programa_normalizado, progVal);
            const matchCur = !curVal || coincideTextoFiltro(c._curso_normalizado, curVal);
            if (matchProg && matchCur && c._centro_normalizado) {
                centrosDisponibles.add(c._centro_normalizado);
            }
        });
        cenVal = llenarSelectCascada('filtroCentro', Array.from(centrosDisponibles), '(Todos los Centros)', cenVal);
    }

    // Nivel 4: Lugares (depende de Programa + Curso + Centro)
    if (!filtroModificado || filtroModificado === 'programa' || filtroModificado === 'curso' || filtroModificado === 'centro') {
        const lugaresDisponibles = new Set();
        rawCapacitaciones.forEach(c => {
            const matchProg = !progVal || coincideTextoFiltro(c._programa_normalizado, progVal);
            const matchCur = !curVal || coincideTextoFiltro(c._curso_normalizado, curVal);
            const matchCen = !cenVal || coincideTextoFiltro(c._centro_normalizado, cenVal);
            if (matchProg && matchCur && matchCen && c._lugar_normalizado) {
                lugaresDisponibles.add(c._lugar_normalizado);
            }
        });
        lugVal = llenarSelectCascada('filtroLugar', Array.from(lugaresDisponibles), '(Todos los Lugares)', lugVal);
    }
}

function llenarSelectCascada(idSelect, valoresArray, textoPorDefecto, valorSeleccionadoPreviamente) {
    const select = document.getElementById(idSelect);
    if (!select) return '';

    const valorPrevio = (valorSeleccionadoPreviamente !== undefined && valorSeleccionadoPreviamente !== null)
        ? String(valorSeleccionadoPreviamente).trim()
        : String(select.value || '').trim();

    select.innerHTML = '';

    const optDefecto = document.createElement('option');
    optDefecto.value = '';
    optDefecto.textContent = textoPorDefecto;
    select.appendChild(optDefecto);

    const valoresLimpios = valoresArray
        .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
        .map(v => String(v).trim());

    // Deduplicar respetando mayúsculas/minúsculas
    const mapaUnicos = new Map();
    valoresLimpios.forEach(v => {
        const key = v.toLowerCase();
        if (!mapaUnicos.has(key)) {
            mapaUnicos.set(key, v);
        }
    });

    const listaOrdenada = Array.from(mapaUnicos.values())
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    let seleccionadoAunValido = false;
    listaOrdenada.forEach(valor => {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = valor;
        if (valorPrevio && valor.toLowerCase() === valorPrevio.toLowerCase()) {
            opt.selected = true;
            seleccionadoAunValido = true;
        }
        select.appendChild(opt);
    });

    // Si el valor seleccionado previamente ya no pertenece a la jerarquía activa, se restablece a vacío
    if (!seleccionadoAunValido && valorPrevio !== '') {
        select.value = '';
        return '';
    }

    return select.value;
}

function actualizarDatalistLegajos(dirVal, gerVal, cooVal, jefVal, catVal, pueVal) {
    const dlLegajos = document.getElementById('dlLegajos');
    if (!dlLegajos) return;
    dlLegajos.innerHTML = '';

    const mapFiltrado = new Map();
    listaDotacionUnificada.forEach(emp => {
        const matchDir = !dirVal || coincideTextoFiltro(emp.direccion, dirVal);
        const matchGer = !gerVal || coincideTextoFiltro(emp.gerencia, gerVal);
        const matchCoo = !cooVal || coincideTextoFiltro(emp.coordinacion, cooVal);
        const matchJef = !jefVal || coincideTextoFiltro(emp.jefatura, jefVal);
        const matchCat = !catVal || coincideTextoFiltro(emp.categoria, catVal);
        const matchPue = !pueVal || coincideTextoFiltro(emp.puesto, pueVal);

        if (matchDir && matchGer && matchCoo && matchJef && matchCat && matchPue && emp.legajo) {
            const desc = emp.nombre ? `${emp.legajo} - ${emp.nombre}` : emp.legajo;
            mapFiltrado.set(emp.legajo, desc);
        }
    });

    Array.from(mapFiltrado.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([legVal, desc]) => {
            const opt = document.createElement('option');
            opt.value = legVal;
            opt.label = desc;
            dlLegajos.appendChild(opt);
        });
}

// ===================================================
// 5. MOTOR DE FILTRADO Y APLICACIÓN (POWER BI STYLE)
// ===================================================
function aplicarFiltrosDesdeUI(filtroDisparador) {
    // Si fue accionado por un cambio en un selector, actualizar en cascada sus hijos
    if (filtroDisparador) {
        actualizarSelectoresEnCascada(filtroDisparador);
    }

    filtrosActuales.direccion = getSelectVal('filtroDireccion');
    filtrosActuales.gerencia = getSelectVal('filtroGerencia');
    filtrosActuales.coordinacion = getSelectVal('filtroCoordinacion');
    filtrosActuales.jefatura = getSelectVal('filtroJefatura');
    filtrosActuales.categoria = getSelectVal('filtroCategoria');
    filtrosActuales.puesto = getSelectVal('filtroPuesto');
    filtrosActuales.legajo = getSelectVal('filtroLegajo');

    filtrosActuales.programa = getSelectVal('filtroPrograma');
    filtrosActuales.curso = getSelectVal('filtroCurso');
    filtrosActuales.centro = getSelectVal('filtroCentro');
    filtrosActuales.lugar = getSelectVal('filtroLugar');
    filtrosActuales.fechaDesde = getSelectVal('filtroFechaDesde');
    filtrosActuales.fechaHasta = getSelectVal('filtroFechaHasta');

    aplicarFiltrosReportes();
}

function getSelectVal(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
}

function coincideTextoFiltro(valorItem, valorFiltro) {
    if (!valorFiltro || valorFiltro === '') return true;
    if (valorItem === null || valorItem === undefined) return false;
    return String(valorItem).trim().toLowerCase() === String(valorFiltro).trim().toLowerCase();
}

function coincideLegajoFiltro(legajoItem, valorFiltro) {
    if (!valorFiltro || valorFiltro === '') return true;
    if (!legajoItem) return false;
    const lItem = String(legajoItem).trim().toLowerCase();
    const lFiltro = String(valorFiltro).trim().toLowerCase();

    if (lItem === lFiltro) return true;
    if (lItem.includes(lFiltro)) return true;

    const numItem = parseInt(lItem.replace(/\D/g, ''), 10);
    const numFiltro = parseInt(lFiltro.replace(/\D/g, ''), 10);
    if (!isNaN(numItem) && !isNaN(numFiltro) && numItem === numFiltro) return true;

    return false;
}

function aplicarFiltrosReportes() {
    // Determinar si hay filtros activos por dotación
    const tieneFiltrosDotacion = Boolean(
        filtrosActuales.direccion ||
        filtrosActuales.gerencia ||
        filtrosActuales.coordinacion ||
        filtrosActuales.jefatura ||
        filtrosActuales.categoria ||
        filtrosActuales.puesto ||
        filtrosActuales.legajo
    );

    // Determinar si hay filtros activos por capacitaciones
    const tieneFiltrosCapacitaciones = Boolean(
        filtrosActuales.programa ||
        filtrosActuales.curso ||
        filtrosActuales.centro ||
        filtrosActuales.lugar ||
        filtrosActuales.fechaDesde ||
        filtrosActuales.fechaHasta
    );

    // 1. Filtrar Asistentes según Dotación
    const asistentesFiltradosDotacion = rawAsistentes.filter(a => {
        if (filtrosActuales.direccion && !coincideTextoFiltro(extraerPropiedadAsistente(a, 'direccion'), filtrosActuales.direccion)) return false;
        if (filtrosActuales.gerencia && !coincideTextoFiltro(extraerPropiedadAsistente(a, 'gerencia'), filtrosActuales.gerencia)) return false;
        if (filtrosActuales.coordinacion && !coincideTextoFiltro(extraerPropiedadAsistente(a, 'coordinacion'), filtrosActuales.coordinacion)) return false;
        if (filtrosActuales.jefatura && !coincideTextoFiltro(extraerPropiedadAsistente(a, 'jefatura'), filtrosActuales.jefatura)) return false;
        if (filtrosActuales.categoria && !coincideTextoFiltro(extraerPropiedadAsistente(a, 'categoria'), filtrosActuales.categoria)) return false;
        if (filtrosActuales.puesto && !coincideTextoFiltro(extraerPropiedadAsistente(a, 'puesto'), filtrosActuales.puesto)) return false;
        if (filtrosActuales.legajo && !coincideLegajoFiltro(a.legajo || a.dni || a.empleado_id, filtrosActuales.legajo)) return false;
        return true;
    });

    // Indexar IDs de capacitaciones que tienen asistentes compatibles con la dotación seleccionada
    const setIdsCapConAsistentesValidos = new Set();
    asistentesFiltradosDotacion.forEach(a => {
        const idCap = normalizarIdCapacitacion(a.id_cap || a.id_capacitacion || a.ID_CAP);
        if (idCap) setIdsCapConAsistentesValidos.add(idCap);
    });

    // 2. Filtrar Capacitaciones según filtros de capacitación Y dotación
    const capacitacionesFiltradas = rawCapacitaciones.filter(c => {
        if (filtrosActuales.programa && !coincideTextoFiltro(c._programa_normalizado, filtrosActuales.programa)) return false;
        if (filtrosActuales.curso && !coincideTextoFiltro(c._curso_normalizado, filtrosActuales.curso)) return false;
        if (filtrosActuales.centro && !coincideTextoFiltro(c._centro_normalizado, filtrosActuales.centro)) return false;
        if (filtrosActuales.lugar && !coincideTextoFiltro(c._lugar_normalizado, filtrosActuales.lugar)) return false;

        // Rango de fechas
        if (filtrosActuales.fechaDesde && c._fecha_iso && c._fecha_iso < filtrosActuales.fechaDesde) return false;
        if (filtrosActuales.fechaHasta && c._fecha_iso && c._fecha_iso > filtrosActuales.fechaHasta) return false;

        // Si hay filtros de dotación activos, la capacitación debe contener asistentes que coincidan con la dotación
        if (tieneFiltrosDotacion) {
            const idCap = c._id_normalizado;
            if (!setIdsCapConAsistentesValidos.has(idCap)) return false;
        }

        return true;
    });

    // Indexar IDs de capacitaciones finales válidas
    const setIdsCapValidas = new Set(capacitacionesFiltradas.map(c => c._id_normalizado));

    // 3. Filtrar Asistentes finales (deben pertenecer a capacitaciones válidas)
    const asistentesFiltrados = asistentesFiltradosDotacion.filter(a => {
        const idCap = normalizarIdCapacitacion(a.id_cap || a.id_capacitacion || a.ID_CAP);
        if (!idCap) return !tieneFiltrosCapacitaciones;
        return setIdsCapValidas.has(idCap);
    });

    // 4. Ejecutar módulos de cálculo con los subconjuntos filtrados
    calcularModuloGenerales(capacitacionesFiltradas, asistentesFiltrados);
    calcularModuloHoraria(capacitacionesFiltradas, asistentesFiltrados);
    calcularModuloOrigen(capacitacionesFiltradas);
    calcularModuloGraficos(capacitacionesFiltradas, asistentesFiltrados);

    // 5. Actualizar barra de chips activos, badges y tabla detallada
    actualizarChipsYBadgesPowerBI(capacitacionesFiltradas, asistentesFiltrados);
    actualizarTablaDetalleFiltrada(capacitacionesFiltradas);
}

// ===================================================
// 6. CHIPS, BADGES Y RESTABLECIMIENTO DE FILTROS
// ===================================================
function actualizarChipsYBadgesPowerBI(capacitaciones, asistentes) {
    const contenedorChips = document.getElementById('pbiChipsContenedor');
    const badgeFiltros = document.getElementById('badgeFiltrosActivos');
    const contadorCap = document.getElementById('pbiContadorCapacitaciones');
    const contadorAsis = document.getElementById('pbiContadorAsistencias');
    const contadorPers = document.getElementById('pbiContadorPersonas');

    // Personas únicas
    const legajosUnicos = new Set(
        asistentes
            .map(a => a.legajo || a.dni || a.empleado_id)
            .filter(val => val !== null && val !== undefined && val !== '')
    );

    if (contadorCap) contadorCap.textContent = capacitaciones.length;
    if (contadorAsis) contadorAsis.textContent = asistentes.length;
    if (contadorPers) contadorPers.textContent = legajosUnicos.size;

    // Generar lista de filtros activos con etiquetas descriptivas
    const etiquetas = [
        { clave: 'direccion', label: 'Dirección', valor: filtrosActuales.direccion },
        { clave: 'gerencia', label: 'Gerencia', valor: filtrosActuales.gerencia },
        { clave: 'coordinacion', label: 'Coordinación', valor: filtrosActuales.coordinacion },
        { clave: 'jefatura', label: 'Jefatura', valor: filtrosActuales.jefatura },
        { clave: 'categoria', label: 'Categoría', valor: filtrosActuales.categoria },
        { clave: 'puesto', label: 'Puesto', valor: filtrosActuales.puesto },
        { clave: 'legajo', label: 'Legajo', valor: filtrosActuales.legajo },
        { clave: 'programa', label: 'Programa', valor: filtrosActuales.programa },
        { clave: 'curso', label: 'Curso', valor: filtrosActuales.curso },
        { clave: 'centro', label: 'Centro', valor: filtrosActuales.centro },
        { clave: 'lugar', label: 'Lugar', valor: filtrosActuales.lugar },
        { clave: 'fechaDesde', label: 'Desde', valor: filtrosActuales.fechaDesde },
        { clave: 'fechaHasta', label: 'Hasta', valor: filtrosActuales.fechaHasta }
    ];

    const activos = etiquetas.filter(e => e.valor && e.valor !== '');

    if (badgeFiltros) {
        if (activos.length === 0) {
            badgeFiltros.className = 'pbi-badge pbi-badge-neutral';
            badgeFiltros.textContent = '0 filtros activos';
        } else {
            badgeFiltros.className = 'pbi-badge pbi-badge-active';
            badgeFiltros.textContent = `${activos.length} filtro${activos.length > 1 ? 's' : ''} activo${activos.length > 1 ? 's' : ''}`;
        }
    }

    if (contenedorChips) {
        contenedorChips.innerHTML = '';
        if (activos.length === 0) {
            contenedorChips.innerHTML = '<span class="pbi-chips-vacio">Sin segmentación aplicada. Visualizando el universo total de indicadores.</span>';
        } else {
            activos.forEach(item => {
                const chip = document.createElement('div');
                chip.className = 'pbi-chip-item';
                chip.innerHTML = `
                    <span><strong>${item.label}:</strong> ${item.valor}</span>
                    <span class="pbi-chip-close" onclick="removerFiltroIndividual('${item.clave}')" title="Quitar filtro">✕</span>
                `;
                contenedorChips.appendChild(chip);
            });
        }
    }
}

function removerFiltroIndividual(clave) {
    if (clave === 'direccion') setSelectVal('filtroDireccion', '');
    if (clave === 'gerencia') setSelectVal('filtroGerencia', '');
    if (clave === 'coordinacion') setSelectVal('filtroCoordinacion', '');
    if (clave === 'jefatura') setSelectVal('filtroJefatura', '');
    if (clave === 'categoria') setSelectVal('filtroCategoria', '');
    if (clave === 'puesto') setSelectVal('filtroPuesto', '');
    if (clave === 'legajo') setSelectVal('filtroLegajo', '');

    if (clave === 'programa') setSelectVal('filtroPrograma', '');
    if (clave === 'curso') setSelectVal('filtroCurso', '');
    if (clave === 'centro') setSelectVal('filtroCentro', '');
    if (clave === 'lugar') setSelectVal('filtroLugar', '');
    if (clave === 'fechaDesde') setSelectVal('filtroFechaDesde', '');
    if (clave === 'fechaHasta') setSelectVal('filtroFechaHasta', '');

    actualizarSelectoresEnCascada(clave);
    aplicarFiltrosDesdeUI();
}

function limpiarCampoInput(id) {
    setSelectVal(id, '');
    const trigger = id.replace('filtro', '').toLowerCase();
    actualizarSelectoresEnCascada(trigger);
    aplicarFiltrosDesdeUI();
}

function limpiarTodosFiltros() {
    setSelectVal('filtroDireccion', '');
    setSelectVal('filtroGerencia', '');
    setSelectVal('filtroCoordinacion', '');
    setSelectVal('filtroJefatura', '');
    setSelectVal('filtroCategoria', '');
    setSelectVal('filtroPuesto', '');
    setSelectVal('filtroLegajo', '');

    setSelectVal('filtroPrograma', '');
    setSelectVal('filtroCurso', '');
    setSelectVal('filtroCentro', '');
    setSelectVal('filtroLugar', '');
    setSelectVal('filtroFechaDesde', '');
    setSelectVal('filtroFechaHasta', '');

    actualizarSelectoresEnCascada(null);
    aplicarFiltrosDesdeUI();
}

function setSelectVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function togglePanelFiltros() {
    const body = document.getElementById('pbiFiltrosBody');
    const txtToggle = document.getElementById('txtToggleFiltros');
    if (!body) return;

    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (txtToggle) txtToggle.textContent = '▲ Plegar';
    } else {
        body.style.display = 'none';
        if (txtToggle) txtToggle.textContent = '▼ Desplegar Filtros';
    }
}

// ===================================================
// 7. TABLA DETALLE DE REGISTROS FILTRADOS (POWER BI DATA VIEW)
// ===================================================
function actualizarTablaDetalleFiltrada(capacitaciones) {
    const tbody = document.getElementById('tbodyDetalleFiltrado');
    const lblResumen = document.getElementById('lblResumenTablaFiltrada');
    if (!tbody) return;

    if (lblResumen) {
        lblResumen.textContent = `${capacitaciones.length} actividad${capacitaciones.length !== 1 ? 'es' : ''} filtrada${capacitaciones.length !== 1 ? 's' : ''}`;
    }

    if (capacitaciones.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 25px; color: #94a3b8;">
                    No se encontraron actividades con los filtros seleccionados. Intente ajustar o restablecer los criterios.
                </td>
            </tr>
        `;
        return;
    }

    // Mostrar hasta las primeras 50 para máxima velocidad
    const capVisibles = capacitaciones.slice(0, 50);
    tbody.innerHTML = capVisibles.map(c => {
        const idCap = c._id_normalizado || '-';
        const fecha = c.fecha || c._fecha_iso || '-';
        const curso = c._curso_normalizado || '-';
        const programa = c._programa_normalizado || '-';
        const centro = c._centro_normalizado || '-';
        const lugar = c._lugar_normalizado || '-';
        const modalidad = c.modalidad || 'Presencial';
        const estado = c.estado || 'Finalizada';

        // Cantidad de asistentes para esta capacitación
        const listaAsist = mapAsistentesPorCapacitacion.get(idCap) || [];
        const cantAsist = listaAsist.length;

        let badgeEstadoClase = 'estado-finalizado';
        const estLower = estado.toLowerCase();
        if (estLower.includes('program')) badgeEstadoClase = 'estado-programado';
        else if (estLower.includes('curso')) badgeEstadoClase = 'estado-encurso';

        return `
            <tr>
                <td><strong>#${idCap}</strong></td>
                <td>${fecha}</td>
                <td><strong>${curso}</strong></td>
                <td><span style="color:#0284c7; font-weight:600;">${programa}</span></td>
                <td>${centro}</td>
                <td>${lugar}</td>
                <td>${modalidad}</td>
                <td><span class="badge-estado-pbi ${badgeEstadoClase}">${estado}</span></td>
                <td><span style="font-weight:700; color:#1e293b;">${cantAsist}</span></td>
            </tr>
        `;
    }).join('');

    if (capacitaciones.length > 50) {
        tbody.innerHTML += `
            <tr>
                <td colspan="9" style="text-align:center; background:#f8fafc; font-size:0.75rem; color:#64748b; font-weight:600; padding:10px;">
                    ... y ${capacitaciones.length - 50} actividades más.
                </td>
            </tr>
        `;
    }
}

// ===================================================
// 8. MÓDULOS DE CÁLCULO DE INDICADORES
// ===================================================
function calcularModuloGenerales(capacitaciones, asistentes) {
    const totalActividades = capacitaciones.length;

    // Conteo de capacitaciones / cursos propuestos (temáticas únicas)
    const setCursosUnicos = new Set();
    capacitaciones.forEach(c => {
        const nom = c._curso_normalizado || extraerPropiedadCapacitacion(c, 'curso');
        if (nom && nom !== '-' && String(nom).trim() !== '') {
            setCursosUnicos.add(String(nom).trim().toLowerCase());
        }
    });

    const tieneFiltrosDot = Boolean(
        filtrosActuales.direccion ||
        filtrosActuales.gerencia ||
        filtrosActuales.coordinacion ||
        filtrosActuales.jefatura ||
        filtrosActuales.categoria ||
        filtrosActuales.puesto ||
        filtrosActuales.legajo
    );

    // Si no hay filtros específicos de dotación o fecha, integrar cursos del catálogo propuesto
    if (!filtrosActuales.fechaDesde && !filtrosActuales.fechaHasta && !tieneFiltrosDot && Array.isArray(rawCursos)) {
        rawCursos.forEach(cur => {
            const nom = cur.nombre || cur.nombre_curso;
            const prog = cur.programa || cur.nombre_programa;
            if (nom) {
                if (!filtrosActuales.programa || coincideTextoFiltro(prog, filtrosActuales.programa)) {
                    if (!filtrosActuales.curso || coincideTextoFiltro(nom, filtrosActuales.curso)) {
                        setCursosUnicos.add(String(nom).trim().toLowerCase());
                    }
                }
            }
        });
    }

    const totalCapacitacionesPropuestas = setCursosUnicos.size;

    const legajosUnicos = new Set(
        asistentes
            .map(a => a.legajo || a.dni || a.empleado_id)
            .filter(val => val !== null && val !== undefined && val !== '')
    );
    const personasCapacitadas = legajosUnicos.size;
    const totalAsistencias = asistentes.length;

    setVal('lblCapacitacionesPropuestas', totalCapacitacionesPropuestas);
    setVal('lblTotalActividades', totalActividades);
    setVal('lblPersonasCapacitadas', personasCapacitadas);
    setVal('lblTotalAsistencias', totalAsistencias);
    setVal('lblAsistenciasMes', totalAsistencias);
}

function calcularModuloHoraria(capacitaciones, asistentes) {
    let totalHorasDictadas = 0;
    let totalHorasHombre = 0;

    // Mapa de asistentes filtrados por id de capacitación
    const mapAsistentesPorCap = new Map();
    asistentes.forEach(a => {
        const idCap = normalizarIdCapacitacion(a.id_cap || a.id_capacitacion || a.ID_CAP);
        if (idCap) {
            mapAsistentesPorCap.set(idCap, (mapAsistentesPorCap.get(idCap) || 0) + 1);
        }
    });

    capacitaciones.forEach(c => {
        const ini = c.hs_inicio || c.hora_inicio || c.hora_desde;
        const fin = c.hs_fin || c.hora_fin || c.hora_hasta;
        let hs = 0;

        if (ini && fin) {
            hs = calcularDiferenciaHoras(ini, fin);
        } else {
            const rawDur = c.duracion_hs !== undefined ? c.duracion_hs :
                          (c.DURACION_HS !== undefined ? c.DURACION_HS :
                          (c.duracion !== undefined ? c.duracion :
                          (c.DURACION !== undefined ? c.DURACION :
                          (c.horas !== undefined ? c.horas :
                          (c.HORAS !== undefined ? c.HORAS :
                          (c.carga_horaria !== undefined ? c.carga_horaria :
                          (c.CARGA_HORARIA !== undefined ? c.CARGA_HORARIA : 0)))))));
            hs = parseFloat(String(rawDur).replace(',', '.'));
        }
        if (isNaN(hs) || hs < 0) hs = 0;

        // Horas dictadas: suma neta de horas de las actividades (ej: 7 cursos de 3 hs = 21 hs)
        totalHorasDictadas += hs;

        // Asistentes de la actividad:
        const idCap = c._id_normalizado;
        let cantAsist = 0;
        if (idCap && mapAsistentesPorCap.has(idCap)) {
            cantAsist = mapAsistentesPorCap.get(idCap);
        } else if (c.cant_asistentes || c.asistentes_count || c.total_asistentes) {
            cantAsist = parseInt(c.cant_asistentes || c.asistentes_count || c.total_asistentes, 10) || 0;
        }

        // Horas-Hombre: horas dictadas × asistentes (ej: 21 hs × 10 personas = 210 hs)
        totalHorasHombre += (hs * cantAsist);
    });

    const legajosUnicos = new Set(
        asistentes
            .map(a => a.legajo || a.dni || a.empleado_id)
            .filter(val => val !== null && val !== undefined && val !== '')
    );
    const totalPersonasUnicas = legajosUnicos.size;
    const totalActividades = capacitaciones.length;

    const hsPromedio = totalActividades > 0 ? (totalHorasDictadas / totalActividades) : 0;
    const hsPerCapita = totalPersonasUnicas > 0 ? (totalHorasHombre / totalPersonasUnicas) : 0;

    const formatoHoras = (val) => {
        const rounded = Math.round(val * 10) / 10;
        return `${rounded.toLocaleString('es-AR', { minimumFractionDigits: rounded % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })} hs`;
    };

    setVal('lblTotalHorasDictadas', formatoHoras(totalHorasDictadas));
    setVal('lblTotalHorasHombre', formatoHoras(totalHorasHombre));
    setVal('lblHsPromedioCurso', formatoHoras(hsPromedio));
    setVal('lblHsPerCapita', formatoHoras(hsPerCapita));
}

function calcularModuloOrigen(capacitaciones) {
    let actInternas = 0;
    let actExternas = 0;
    let actVirtuales = 0;

    const totalActividades = capacitaciones.length;

    capacitaciones.forEach(c => {
        const tipo = String(c.tipo || c.origen || c.categoria || '').toLowerCase();
        const modalidad = String(c.modalidad || '').toLowerCase();

        if (tipo.includes('extern')) {
            actExternas++;
        } else {
            actInternas++;
        }

        if (modalidad.includes('virtu') || modalidad.includes('e-learn') || modalidad.includes('onlin')) {
            actVirtuales++;
        }
    });

    const pctElearning = totalActividades > 0 ? Math.round((actVirtuales / totalActividades) * 100) : 0;

    setVal('lblActInternas', actInternas);
    setVal('lblActividadesInternas', actInternas);
    setVal('lblActExternas', actExternas);
    setVal('lblActividadesExternas', actExternas);
    setVal('lblPctElearning', `${pctElearning}%`);
    setVal('lblPorcentajeElearning', `${pctElearning}%`);
    setVal('lblAsistenciasElearning', actVirtuales);
    setVal('lblHsAutogestionadas', '0 hs');
}

function calcularModuloGraficos(capacitaciones, asistentes) {
    const programadasPorMes = Array(12).fill(0);
    const enCursoPorMes = Array(12).fill(0);
    const finalizadasPorMes = Array(12).fill(0);
    const horasPorMes = Array(12).fill(0);
    const personasSetPorMes = Array.from({ length: 12 }, () => new Set());

    // Mapeo rápido de ID de capacitación a su mes correspondiente
    const mapCapacitacionMes = new Map();

    let actPresenciales = 0;
    let actVirtuales = 0;

    capacitaciones.forEach(c => {
        const modalidad = String(c.modalidad || '').toLowerCase();

        if (modalidad.includes('virtu') || modalidad.includes('e-learn') || modalidad.includes('onlin')) {
            actVirtuales++;
        } else {
            actPresenciales++;
        }

        // Calcular duración en horas
        const ini = c.hs_inicio || c.hora_inicio;
        const fin = c.hs_fin || c.hora_fin;
        let hs = 0;
        if (ini && fin) {
            hs = calcularDiferenciaHoras(ini, fin);
        } else {
            hs = parseFloat(c.duracion || c.horas || c.carga_horaria || 0);
        }
        if (isNaN(hs)) hs = 0;

        const fechaStr = c.fecha || c.fecha_curso || c.created_at || c._fecha_iso;
        let numMes = -1;
        if (fechaStr) {
            const iso = c._fecha_iso || normalizarAFechaISO(fechaStr);
            if (iso && iso.includes('-')) {
                const partes = iso.split('-');
                if (partes.length >= 2) {
                    const m = parseInt(partes[1], 10);
                    if (!isNaN(m) && m >= 1 && m <= 12) numMes = m - 1;
                }
            }
        }

        if (c._id_normalizado) {
            mapCapacitacionMes.set(c._id_normalizado, numMes);
        }

        if (numMes >= 0 && numMes < 12) {
            const estadoStr = String(c.estado || c.status || '').toLowerCase();

            if (estadoStr.includes('program')) {
                programadasPorMes[numMes]++;
            } else if (estadoStr.includes('curso')) {
                enCursoPorMes[numMes]++;
            } else {
                finalizadasPorMes[numMes]++;
            }

            horasPorMes[numMes] += hs;
        }
    });

    // Calcular personas capacitadas (únicas) por cada mes
    asistentes.forEach(a => {
        const idCap = normalizarIdCapacitacion(a.id_cap || a.id_capacitacion || a.ID_CAP);
        let numMes = mapCapacitacionMes.has(idCap) ? mapCapacitacionMes.get(idCap) : -1;

        if (numMes < 0 && (a.fecha || a.fecha_capacitacion)) {
            const fechaStr = a.fecha || a.fecha_capacitacion;
            const iso = normalizarAFechaISO(fechaStr);
            if (iso && iso.includes('-')) {
                const partes = iso.split('-');
                if (partes.length >= 2) {
                    const m = parseInt(partes[1], 10);
                    if (!isNaN(m) && m >= 1 && m <= 12) numMes = m - 1;
                }
            }
        }

        if (numMes >= 0 && numMes < 12) {
            const legajo = a.legajo || a.dni || a.empleado_id;
            if (legajo) {
                personasSetPorMes[numMes].add(String(legajo).trim().toLowerCase());
            }
        }
    });

    const personasPorMes = personasSetPorMes.map(set => set.size);

    for (let i = 0; i < 12; i++) {
        horasPorMes[i] = Math.round(horasPorMes[i] * 10) / 10;
    }

    renderizarGraficoEstadosMes(programadasPorMes, enCursoPorMes, finalizadasPorMes);
    renderizarGraficoHorasMes(horasPorMes);
    renderizarGraficoPersonasMes(personasPorMes);
    renderizarGraficoModalidad(actPresenciales, actVirtuales);
}

// ===================================================
// 9. GRÁFICOS (CHART.JS)
// ===================================================
function renderizarGraficoEstadosMes(prog, curso, fin) {
    const canvas = document.getElementById('chartEvolucionMensual') || document.getElementById('chartMeses');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceChartMeses) instanceChartMeses.destroy();

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    instanceChartMeses = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Programadas',
                    data: prog,
                    backgroundColor: '#f97316',
                    borderRadius: 4
                },
                {
                    label: 'En curso',
                    data: curso,
                    backgroundColor: '#0284c7',
                    borderRadius: 4
                },
                {
                    label: 'Finalizadas',
                    data: fin,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    title: {
                        display: true,
                        text: 'Capacitaciones',
                        font: { size: 11, weight: 'bold' },
                        color: '#64748b'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} act.`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoHorasMes(horas) {
    const canvas = document.getElementById('chartHorasMensuales');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceChartHoras) instanceChartHoras.destroy();

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataHoras = (horas && Array.isArray(horas)) ? horas : Array(12).fill(0);

    instanceChartHoras = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Horas Totales',
                    data: dataHoras,
                    backgroundColor: '#6366f1',
                    hoverBackgroundColor: '#4f46e5',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(val) { return val + ' hs'; }
                    },
                    title: {
                        display: true,
                        text: 'Horas Totales',
                        font: { size: 11, weight: 'bold' },
                        color: '#6366f1'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Horas de capacitación: ${context.parsed.y} hs`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoPersonasMes(personas) {
    const canvas = document.getElementById('chartPersonasMensuales');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceChartPersonas) instanceChartPersonas.destroy();

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataPersonas = (personas && Array.isArray(personas)) ? personas : Array(12).fill(0);

    instanceChartPersonas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Personas Capacitadas',
                    data: dataPersonas,
                    backgroundColor: '#0d9488',
                    hoverBackgroundColor: '#0f766e',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    title: {
                        display: true,
                        text: 'Personas Únicas',
                        font: { size: 11, weight: 'bold' },
                        color: '#0d9488'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Personas capacitadas: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoModalidad(presenciales, virtuales) {
    const canvas = document.getElementById('chartModalidad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceChartModalidad) instanceChartModalidad.destroy();

    const dataPresencial = (presenciales === 0 && virtuales === 0) ? 0 : presenciales;
    const dataVirtual = (presenciales === 0 && virtuales === 0) ? 0 : virtuales;

    instanceChartModalidad = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Presencial', 'Virtual / E-Learning'],
            datasets: [{
                data: [dataPresencial, dataVirtual],
                backgroundColor: ['#10b981', '#8b5cf6'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } }
            },
            cutout: '65%'
        }
    });
}

// ===================================================
// 10. NAVEGACIÓN Y CONTROL DEL HUB / DETALLE
// ===================================================
function abrirReporte(idSeccion) {
    const hub = document.getElementById('reportesHubGrid');
    const vistaDetalle = document.getElementById('vistaDetalleReporte');

    if (hub) hub.style.display = 'none';
    if (vistaDetalle) vistaDetalle.style.display = 'block';

    cambiarSeccionDetalle(idSeccion);
}

function cambiarSeccionDetalle(idSeccion) {
    seccionActivaActual = idSeccion;

    // Actualizar botones de la barra de navegación superior
    const botonesNav = ['btnNavGenerales', 'btnNavHoraria', 'btnNavOrigen', 'btnNavGraficos', 'btnNavTodos'];
    botonesNav.forEach(bId => {
        const b = document.getElementById(bId);
        if (b) b.classList.remove('activo');
    });

    const secciones = document.querySelectorAll('.seccion-reporte');
    secciones.forEach(sec => sec.style.display = 'none');

    if (idSeccion === 'todos') {
        const btnTodos = document.getElementById('btnNavTodos');
        if (btnTodos) btnTodos.classList.add('activo');
        setDisplay('secGenerales', 'block');
        setDisplay('secHoraria', 'block');
        setDisplay('secOrigen', 'block');
        setDisplay('secGraficos', 'block');
    } else {
        if (idSeccion === 'generales') {
            setDisplay('secGenerales', 'block');
            const btn = document.getElementById('btnNavGenerales');
            if (btn) btn.classList.add('activo');
        } else if (idSeccion === 'horaria') {
            setDisplay('secHoraria', 'block');
            const btn = document.getElementById('btnNavHoraria');
            if (btn) btn.classList.add('activo');
        } else if (idSeccion === 'origen') {
            setDisplay('secOrigen', 'block');
            const btn = document.getElementById('btnNavOrigen');
            if (btn) btn.classList.add('activo');
        } else if (idSeccion === 'graficos') {
            setDisplay('secGraficos', 'block');
            const btn = document.getElementById('btnNavGraficos');
            if (btn) btn.classList.add('activo');
        }
    }
}

function volverAlHub() {
    const vistaDetalle = document.getElementById('vistaDetalleReporte');
    const hub = document.getElementById('reportesHubGrid');

    if (vistaDetalle) vistaDetalle.style.display = 'none';
    if (hub) hub.style.display = 'grid';
}

// ===================================================
// 11. FUNCIONES AUXILIARES GENERALES
// ===================================================
function calcularDiferenciaHoras(inicioStr, finStr) {
    if (!inicioStr || !finStr) return 0;
    const partesIni = String(inicioStr).split(':').map(Number);
    const partesFin = String(finStr).split(':').map(Number);
    if (partesIni.length < 2 || partesFin.length < 2) return 0;
    const minInicio = partesIni[0] * 60 + partesIni[1];
    const minFin = partesFin[0] * 60 + partesFin[1];
    const diffMinutos = minFin - minInicio;
    return diffMinutos > 0 ? diffMinutos / 60 : 0;
}

function setVal(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (el) el.textContent = valor;
}

function setDisplay(idElemento, displayValue) {
    const el = document.getElementById(idElemento);
    if (el) el.style.display = displayValue;
}

function obtenerModalidad(c) {
    let mod = '';
    if (c.cursos) {
        if (Array.isArray(c.cursos) && c.cursos.length > 0) {
            mod = c.cursos[0].modalidad || '';
        } else if (typeof c.cursos === 'object') {
            mod = c.cursos.modalidad || '';
        }
    }
    if (!mod) {
        mod = c.modalidad || c.tipo || c.origen || c.categoria || '';
    }
    return String(mod).toLowerCase();
}

// Exportar globalmente para eventos onclick en HTML
window.cargarMetricasSIGA = cargarMetricasSIGA;
window.aplicarFiltrosDesdeUI = aplicarFiltrosDesdeUI;
window.limpiarTodosFiltros = limpiarTodosFiltros;
window.removerFiltroIndividual = removerFiltroIndividual;
window.limpiarCampoInput = limpiarCampoInput;
window.togglePanelFiltros = togglePanelFiltros;
window.abrirReporte = abrirReporte;
window.cambiarSeccionDetalle = cambiarSeccionDetalle;
window.volverAlHub = volverAlHub;

// ===================================================
// 12. EXPORTACIÓN MODULAR DE REPORTES EN PDF
// ===================================================
function abrirModalOpcionesPdfReportes() {
    const sub = document.getElementById('pdf_rep_subtitulo');
    if (sub) {
        let txtFiltro = 'Reporte General de Capacitaciones';
        if (filtrosActuales.programa) txtFiltro = `Programa: ${filtrosActuales.programa}`;
        else if (filtrosActuales.curso) txtFiltro = `Curso: ${filtrosActuales.curso}`;
        else if (filtrosActuales.gerencia) txtFiltro = `Gerencia: ${filtrosActuales.gerencia}`;
        sub.textContent = `${txtFiltro} • Seleccioná qué secciones querés incluir en el documento.`;
    }
    const msg = document.getElementById('pdfRepMensajeEstado');
    if (msg) msg.style.display = 'none';

    const modal = document.getElementById('modalOpcionesPdfReportes');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalOpcionesPdfReportes = abrirModalOpcionesPdfReportes;

function cerrarModalOpcionesPdfReportes() {
    const modal = document.getElementById('modalOpcionesPdfReportes');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalOpcionesPdfReportes = cerrarModalOpcionesPdfReportes;

function marcarTodosChecksPdfReportes(marcar) {
    const ids = ['chkPdfRepGenerales', 'chkPdfRepHoraria', 'chkPdfRepOrigen', 'chkPdfRepGraficos', 'chkPdfRepTabla'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(marcar);
    });
}
window.marcarTodosChecksPdfReportes = marcarTodosChecksPdfReportes;

async function generarReportePdfReportes(soloImprimir = false) {
    const incGenerales = document.getElementById('chkPdfRepGenerales')?.checked;
    const incHoraria = document.getElementById('chkPdfRepHoraria')?.checked;
    const incOrigen = document.getElementById('chkPdfRepOrigen')?.checked;
    const incGraficos = document.getElementById('chkPdfRepGraficos')?.checked;
    const incTabla = document.getElementById('chkPdfRepTabla')?.checked;

    if (!incGenerales && !incHoraria && !incOrigen && !incGraficos && !incTabla) {
        return alert('Por favor seleccioná al menos una sección para incluir en el reporte PDF.');
    }

    const msg = document.getElementById('pdfRepMensajeEstado');
    const btnDescargar = document.getElementById('btnDescargarPdfReportes');
    if (msg) {
        msg.style.display = 'block';
        msg.textContent = soloImprimir ? 'Preparando vista de impresión...' : 'Generando documento PDF... Aguarde unos segundos.';
    }
    if (btnDescargar) btnDescargar.disabled = true;

    try {
        const ahora = new Date();
        const fechaEmision = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaEmision = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        // Extraer valores de los KPIs actuales
        const valCapPropuestas = document.getElementById('lblCapacitacionesPropuestas')?.textContent || '0';
        const valTotalAct = document.getElementById('lblTotalActividades')?.textContent || '0';
        const valPersonas = document.getElementById('lblPersonasCapacitadas')?.textContent || '0';
        const valAsistencias = document.getElementById('lblTotalAsistencias')?.textContent || '0';

        const valHorasDict = document.getElementById('lblTotalHorasDictadas')?.textContent || '0.0 hs';
        const valHorasHombre = document.getElementById('lblTotalHorasHombre')?.textContent || '0.0 hs';
        const valHsPromedio = document.getElementById('lblHsPromedioCurso')?.textContent || '0.0 hs';
        const valHsPerCapita = document.getElementById('lblHsPerCapita')?.textContent || '0.0 hs';

        const valActInternas = document.getElementById('lblActInternas')?.textContent || '0';
        const valActExternas = document.getElementById('lblActExternas')?.textContent || '0';
        const valPctElearning = document.getElementById('lblPctElearning')?.textContent || '0%';

        // Armar descripción de filtros activos
        const filtrosTexto = [];
        if (filtrosActuales.programa) filtrosTexto.push(`Programa: <strong>${filtrosActuales.programa}</strong>`);
        if (filtrosActuales.curso) filtrosTexto.push(`Curso: <strong>${filtrosActuales.curso}</strong>`);
        if (filtrosActuales.gerencia) filtrosTexto.push(`Gerencia: <strong>${filtrosActuales.gerencia}</strong>`);
        if (filtrosActuales.direccion) filtrosTexto.push(`Dirección: <strong>${filtrosActuales.direccion}</strong>`);
        if (filtrosActuales.jefatura) filtrosTexto.push(`Jefatura: <strong>${filtrosActuales.jefatura}</strong>`);
        if (filtrosActuales.fechaDesde || filtrosActuales.fechaHasta) {
            filtrosTexto.push(`Período: <strong>${filtrosActuales.fechaDesde || 'Inicio'} a ${filtrosActuales.fechaHasta || 'Hoy'}</strong>`);
        }
        const strFiltros = filtrosTexto.length > 0 ? filtrosTexto.join(' | ') : 'Sin filtros aplicados (Consolidado Global)';

        // Capturar imágenes de gráficos si se seleccionaron
        let imgChartMeses = '';
        let imgChartHoras = '';
        let imgChartPersonas = '';
        let imgChartModalidad = '';

        if (incGraficos) {
            try {
                const c1 = document.getElementById('chartEvolucionMensual');
                if (c1) imgChartMeses = c1.toDataURL('image/png');
                const c2 = document.getElementById('chartHorasMensuales');
                if (c2) imgChartHoras = c2.toDataURL('image/png');
                const c3 = document.getElementById('chartPersonasMensuales');
                if (c3) imgChartPersonas = c3.toDataURL('image/png');
                const c4 = document.getElementById('chartModalidad');
                if (c4) imgChartModalidad = c4.toDataURL('image/png');
            } catch (e) {
                console.warn('Aviso exportando canvas de gráficos:', e);
            }
        }

        const wrap = document.createElement('div');
        wrap.id = 'pdfRenderWrapReportes';
        wrap.style.width = '100%';
        wrap.style.maxWidth = '800px';
        wrap.style.margin = '0 auto';
        wrap.style.padding = '24px';
        wrap.style.background = '#ffffff';
        wrap.style.color = '#0f172a';
        wrap.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
        wrap.style.fontSize = '12px';
        wrap.style.lineHeight = '1.45';
        wrap.style.boxSizing = 'border-box';

        let html = `
            <!-- ENCABEZADO MEMBRETADO -->
            <div style="border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px;">
                        SIGA-AP • SISTEMA INTEGRAL DE GESTIÓN ACADÉMICA
                    </div>
                    <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">
                        INFORME EJECUTIVO DE GESTIÓN Y ANALÍTICAS
                    </h1>
                    <div style="font-size: 11.5px; color: #475569; margin-top: 4px;">
                        ${strFiltros}
                    </div>
                </div>
                <div style="text-align: right; font-size: 10px; color: #64748b; line-height: 1.4;">
                    <div><strong>Fecha:</strong> ${fechaEmision} ${horaEmision} hs</div>
                    <div><strong>Usuario:</strong> Ariel Pizzutto</div>
                    <div><strong>Documento:</strong> SIGA-REP-ANALITICA</div>
                </div>
            </div>
        `;

        // 1. INDICADORES GENERALES
        if (incGenerales) {
            html += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #0284c7; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        📊 Indicadores Generales de Gestión
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Capacitaciones Propuestas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #7c3aed; margin-top: 3px;">${valCapPropuestas}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Actividades</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 3px;">${valTotalAct}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Personas Capacitadas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-top: 3px;">${valPersonas}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Asistencias</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0891b2; margin-top: 3px;">${valAsistencias}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. CARGA HORARIA E INTENSIDAD
        if (incHoraria) {
            html += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #7c3aed; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        ⏱️ Carga Horaria e Intensidad
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Horas Dictadas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #7c3aed; margin-top: 3px;">${valHorasDict}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Horas-Hombre (H-H)</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 3px;">${valHorasHombre}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Promedio Hs / Curso</div>
                            <div style="font-size: 18px; font-weight: 800; color: #ea580c; margin-top: 3px;">${valHsPromedio}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Hs Formación Per Cápita</div>
                            <div style="font-size: 18px; font-weight: 800; color: #1e3a8a; margin-top: 3px;">${valHsPerCapita}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 3. ORIGEN Y E-LEARNING
        if (incOrigen) {
            html += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #059669; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        🏢 Origen y E-Learning
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Capacitaciones Internas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 3px;">${valActInternas}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Capacitaciones Externas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #ea580c; margin-top: 3px;">${valActExternas}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">% Cumplimiento E-Learning</div>
                            <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-top: 3px;">${valPctElearning}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 4. ANÁLISIS DE TENDENCIAS Y DISTRIBUCIÓN
        if (incGraficos) {
            html += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #ea580c; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        📈 Análisis de Tendencias y Distribución
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${imgChartMeses ? `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">Evolución Mensual de Actividades</div>
                                <img src="${imgChartMeses}" style="width: 100%; max-height: 180px; object-fit: contain;">
                            </div>
                        ` : ''}
                        ${imgChartHoras ? `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">Evolución Mensual de Horas Dictadas</div>
                                <img src="${imgChartHoras}" style="width: 100%; max-height: 180px; object-fit: contain;">
                            </div>
                        ` : ''}
                        ${imgChartPersonas ? `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">Personas Capacitadas por Mes</div>
                                <img src="${imgChartPersonas}" style="width: 100%; max-height: 180px; object-fit: contain;">
                            </div>
                        ` : ''}
                        ${imgChartModalidad ? `
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">Distribución por Modalidad</div>
                                <img src="${imgChartModalidad}" style="width: 100%; max-height: 180px; object-fit: contain;">
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // 5. TABLA DE REGISTROS FILTRADOS (OPCIONAL)
        if (incTabla) {
            const tbody = document.getElementById('tbodyDetalleFiltrado');
            if (tbody) {
                const filas = Array.from(tbody.querySelectorAll('tr')).slice(0, 30);
                if (filas.length > 0) {
                    html += `
                        <div style="margin-top: 18px;">
                            <div style="background: #f1f5f9; border-left: 4px solid #334155; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                                📋 Registros Filtrados Computados (Primeras 30 actividades)
                            </div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                                <thead>
                                    <tr style="background: #e2e8f0; color: #1e293b; text-align: left;">
                                        <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Fecha</th>
                                        <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Curso</th>
                                        <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Lugar</th>
                                        <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Modalidad</th>
                                        <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">Horas</th>
                                        <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">Asistencias</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filas.map(tr => {
                                        const tds = tr.querySelectorAll('td');
                                        if (tds.length < 6) return '';
                                        return `
                                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                                <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">${tds[0]?.textContent || '-'}</td>
                                                <td style="padding: 4px 6px; font-weight: 600; border: 1px solid #e2e8f0;">${tds[1]?.textContent || '-'}</td>
                                                <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">${tds[4]?.textContent || '-'}</td>
                                                <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">${tds[5]?.textContent || '-'}</td>
                                                <td style="padding: 4px 6px; text-align: right; border: 1px solid #e2e8f0;">${tds[6]?.textContent || '0'}</td>
                                                <td style="padding: 4px 6px; text-align: right; font-weight: 700; border: 1px solid #e2e8f0;">${tds[7]?.textContent || '0'}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }
        }

        // PIE DE PÁGINA
        html += `
            <div style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8;">
                <div>SIGA-AP • Dirección de Capacitación y Gestión de Talento</div>
                <div>Documento Oficial Generado Automáticamente</div>
            </div>
        `;

        wrap.innerHTML = html;

        if (soloImprimir) {
            const ventana = window.open('', '_blank');
            if (ventana) {
                ventana.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Reporte_Capacitaciones_SIGA</title>
                        <style>
                            @page { size: A4; margin: 10mm; }
                            body { margin: 0; padding: 0; background: #fff; }
                            @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            }
                        </style>
                    </head>
                    <body>
                        ${wrap.outerHTML}
                        <script>
                            window.onload = function() {
                                window.focus();
                                window.print();
                            };
                        </script>
                    </body>
                    </html>
                `);
                ventana.document.close();
            } else {
                window.print();
            }
        } else {
            if (typeof html2pdf === 'function') {
                const opt = {
                    margin: [8, 8, 8, 8],
                    filename: `Reporte_Capacitaciones_SIGA_${ahora.toISOString().slice(0, 10)}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                await html2pdf().set(opt).from(wrap).save();
                if (msg) {
                    msg.style.background = '#dcfce7';
                    msg.style.color = '#15803d';
                    msg.textContent = '¡Reporte PDF generado y descargado exitosamente!';
                    setTimeout(() => { cerrarModalOpcionesPdfReportes(); }, 1600);
                }
            } else {
                const ventana = window.open('', '_blank');
                if (ventana) {
                    ventana.document.write(`<!DOCTYPE html><html><head><title>Reporte</title></head><body>${wrap.outerHTML}<script>window.onload=function(){window.print();}</script></body></html>`);
                    ventana.document.close();
                } else {
                    window.print();
                }
            }
        }

    } catch (err) {
        console.error('Error generando PDF en reportes:', err);
        alert('Ocurrió un error al generar el PDF: ' + err.message);
    } finally {
        if (btnDescargar) btnDescargar.disabled = false;
    }
}
window.generarReportePdfReportes = generarReportePdfReportes;
