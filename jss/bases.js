//======================================================
// SIGA_AP - GESTIÓN DE BASES DE DATOS LOCALES (IMPORT/EXPORT MULTIFORMATO)
//======================================================

const archivoBase = document.getElementById("archivoBase");
const btnGenerarBase = document.getElementById("btnGenerarBase");
const estadoBase = document.getElementById("estadoBase");

let archivoSeleccionado = null;

//======================================================
// EVENTOS DE IMPORTACIÓN
//======================================================

if (archivoBase) {
    archivoBase.addEventListener("change", function (e) {
        archivoSeleccionado = e.target.files[0];
        if (archivoSeleccionado) {
            estadoBase.value = `Archivo listo: ${archivoSeleccionado.name}`;
        } else {
            estadoBase.value = "Esperando archivo...";
        }
    });
}

if (btnGenerarBase) {
    btnGenerarBase.addEventListener("click", generarBase);
}

function obtenerClienteDB() {
    return window.dbLocal || window.supabaseClient || window.supabase;
}

//======================================================
// PARSER SQL INSERTS -> OBJETOS JS
//======================================================
function parsearSQLInserts(sqlTexto, tablaObjetivo) {
    const filas = [];
    const lineas = sqlTexto.split(/\r?\n/);
    
    // Regex para capturar INSERT INTO tabla (col1, col2) VALUES (val1, val2);
    const regexInsert = /INSERT\s+INTO\s+([`"'\w]+)\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+);?/i;
    
    for (let linea of lineas) {
        linea = linea.trim();
        if (!linea || linea.startsWith('--') || linea.startsWith('/*')) continue;
        
        const match = linea.match(regexInsert);
        if (match) {
            const nombreTablaSQL = match[1].replace(/[`"']/g, '').trim().toLowerCase();
            const columnasStr = match[2];
            let valoresBloque = match[3];
            
            // Si la tabla del insert no coincide con la seleccionada y no es genérica, igual la parseamos si estamos en ella
            let columnas = [];
            if (columnasStr) {
                columnas = columnasStr.split(',').map(c => c.replace(/[`"'\s]/g, ''));
            }
            
            // Extraer tuplas (...), (...)
            const tuplasRegex = /\(([^)]+)\)/g;
            let tuplaMatch;
            while ((tuplaMatch = tuplasRegex.exec(valoresBloque)) !== null) {
                const valsRaw = tuplaMatch[1];
                // Dividir respetando strings entre comillas
                const valores = [];
                let currVal = '';
                let inQuotes = false;
                let quoteChar = '';
                
                for (let i = 0; i < valsRaw.length; i++) {
                    const ch = valsRaw[i];
                    if ((ch === "'" || ch === '"') && (i === 0 || valsRaw[i-1] !== '\\')) {
                        if (inQuotes && ch === quoteChar) {
                            inQuotes = false;
                        } else if (!inQuotes) {
                            inQuotes = true;
                            quoteChar = ch;
                        }
                    } else if (ch === ',' && !inQuotes) {
                        valores.push(currVal.trim());
                        currVal = '';
                        continue;
                    }
                    currVal += ch;
                }
                valores.push(currVal.trim());
                
                // Limpiar valores (quitar comillas y manejar null)
                const filaObj = {};
                valores.forEach((v, idx) => {
                    let vLimpio = v;
                    if ((vLimpio.startsWith("'") && vLimpio.endsWith("'")) || (vLimpio.startsWith('"') && vLimpio.endsWith('"'))) {
                        vLimpio = vLimpio.slice(1, -1);
                    }
                    if (vLimpio.toUpperCase() === 'NULL') {
                        vLimpio = null;
                    }
                    
                    const colName = columnas[idx] || `col_${idx}`;
                    filaObj[colName] = vLimpio;
                });
                
                filas.push(filaObj);
            }
        }
    }
    return filas;
}

//======================================================
// EXTRACCIÓN DE DOTACIÓN DESDE HOJA EXCEL
//======================================================
function normalizarTextoHeader(txt) {
    if (!txt) return '';
    return String(txt)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function registrarFechaDotacion(total) {
    const ahora = new Date();
    const fechaHoraFormat = ahora.toLocaleDateString('es-AR') + ' ' + ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ` hs (${total} empleados)`;
    localStorage.setItem('fechaUltimaDotacion', fechaHoraFormat);
    if (typeof window.actualizarFechaDotacionUI === 'function') {
        window.actualizarFechaDotacionUI();
    }
}

function extraerFilasDotacion(hoja) {
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1 });
    if (!filas || filas.length === 0) return [];

    let indiceEncabezado = -1;
    let maxPuntajeHeaders = 0;
    let nombresColumnas = [];
    let colIndices = {
        legajo: -1,
        apellido: -1,
        nombre: -1,
        nombre_completo: -1,
        puesto: -1,
        categoria: -1,
        direccion: -1,
        gerencia: -1,
        coordinacion: -1,
        jefatura: -1,
        manager: -1,
        email: -1
    };

    // Títulos oficiales de referencia de la dotación de RRHH (38 columnas en orden)
    const TITULOS_OFICIALES_DOTACION = [
        "Número de persona", "Apellido", "Nombre", "Código de puesto", "Puesto", 
        "Código de posición", "Posición", "Encuadre", "Categoría", "Puesto de Liquidación", 
        "Fecha vencimiento reubicación", "CID", "Departamento superior", "Departamento nivel 1", 
        "Departamento nivel 2", "Departamento nivel 3", "Departamento nivel 4", "Departamento nivel 5", 
        "Departamento", "Nombre del mánager", "Ubicación del mánager", "Afiliado", 
        "Nombre del sindicato", "Personal Operativo / No operativo", "Motivos personal no operativo", 
        "Género", "Estado civil", "Número de documento de identidad", "Fecha de nacimiento de persona", 
        "Fecha de contratación", "Años de antigüedad", "Fecha de antigüedad", "Fecha de inicio de asignación", 
        "Fecha de cese", "Mayor nivel educativo alcanzado", "Categoría de asignación", "Estado de asignación", 
        "Correo electrónico principal"
    ];

    // Palabras clave para detectar la fila de encabezados (ignora celdas de título tipo 'Nómina Emova' en filas 1 y 2)
    const keywordsDetect = ['persona', 'numerodepersona', 'legajo', 'leg', 'dni', 'ficha', 'apellido', 'ape', 'nombre', 'puesto', 'cargo', 'departamento', 'gerencia', 'direccion', 'coordinacion', 'jefatura', 'manager', 'correo', 'email', 'mail'];

    for (let r = 0; r < Math.min(15, filas.length); r++) {
        const f = filas[r];
        if (!Array.isArray(f)) continue;
        const cNorms = f.map(c => normalizarTextoHeader(c));
        let puntaje = 0;
        cNorms.forEach(c => {
            if (keywordsDetect.some(k => c && c.includes(k))) puntaje++;
        });

        if (puntaje > maxPuntajeHeaders) {
            maxPuntajeHeaders = puntaje;
            indiceEncabezado = r;
        }
    }

    if (indiceEncabezado === -1 && filas.length > 2) {
        indiceEncabezado = 2; // Fila 3 por defecto en planillas RRHH
    } else if (indiceEncabezado === -1 && filas.length > 0) {
        indiceEncabezado = 0;
    }

    if (indiceEncabezado !== -1) {
        nombresColumnas = filas[indiceEncabezado].map(c => String(c || "").trim());
        nombresColumnas.forEach((colRaw, idx) => {
            const c = normalizarTextoHeader(colRaw);
            if (!c) return;

            // Legajo = Número de persona (Columna 1 / idx 0)
            if (idx === 0 || c.includes('numerodepersona') || c.includes('nropersona') || c === 'legajo' || c === 'leg' || c === 'nrolegajo' || c === 'nlegajo' || c === 'id' || c === 'dni' || c === 'ficha' || c === 'matricula') {
                if (colIndices.legajo === -1 || idx === 0) colIndices.legajo = idx;
            }
            // Apellido = Apellido (Columna 2 / idx 1)
            else if (idx === 1 || c === 'apellido' || c === 'apellidos' || c === 'ape' || c === 'lastname' || c === 'surname') {
                if (colIndices.apellido === -1 || idx === 1) colIndices.apellido = idx;
            }
            // Nombre = Nombre (Columna 3 / idx 2)
            else if ((idx === 2 || c === 'nombre' || c === 'nombres' || c === 'nom' || c === 'firstname') && !c.includes('manager') && !c.includes('sindicato') && !c.includes('completo')) {
                if (colIndices.nombre === -1 || idx === 2) colIndices.nombre = idx;
            }
            // Nombre completo
            else if (c.includes('nombrecompleto') || c.includes('nombreyapellido') || c.includes('apellidoynombre') || c === 'empleado' || c === 'agente' || c === 'persona' || c === 'colaborador') {
                if (colIndices.nombre_completo === -1) colIndices.nombre_completo = idx;
            }
            // Puesto = Puesto (Columna 5 / idx 4)
            else if ((idx === 4 || c === 'puesto' || c.includes('puesto') || c === 'cargo' || c === 'jobtitle') && !c.includes('codigo') && !c.includes('cod') && !c.includes('liquidacion') && !c.includes('asignacion')) {
                if (colIndices.puesto === -1 || idx === 4) colIndices.puesto = idx;
            }
            // Categoría = Categoría (Columna 9 / idx 8)
            else if ((idx === 8 || c === 'categoria' || c === 'cat' || c.includes('categor') || c.includes('convenio')) && !c.includes('asignacion')) {
                if (colIndices.categoria === -1 || idx === 8) colIndices.categoria = idx;
            }
            // Dirección = Departamento nivel 1 (Columna 14 / idx 13)
            else if (idx === 13 || c.includes('departamentonivel1') || c.includes('deptomivel1') || c.includes('deptol1') || c === 'direccion' || (c.includes('direcc') && !c.includes('ejecutiva') && !c.includes('gerenc'))) {
                if (colIndices.direccion === -1 || idx === 13) colIndices.direccion = idx;
            }
            // Gerencia = Departamento nivel 2 (Columna 15 / idx 14)
            else if (idx === 14 || c.includes('departamentonivel2') || c.includes('deptomivel2') || c.includes('deptol2') || c === 'gerencia' || c.includes('gerencia') || c.includes('departamento') || c.includes('management')) {
                if (colIndices.gerencia === -1 || idx === 14) colIndices.gerencia = idx;
            }
            // Coordinación = Departamento nivel 3 (Columna 16 / idx 15)
            else if (idx === 15 || c.includes('departamentonivel3') || c.includes('deptomivel3') || c.includes('deptol3') || c === 'coordinacion' || c.includes('coordinac')) {
                if (colIndices.coordinacion === -1 || idx === 15) colIndices.coordinacion = idx;
            }
            // Jefatura = Departamento nivel 4 (Columna 17 / idx 16)
            else if (idx === 16 || c.includes('departamentonivel4') || c.includes('deptomivel4') || c.includes('deptol4') || c === 'jefatura' || c.includes('jefat') || c === 'jefe' || c.includes('supervisor') || c.includes('supervision') || c.includes('lider')) {
                if (colIndices.jefatura === -1 || idx === 16) colIndices.jefatura = idx;
            }
            // Manager = Nombre del manager (Columna 20 / idx 19)
            else if (idx === 19 || c.includes('nombredelmanager') || c.includes('manager') || c.includes('superior') || c.includes('responsable')) {
                if (colIndices.manager === -1 || idx === 19) colIndices.manager = idx;
            }
            // Email = Correo electrónico principal (Columna 38 / idx 37)
            else if (idx === 37 || c.includes('correoelectronicoprincipal') || c.includes('correoelectronico') || c.includes('correo') || c.includes('email') || c.includes('mail')) {
                if (colIndices.email === -1 || idx === 37) colIndices.email = idx;
            }
        });
    }

    // Fallbacks exactos por posición oficial de RRHH
    if (colIndices.legajo === -1) colIndices.legajo = 0;       // Col 1 (A)
    if (colIndices.apellido === -1) colIndices.apellido = 1;   // Col 2 (B)
    if (colIndices.nombre === -1) colIndices.nombre = 2;       // Col 3 (C)
    if (colIndices.puesto === -1) colIndices.puesto = 4;       // Col 5 (E)
    if (colIndices.categoria === -1) colIndices.categoria = 8; // Col 9 (I)
    if (colIndices.direccion === -1) colIndices.direccion = 13;// Col 14 (N)
    if (colIndices.gerencia === -1) colIndices.gerencia = 14;   // Col 15 (O)
    if (colIndices.coordinacion === -1) colIndices.coordinacion = 15; // Col 16 (P)
    if (colIndices.jefatura === -1) colIndices.jefatura = 16;   // Col 17 (Q)
    if (colIndices.manager === -1) colIndices.manager = 19;     // Col 20 (T)
    if (colIndices.email === -1) colIndices.email = 37;         // Col 38 (AL)

    const filaInicio = (indiceEncabezado !== -1) ? indiceEncabezado + 1 : 1;
    const registros = [];

    for (let i = filaInicio; i < filas.length; i++) {
        const fila = filas[i];
        if (!fila || !Array.isArray(fila) || fila.length === 0) continue;

        const rawLegajo = String(colIndices.legajo !== -1 && fila[colIndices.legajo] !== undefined ? fila[colIndices.legajo] : fila[0] || "").trim();
        if (!rawLegajo || rawLegajo.toLowerCase().includes("total") || rawLegajo.startsWith("===") || rawLegajo.toLowerCase().includes("nómina") || rawLegajo.toLowerCase().includes("nomina")) {
            continue;
        }

        const legNum = parseInt(rawLegajo.replace(/\D/g, ''), 10);
        const legajoFormateado = !isNaN(legNum) ? String(legNum).padStart(5, "0") : rawLegajo;

        let apellido = colIndices.apellido !== -1 && fila[colIndices.apellido] !== undefined ? String(fila[colIndices.apellido]).trim() : (fila[1] !== undefined ? String(fila[1]).trim() : "");
        let nombre = colIndices.nombre !== -1 && fila[colIndices.nombre] !== undefined ? String(fila[colIndices.nombre]).trim() : (fila[2] !== undefined ? String(fila[2]).trim() : "");

        // Si apellido está vacío y hay nombre_completo o nombre con coma
        if (!apellido && colIndices.nombre_completo !== -1 && fila[colIndices.nombre_completo]) {
            const nomComp = String(fila[colIndices.nombre_completo]).trim();
            if (nomComp.includes(',')) {
                const parts = nomComp.split(',');
                apellido = parts[0].trim();
                nombre = parts.slice(1).join(',').trim();
            } else if (nomComp.includes(' ')) {
                const parts = nomComp.split(' ');
                apellido = parts[0].trim();
                nombre = parts.slice(1).join(' ').trim();
            } else {
                apellido = nomComp;
            }
        } else if (!apellido && nombre && nombre.includes(',')) {
            const parts = nombre.split(',');
            apellido = parts[0].trim();
            nombre = parts.slice(1).join(',').trim();
        }

        // Puesto = Columna 5 (idx 4)
        let puesto = "";
        if (colIndices.puesto !== -1 && fila[colIndices.puesto] !== undefined && String(fila[colIndices.puesto]).trim() !== "") {
            puesto = String(fila[colIndices.puesto]).trim();
        } else if (fila[4] !== undefined) {
            puesto = String(fila[4]).trim();
        }

        // Categoría = Columna 9 (idx 8)
        let categoria = "";
        if (colIndices.categoria !== -1 && fila[colIndices.categoria] !== undefined && String(fila[colIndices.categoria]).trim() !== "") {
            categoria = String(fila[colIndices.categoria]).trim();
        } else if (fila[8] !== undefined) {
            categoria = String(fila[8]).trim();
        }

        // Dirección = Departamento nivel 1 (Columna 14 / idx 13)
        let direccion = "";
        if (colIndices.direccion !== -1 && fila[colIndices.direccion] !== undefined && String(fila[colIndices.direccion]).trim() !== "") {
            direccion = String(fila[colIndices.direccion]).trim();
        } else if (fila[13] !== undefined) {
            direccion = String(fila[13]).trim();
        }

        // Gerencia = Departamento nivel 2 (Columna 15 / idx 14)
        let gerencia = "";
        if (colIndices.gerencia !== -1 && fila[colIndices.gerencia] !== undefined && String(fila[colIndices.gerencia]).trim() !== "") {
            gerencia = String(fila[colIndices.gerencia]).trim();
        } else if (fila[14] !== undefined) {
            gerencia = String(fila[14]).trim();
        }

        // Coordinación = Departamento nivel 3 (Columna 16 / idx 15)
        let coordinacion = "";
        if (colIndices.coordinacion !== -1 && fila[colIndices.coordinacion] !== undefined && String(fila[colIndices.coordinacion]).trim() !== "") {
            coordinacion = String(fila[colIndices.coordinacion]).trim();
        } else if (fila[15] !== undefined) {
            coordinacion = String(fila[15]).trim();
        }

        // Jefatura = Departamento nivel 4 (Columna 17 / idx 16)
        let jefatura = "";
        if (colIndices.jefatura !== -1 && fila[colIndices.jefatura] !== undefined && String(fila[colIndices.jefatura]).trim() !== "") {
            jefatura = String(fila[colIndices.jefatura]).trim();
        } else if (fila[16] !== undefined) {
            jefatura = String(fila[16]).trim();
        }

        // Manager = Nombre del manager (Columna 20 / idx 19)
        let manager = "";
        if (colIndices.manager !== -1 && fila[colIndices.manager] !== undefined && String(fila[colIndices.manager]).trim() !== "") {
            manager = String(fila[colIndices.manager]).trim();
        } else if (fila[19] !== undefined) {
            manager = String(fila[19]).trim();
        }

        // Email = Correo electrónico principal (Columna 38 / idx 37)
        let email = "";
        if (colIndices.email !== -1 && fila[colIndices.email] !== undefined && String(fila[colIndices.email]).trim() !== "") {
            email = String(fila[colIndices.email]).trim();
        } else if (fila[37] !== undefined) {
            email = String(fila[37]).trim();
        }

        const empleadoObj = {
            legajo: legajoFormateado,
            apellido: apellido,
            nombre: nombre,
            puesto: puesto,
            categoria: categoria,
            direccion: direccion,
            gerencia: gerencia,
            coordinacion: coordinacion,
            jefatura: jefatura,
            manager: manager,
            email: email
        };

        // Guardar todas las columnas originales en su orden exacto para preservación integral sin modificar la base de RRHH
        const datosCompletos = {};
        fila.forEach((valor, colIdx) => {
            const rawHeaderName = (nombresColumnas[colIdx] && String(nombresColumnas[colIdx]).trim()) 
                ? String(nombresColumnas[colIdx]).trim() 
                : (TITULOS_OFICIALES_DOTACION[colIdx] || `col_${colIdx}`);
            const valorLimpio = valor !== undefined && valor !== null ? String(valor).trim() : "";
            datosCompletos[rawHeaderName] = valorLimpio;
            datosCompletos[`col_${colIdx}`] = valorLimpio;
            if (!empleadoObj.hasOwnProperty(rawHeaderName)) {
                empleadoObj[rawHeaderName] = valorLimpio;
            }
        });
        empleadoObj.datos_completos = datosCompletos;
        registros.push(empleadoObj);
    }
    return registros;
}

//======================================================
// PARSER PARA BACKUP CSV MULTI-TABLA
//======================================================
function parsearBackupCSVMultiTabla(csvTexto) {
    const mapaNombres = {
        'dotacion': 'dotacion', 'dotacion_personal': 'dotacion',
        'capacitaciones': 'capacitaciones',
        'asistencias': 'asistentes', 'asistentes': 'asistentes',
        'cursos': 'cursos',
        'instructores': 'instructores',
        'programas': 'programas',
        'evaluaciones_satisfaccion': 'evaluaciones_satisfaccion', 'evaluaciones': 'evaluaciones_satisfaccion',
        'transferencias': 'transferencias',
        'encuestas_transferencia': 'encuestas_transferencia', 'encuesta_transferencia': 'encuestas_transferencia',
        'profiles': 'profiles', 'usuarios_permisos': 'profiles', 'usuarios': 'profiles'
    };

    const resultado = {};
    const bloques = csvTexto.split(/=== TABLA:\s*([^=\r\n]+)\s*===/i);
    
    if (bloques.length > 1) {
        for (let i = 1; i < bloques.length; i += 2) {
            const rawNombre = bloques[i].trim().toLowerCase().replace(/\s+/g, '_');
            const targetKey = mapaNombres[rawNombre] || rawNombre;
            const contenido = (bloques[i+1] || '').trim();
            if (contenido) {
                const lineas = contenido.split(/\r?\n/).filter(l => l.trim().length > 0);
                if (lineas.length > 1) {
                    const delimitador = lineas[0].includes(';') ? ';' : ',';
                    const encabezados = lineas[0].split(delimitador).map(h => h.replace(/^["']|["']$/g, '').trim());
                    const filas = [];
                    for (let r = 1; r < lineas.length; r++) {
                        const l = lineas[r];
                        if (l.startsWith('===') || !l.trim()) continue;
                        const vals = [];
                        let curr = '', inQ = false;
                        for (let c = 0; c < l.length; c++) {
                            const ch = l[c];
                            if (ch === '"') inQ = !inQ;
                            else if (ch === delimitador && !inQ) {
                                vals.push(curr.replace(/^["']|["']$/g, '').trim());
                                curr = '';
                                continue;
                            }
                            curr += ch;
                        }
                        vals.push(curr.replace(/^["']|["']$/g, '').trim());

                        const filaObj = {};
                        encabezados.forEach((enc, idx) => {
                            filaObj[enc] = vals[idx] !== undefined ? vals[idx] : '';
                        });
                        filas.push(filaObj);
                    }
                    resultado[targetKey] = filas;
                }
            }
        }
    }
    return resultado;
}

//======================================================
// IMPORTADOR UNIVERSAL DE BASES (EXCEL, JSON, SQL, CSV)
//======================================================

async function generarBase() {
    if (!archivoSeleccionado) {
        alert("Por favor seleccione un archivo (.xlsx, .xls, .json, .sql o .csv).");
        return;
    }

    const selectBase = document.getElementById("baseDatos");
    const tablaDestino = selectBase ? selectBase.value : "dotacion";
    const modoImportacion = document.getElementById("modoImportacion")?.value || "reemplazar";
    const nombreArchivo = archivoSeleccionado.name.toLowerCase();

    estadoBase.value = "Leyendo archivo...";

    const lector = new FileReader();

    lector.onload = async function (evento) {
        try {
            const db = obtenerClienteDB();
            if (!db) {
                throw new Error("El motor de base de datos no está disponible.");
            }

            let registros = [];
            let tablaFinal = tablaDestino;

            // 1. CASO SQL (.sql o .txt)
            if (nombreArchivo.endsWith('.sql') || (nombreArchivo.endsWith('.txt') && typeof evento.target.result === 'string' && evento.target.result.toUpperCase().includes('INSERT INTO'))) {
                const textoSQL = typeof evento.target.result === 'string' ? evento.target.result : new TextDecoder().decode(evento.target.result);
                registros = parsearSQLInserts(textoSQL, tablaDestino);
                if (registros.length === 0 && modoImportacion === 'fusionar') {
                    throw new Error("No se detectaron sentencias INSERT válidas en el archivo SQL.");
                }
            }
            // 2. CASO CSV (.csv o .txt plano)
            else if (nombreArchivo.endsWith('.csv') || (typeof evento.target.result === 'string' && evento.target.result.includes('=== TABLA:'))) {
                const textoCSV = decodificarTextoArchivo(evento.target.result);
                
                // Si es un backup total multi-tabla en CSV
                if (textoCSV.includes('=== TABLA:')) {
                    const tablasCSV = parsearBackupCSVMultiTabla(textoCSV);
                    let totalImportados = 0;
                    let tablasProcesadas = 0;

                    for (const [nomT, filasT] of Object.entries(tablasCSV)) {
                        tablasProcesadas++;
                        let filasProcesadas = filasT;
                        if (nomT === 'asistentes' || nomT === 'asistencias') {
                            filasProcesadas = filasT.map(normalizarRegistroAsistente);
                        } else if (nomT === 'capacitaciones') {
                            filasProcesadas = filasT.map(normalizarRegistroCapacitacion);
                        } else if (nomT === 'dotacion') {
                            filasProcesadas = normalizarRegistrosDotacion(filasT);
                        }
                        if (modoImportacion === 'reemplazar') {
                            if (window.dbLocal && window.dbLocal.raw && window.dbLocal.raw.guardarTablaAsync) {
                                await window.dbLocal.raw.guardarTablaAsync(nomT, filasProcesadas);
                            } else if (window.dbLocal && window.dbLocal.raw) {
                                window.dbLocal.raw.escribirTabla(nomT, filasProcesadas);
                            }
                            if (nomT === 'dotacion') {
                                registrarFechaDotacion(filasProcesadas.length);
                            }
                            totalImportados += filasProcesadas.length;
                        } else {
                            if (filasProcesadas.length > 0) {
                                let pk = 'id';
                                if (nomT === 'dotacion') {
                                    pk = 'legajo';
                                    registrarFechaDotacion(filasProcesadas.length);
                                }
                                else if (nomT === 'capacitaciones') pk = 'id_cap';
                                else if (nomT === 'transferencias') pk = 'id_tra';
                                else if (nomT === 'cursos') pk = 'codigo_curso';
                                else if (nomT === 'profiles') pk = 'usuario';

                                await db.from(nomT).upsert(filasProcesadas, { onConflict: pk });
                                totalImportados += filasProcesadas.length;
                            }
                        }
                    }
                    try {
                        localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
                        localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
                        window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { accion: 'importacion_backup_csv' } }));
                    } catch (e) {}
                    const acc = modoImportacion === 'reemplazar' ? 'reemplazado / sobreescrito' : 'fusionado';
                    estadoBase.value = `¡Backup CSV multi-tabla restaurado! (${totalImportados} registros en ${tablasProcesadas} tablas)`;
                    alert(`¡Éxito! Se ha ${acc} el contenido de ${tablasProcesadas} tablas con ${totalImportados} registros totales.`);
                    return;
                }

                // CSV de una sola tabla con parseo plano y soporte de delimitadores (; , \t)
                registros = parsearCSVPlano(textoCSV);
                tablaFinal = detectarTablaDestino(nombreArchivo, registros, tablaDestino);

                if (tablaFinal === "capacitaciones") {
                    registros = registros.map(normalizarRegistroCapacitacion);
                } else if (tablaFinal === "asistentes" || tablaFinal === "asistencias") {
                    registros = registros.map(normalizarRegistroAsistente);
                } else if (tablaFinal === "dotacion") {
                    registros = normalizarRegistrosDotacion(registros);
                }
            }
            // 3. CASO JSON (.json)
            else if (nombreArchivo.endsWith('.json')) {
                const textoJSON = typeof evento.target.result === 'string' ? evento.target.result : new TextDecoder().decode(evento.target.result);
                const parsed = JSON.parse(textoJSON);

                // Si es un backup multi-tabla estructurado
                if (parsed.tablas && typeof parsed.tablas === 'object') {
                    let totalImportados = 0;
                    let tablasRestauradas = 0;
                    for (const [nombreT, datosT] of Object.entries(parsed.tablas)) {
                        let lista = Array.isArray(datosT) ? datosT : [];
                        if (nombreT === 'asistentes' || nombreT === 'asistencias') {
                            lista = lista.map(normalizarRegistroAsistente);
                        }
                        tablasRestauradas++;
                        if (modoImportacion === 'reemplazar') {
                            if (window.dbLocal && window.dbLocal.raw && window.dbLocal.raw.guardarTablaAsync) {
                                await window.dbLocal.raw.guardarTablaAsync(nombreT, lista);
                            } else if (window.dbLocal && window.dbLocal.raw) {
                                window.dbLocal.raw.escribirTabla(nombreT, lista);
                            }
                            if (nombreT === 'dotacion') {
                                registrarFechaDotacion(lista.length);
                            }
                            totalImportados += lista.length;
                        } else {
                            if (lista.length > 0) {
                                let pk = 'id';
                                if (nombreT === 'dotacion') {
                                    pk = 'legajo';
                                    registrarFechaDotacion(lista.length);
                                }
                                else if (nombreT === 'capacitaciones') pk = 'id_cap';
                                else if (nombreT === 'transferencias') pk = 'id_tra';
                                else if (nombreT === 'cursos') pk = 'codigo_curso';
                                else if (nombreT === 'profiles') pk = 'usuario';

                                await db.from(nombreT).upsert(lista, { onConflict: pk });
                                totalImportados += lista.length;
                            }
                        }
                    }
                    try {
                        localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
                        localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
                        window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { accion: 'importacion_backup_json' } }));
                    } catch (e) {}
                    const acc = modoImportacion === 'reemplazar' ? 'reemplazado' : 'fusionado';
                    estadoBase.value = `¡Backup completo ${acc}! (${totalImportados} registros en ${tablasRestauradas} tablas)`;
                    alert(`¡Éxito! Se ha ${acc} el backup con ${totalImportados} registros en ${tablasRestauradas} tablas.`);
                    return;
                }

                registros = Array.isArray(parsed) ? parsed : (parsed.data || [parsed]);
                if (tablaDestino === "asistentes" || tablaDestino === "asistencias") {
                    registros = registros.map(normalizarRegistroAsistente);
                }
            }
            // 4. CASO EXCEL (.xlsx, .xls)
            else {
                const datos = new Uint8Array(evento.target.result);
                const libro = XLSX.read(datos, { type: "array" });

                const mapaHojas = {
                    'dotacion_personal': 'dotacion', 'dotacion': 'dotacion', 'dotación': 'dotacion', 'dotación_personal': 'dotacion',
                    'capacitaciones': 'capacitaciones',
                    'asistencias': 'asistentes', 'asistentes': 'asistentes',
                    'cursos': 'cursos',
                    'instructores': 'instructores',
                    'programas': 'programas',
                    'proveedores': 'proveedores', 'proveedor': 'proveedores', 'entes': 'proveedores', 'entes_calificadores': 'proveedores',
                    'evaluaciones_satisfaccion': 'evaluaciones_satisfaccion', 'evaluaciones': 'evaluaciones_satisfaccion',
                    'transferencias': 'transferencias',
                    'encuestas_transferencia': 'encuestas_transferencia', 'encuesta_transferencia': 'encuestas_transferencia',
                    'certificaciones_externas': 'certificaciones_externas', 'certificaciones': 'certificaciones_externas', 'certificados': 'certificaciones_externas', 'calificaciones': 'certificaciones_externas',
                    'usuarios_permisos': 'profiles', 'usuarios': 'profiles', 'profiles': 'profiles'
                };

                // Si se seleccionó "TODAS" o el Excel tiene múltiples hojas de backup
                if (tablaDestino === "TODAS" || (libro.SheetNames.length > 1 && libro.SheetNames.some(s => mapaHojas[s.trim().toLowerCase().replace(/\s+/g, '_')]))) {
                    let totalImportados = 0;
                    let tablasProcesadas = 0;

                    for (const sheetName of libro.SheetNames) {
                        const normalizado = sheetName.trim().toLowerCase().replace(/\s+/g, '_');
                        const targetKey = mapaHojas[normalizado] || mapaHojas[sheetName.trim().toLowerCase()];
                        if (targetKey) {
                            tablasProcesadas++;
                            let rows = [];
                            if (targetKey === 'dotacion') {
                                rows = extraerFilasDotacion(libro.Sheets[sheetName]);
                            } else {
                                rows = XLSX.utils.sheet_to_json(libro.Sheets[sheetName]) || [];
                            }
                            if (targetKey === 'asistentes' || targetKey === 'asistencias') {
                                rows = rows.map(normalizarRegistroAsistente);
                            }

                            if (modoImportacion === 'reemplazar') {
                                if (window.dbLocal && window.dbLocal.raw && window.dbLocal.raw.guardarTablaAsync) {
                                    await window.dbLocal.raw.guardarTablaAsync(targetKey, rows);
                                } else if (window.dbLocal && window.dbLocal.raw) {
                                    window.dbLocal.raw.escribirTabla(targetKey, rows);
                                }
                                if (targetKey === 'dotacion') {
                                    registrarFechaDotacion(rows.length);
                                }
                                totalImportados += rows.length;
                            } else {
                                if (rows.length > 0) {
                                    let pk = 'id';
                                    if (targetKey === 'dotacion') {
                                        pk = 'legajo';
                                        registrarFechaDotacion(rows.length);
                                    }
                                    else if (targetKey === 'capacitaciones') pk = 'id_cap';
                                    else if (targetKey === 'transferencias') pk = 'id_tra';
                                    else if (targetKey === 'cursos') pk = 'codigo_curso';
                                    else if (targetKey === 'programas') pk = 'codigo_programa';
                                    else if (targetKey === 'instructores') pk = 'codigo_instructor';
                                    else if (targetKey === 'proveedores') pk = 'codigo_proveedor';
                                    else if (targetKey === 'certificaciones_externas') pk = 'id';
                                    else if (targetKey === 'profiles') pk = 'usuario';

                                    await db.from(targetKey).upsert(rows, { onConflict: pk });
                                    totalImportados += rows.length;
                                }
                            }
                        }
                    }
                    try {
                        localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
                        localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
                        window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { accion: 'importacion_backup_excel' } }));
                    } catch (e) {}
                    const acc = modoImportacion === 'reemplazar' ? 'reemplazado / sobreescrito' : 'fusionado';
                    estadoBase.value = `¡Backup multi-hoja procesado! (${totalImportados} registros en ${tablasProcesadas} tablas)`;
                    alert(`¡Éxito! Se ha ${acc} el contenido de ${tablasProcesadas} tablas con ${totalImportados} registros totales.`);
                    return;
                }

                // Archivo de una sola hoja
                const hoja = libro.Sheets[libro.SheetNames[0]];
                tablaFinal = detectarTablaDestino(libro.SheetNames[0] + ' ' + nombreArchivo, null, tablaDestino);
                if (tablaFinal === "dotacion") {
                    registros = extraerFilasDotacion(hoja);
                } else {
                    registros = XLSX.utils.sheet_to_json(hoja) || [];
                }
                if (tablaFinal === "capacitaciones") {
                    registros = registros.map(normalizarRegistroCapacitacion);
                } else if (tablaFinal === "asistentes" || tablaFinal === "asistencias") {
                    registros = registros.map(normalizarRegistroAsistente);
                } else if (tablaFinal === "dotacion") {
                    registros = normalizarRegistrosDotacion(registros);
                }
            }

            // DETERMINAR TABLA DE DESTINO REAL (EVITA GUARDAR EN 'TODAS')
            let tablaAGuardar = (tablaFinal && tablaFinal !== 'TODAS') ? tablaFinal : detectarTablaDestino(nombreArchivo, registros, tablaDestino);
            if (!tablaAGuardar || tablaAGuardar === 'TODAS') {
                tablaAGuardar = 'dotacion';
            }

            // APLICAR MODO DE IMPORTACIÓN EN TABLA INDIVIDUAL
            if (modoImportacion === 'reemplazar') {
                if (window.dbLocal && window.dbLocal.raw && window.dbLocal.raw.guardarTablaAsync) {
                    await window.dbLocal.raw.guardarTablaAsync(tablaAGuardar, registros);
                } else if (window.dbLocal && window.dbLocal.raw) {
                    window.dbLocal.raw.escribirTabla(tablaAGuardar, registros);
                }
                if (tablaAGuardar === 'dotacion') {
                    registrarFechaDotacion(registros.length);
                }
                try {
                    localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
                    localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
                    window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { tabla: tablaAGuardar } }));
                } catch (e) {}
                estadoBase.value = `¡Base '${tablaAGuardar}' reemplazada con éxito (${registros.length} registros)!`;
                alert(`¡Éxito! La base de '${tablaAGuardar}' fue reemplazada completamente. Quedó con ${registros.length} registros.`);
                return;
            }

            // Modo Fusionar / Upsert
            if (!registros || registros.length === 0) {
                estadoBase.value = "Sin registros nuevos para fusionar";
                alert("No se encontraron registros en el archivo para fusionar.");
                return;
            }

            let columnaPK = 'id';
            if (tablaAGuardar === 'dotacion') columnaPK = 'legajo';
            else if (tablaAGuardar === 'cursos') columnaPK = 'codigo_curso';
            else if (tablaAGuardar === 'programas') columnaPK = 'codigo_programa';
            else if (tablaAGuardar === 'instructores') columnaPK = 'codigo_instructor';
            else if (tablaAGuardar === 'proveedores') columnaPK = 'codigo_proveedor';
            else if (tablaAGuardar === 'capacitaciones') columnaPK = 'id_cap';
            else if (tablaAGuardar === 'transferencias') columnaPK = 'id_tra';
            else if (tablaAGuardar === 'encuestas_transferencia' || tablaAGuardar === 'encuestas_transferencias') columnaPK = 'id';
            else if (tablaAGuardar === 'evaluaciones_satisfaccion' || tablaAGuardar === 'evaluaciones') columnaPK = 'id';
            else if (tablaAGuardar === 'certificaciones_externas') columnaPK = 'id';
            else if (tablaAGuardar === 'profiles' || tablaAGuardar === 'usuarios') columnaPK = 'usuario';

            estadoBase.value = `Guardando ${registros.length} registros en '${tablaAGuardar}'...`;
            const { error } = await db.from(tablaAGuardar).upsert(registros, { onConflict: columnaPK });
            if (error) throw error;

            if (tablaAGuardar === 'dotacion') {
                registrarFechaDotacion(registros.length);
            }
            try {
                localStorage.setItem('SIGA_SISTEMA_INICIALIZADO', 'true');
                localStorage.setItem('SIGA_USUARIO_DATOS_IMPORTADOS', 'true');
                window.dispatchEvent(new CustomEvent('siga_data_updated', { detail: { tabla: tablaAGuardar } }));
            } catch (e) {}

            estadoBase.value = `¡Éxito! ${registros.length} registros fusionados en '${tablaAGuardar}'.`;
            alert(`¡Éxito! Se fusionaron/actualizaron ${registros.length} registros en la base de '${tablaAGuardar}'.`);

        } catch (error) {
            console.error("Error al procesar archivo:", error);
            estadoBase.value = "Error al procesar archivo";
            alert("Ocurrió un error al procesar el archivo: " + (error.message || error));
        }
    };

    lector.readAsArrayBuffer(archivoSeleccionado);
}

//======================================================
// UTILIDADES PARA PARSEO Y NORMALIZACIÓN ROBUSTA (CSV, EXCEL, JSON)
//======================================================

function decodificarTextoArchivo(bufferOTexto) {
    if (typeof bufferOTexto === 'string') return bufferOTexto;
    const uint8 = new Uint8Array(bufferOTexto);
    try {
        const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });
        return decoderUTF8.decode(uint8);
    } catch (e) {
        try {
            const decoderWin = new TextDecoder('windows-1252');
            return decoderWin.decode(uint8);
        } catch (e2) {
            return new TextDecoder().decode(uint8);
        }
    }
}

function parsearCSVPlano(textoCSV) {
    if (!textoCSV || typeof textoCSV !== 'string') return [];
    if (textoCSV.charCodeAt(0) === 0xFEFF) {
        textoCSV = textoCSV.slice(1);
    }
    const lineas = textoCSV.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lineas.length === 0) return [];

    const primeraLinea = lineas[0];
    const cuentaPuntoComa = (primeraLinea.match(/;/g) || []).length;
    const cuentaComa = (primeraLinea.match(/,/g) || []).length;
    const cuentaTab = (primeraLinea.match(/\t/g) || []).length;

    let delimitador = ';';
    if (cuentaTab > cuentaPuntoComa && cuentaTab > cuentaComa) delimitador = '\t';
    else if (cuentaComa > cuentaPuntoComa) delimitador = ',';

    function parsearLinea(linea) {
        const valores = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < linea.length; i++) {
            const char = linea[i];
            if (char === '"') {
                if (inQuotes && linea[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimitador && !inQuotes) {
                valores.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        valores.push(cur.trim());
        return valores;
    }

    const encabezados = parsearLinea(lineas[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
    const filas = [];

    for (let i = 1; i < lineas.length; i++) {
        const l = lineas[i];
        if (!l.trim()) continue;
        const valores = parsearLinea(l);
        const obj = {};
        let tieneDatos = false;
        encabezados.forEach((enc, idx) => {
            if (enc) {
                const rawVal = valores[idx] !== undefined ? valores[idx].replace(/^["']|["']$/g, '').trim() : '';
                obj[enc] = rawVal;
                const encKey = enc.toLowerCase().replace(/\s+/g, '_');
                if (!obj.hasOwnProperty(encKey)) {
                    obj[encKey] = rawVal;
                }
                if (rawVal !== '') tieneDatos = true;
            }
        });
        if (tieneDatos) filas.push(obj);
    }
    return filas;
}

function detectarTablaDestino(nombreArchivo, registros, tablaSeleccionada) {
    if (tablaSeleccionada && tablaSeleccionada !== 'TODAS') {
        return tablaSeleccionada;
    }
    const name = (nombreArchivo || '').toLowerCase();
    if (name.includes('dotacion') || name.includes('emplead') || name.includes('personal') || name.includes('nomina')) return 'dotacion';
    if (name.includes('capacitac') || name.includes('taller') || name.includes('actividad')) return 'capacitaciones';
    if (name.includes('asistent') || name.includes('asistenc') || name.includes('participan')) return 'asistentes';
    if (name.includes('curso')) return 'cursos';
    if (name.includes('programa')) return 'programas';
    if (name.includes('instructor')) return 'instructores';
    if (name.includes('proveedor') || name.includes('ente')) return 'proveedores';
    if (name.includes('certifica') || name.includes('calificac')) return 'certificaciones_externas';
    if (name.includes('satisfaccion') || name.includes('evalua')) return 'evaluaciones_satisfaccion';
    if (name.includes('transferencia')) return 'transferencias';
    if (name.includes('usuario') || name.includes('perfil') || name.includes('profile')) return 'profiles';

    if (Array.isArray(registros) && registros.length > 0) {
        const primer = registros[0];
        const keys = Object.keys(primer).map(k => k.toLowerCase().trim());
        const tiene = (col) => keys.some(k => k === col || k.includes(col));

        if (tiene('id_cap') && (tiene('dni') || tiene('legajo') || tiene('apellido') || tiene('asistenc') || tiene('presente'))) {
            return 'asistentes';
        }
        if (tiene('id_cap') || (tiene('curso') && (tiene('fecha') || tiene('duracion') || tiene('instructor') || tiene('horas')))) {
            return 'capacitaciones';
        }
        if (tiene('legajo') && (tiene('gerencia') || tiene('direccion') || tiene('categoria') || tiene('puesto') || tiene('jefatura'))) {
            return 'dotacion';
        }
        if (tiene('codigo_curso') || (tiene('nombre_curso') && tiene('modalidad'))) {
            return 'cursos';
        }
        if (tiene('codigo_programa') || tiene('nombre_programa')) {
            return 'programas';
        }
        if (tiene('vencimiento') || tiene('alcance') || (tiene('codigo') && tiene('subcategoria'))) {
            return 'certificaciones_externas';
        }
    }

    return 'dotacion';
}

function normalizarRegistroCapacitacion(c) {
    if (!c || typeof c !== 'object') return c;
    const norm = { ...c };
    const idCap = c.id_cap !== undefined ? c.id_cap :
                 (c.ID_CAP !== undefined ? c.ID_CAP :
                 (c.id !== undefined ? c.id :
                 (c.ID !== undefined ? c.ID :
                 (c.codigo !== undefined ? c.codigo :
                 (c.CODIGO !== undefined ? c.CODIGO :
                 (c.id_capacitacion !== undefined ? c.id_capacitacion :
                 (c.ID_CAPACITACION !== undefined ? c.ID_CAPACITACION : '')))))));
    norm.id_cap = String(idCap || '').trim();
    norm.ID_CAP = norm.id_cap;

    const curso = c.curso || c.CURSO || c.nombre_curso || c.NOMBRE_CURSO || c.nombre || c.NOMBRE || '';
    norm.curso = String(curso).trim();
    norm.nombre_curso = norm.curso;

    const programa = c.programa || c.PROGRAMA || c.nombre_programa || c.NOMBRE_PROGRAMA || '';
    norm.programa = String(programa).trim();

    const fecha = c.fecha || c.FECHA || c.fecha_curso || c.FECHA_CURSO || c.created_at || '';
    norm.fecha = String(fecha).trim();

    const dur = c.duracion_hs !== undefined ? c.duracion_hs :
                 (c.DURACION_HS !== undefined ? c.DURACION_HS :
                 (c.duracion !== undefined ? c.duracion :
                 (c.DURACION !== undefined ? c.DURACION :
                 (c.horas !== undefined ? c.horas :
                 (c.HORAS !== undefined ? c.HORAS :
                 (c.carga_horaria !== undefined ? c.carga_horaria : 0))))));
    norm.duracion_hs = parseFloat(String(dur).replace(',', '.')) || 0;
    norm.duracion = norm.duracion_hs;
    norm.horas = norm.duracion_hs;

    const modalidad = c.modalidad || c.MODALIDAD || c.tipo || c.TIPO || 'Presencial';
    norm.modalidad = String(modalidad).trim();

    const instructor = c.instructor || c.INSTRUCTOR || c.docente || c.DOCENTE || '';
    norm.instructor = String(instructor).trim();

    const centro = c.centro || c.CENTRO || c.centro_costos || c.CENTRO_COSTOS || '';
    norm.centro = String(centro).trim();

    const lugar = c.lugar || c.LUGAR || c.ubicacion || c.UBICACION || '';
    norm.lugar = String(lugar).trim();

    const origen = c.origen || c.ORIGEN || c.tipo_origen || 'Interno';
    norm.origen = String(origen).trim();

    return norm;
}

function normalizarRegistrosDotacion(filas) {
    if (!Array.isArray(filas)) return [];
    return filas.map(r => {
        if (!r || typeof r !== 'object') return r;
        const legajoRaw = r.legajo !== undefined ? r.legajo : (r.LEGAJO !== undefined ? r.LEGAJO : (r.Legajo !== undefined ? r.Legajo : (r.id !== undefined ? r.id : '')));
        const legajoFormateado = legajoRaw ? String(legajoRaw).trim().padStart(5, '0') : '';
        const apellido = r.apellido || r.APELLIDO || r.Apellido || '';
        const nombre = r.nombre || r.NOMBRE || r.Nombre || '';
        const puesto = r.puesto || r.PUESTO || r.Puesto || r.cargo || '';
        const categoria = r.categoria || r.CATEGORIA || r.Categoria || '';
        const direccion = r.direccion || r.DIRECCION || r.Direccion || '';
        const gerencia = r.gerencia || r.GERENCIA || r.Gerencia || '';
        const coordinacion = r.coordinacion || r.COORDINACION || r.Coordinacion || '';
        const jefatura = r.jefatura || r.JEFATURA || r.Jefatura || '';
        const manager = r.manager || r.MANAGER || r.Manager || '';
        const email = r.email || r.EMAIL || r.Email || '';

        return {
            ...r,
            legajo: legajoFormateado,
            LEGAJO: legajoFormateado,
            apellido: String(apellido).trim(),
            nombre: String(nombre).trim(),
            puesto: String(puesto).trim(),
            categoria: String(categoria).trim(),
            direccion: String(direccion).trim(),
            gerencia: String(gerencia).trim(),
            coordinacion: String(coordinacion).trim(),
            jefatura: String(jefatura).trim(),
            manager: String(manager).trim(),
            email: String(email).trim()
        };
    });
}

function normalizarRegistroAsistente(r) {
    if (!r || typeof r !== 'object') return r;
    const norm = { ...r };
    const idCap = r.id_cap !== undefined ? r.id_cap :
                 (r.ID_CAP !== undefined ? r.ID_CAP :
                 (r.id_capacitacion !== undefined ? r.id_capacitacion :
                 (r.ID_CAPACITACION !== undefined ? r.ID_CAPACITACION :
                 (r.id !== undefined ? r.id : ''))));
    const legajo = r.legajo !== undefined ? r.legajo :
                  (r.LEGAJO !== undefined ? r.LEGAJO :
                  (r.Legajo !== undefined ? r.Legajo :
                  (r.dni !== undefined ? r.dni :
                  (r.DNI !== undefined ? r.DNI :
                  (r.empleado_id !== undefined ? r.empleado_id : '')))));
    norm.id_cap = String(idCap || '').trim();
    norm.ID_CAP = norm.id_cap;
    norm.legajo = legajo !== null && legajo !== undefined ? String(legajo).trim() : '';
    norm.LEGAJO = norm.legajo;

    let apellido = r.apellido !== undefined ? r.apellido : (r.APELLIDO || '');
    let nombre = r.nombre !== undefined ? r.nombre : (r.NOMBRE || '');
    const apeNom = r.apellido_nombre || r.APELLIDO_NOMBRE || r.nombre_completo || r.NOMBRE_COMPLETO || '';

    if ((!apellido || !nombre) && apeNom) {
        if (apeNom.includes(',')) {
            const pts = apeNom.split(',');
            apellido = pts[0].trim();
            nombre = pts[1].trim();
        } else {
            nombre = apeNom.trim();
        }
    }
    norm.apellido = String(apellido).trim();
    norm.nombre = String(nombre).trim();
    norm.apellido_nombre = (norm.apellido && norm.nombre) ? `${norm.apellido}, ${norm.nombre}` : (norm.apellido || norm.nombre || apeNom);

    norm.puesto = String(r.puesto !== undefined ? r.puesto : (r.PUESTO || r.cargo || '')).trim();
    norm.categoria = String(r.categoria !== undefined ? r.categoria : (r.CATEGORIA || '')).trim();
    norm.direccion = String(r.direccion !== undefined ? r.direccion : (r.DIRECCION || '')).trim();
    norm.gerencia = String(r.gerencia !== undefined ? r.gerencia : (r.GERENCIA || '')).trim();
    norm.coordinacion = String(r.coordinacion !== undefined ? r.coordinacion : (r.COORDINACION || '')).trim();
    norm.jefatura = String(r.jefatura !== undefined ? r.jefatura : (r.JEFATURA || '')).trim();
    norm.manager = String(r.manager !== undefined ? r.manager : (r.MANAGER || '')).trim();
    norm.email = String(r.email !== undefined ? r.email : (r.EMAIL || '')).trim();

    norm.asistencia = String(r.asistencia !== undefined ? r.asistencia : (r.ASISTENCIA || r.estado || r.ESTADO || 'Presente')).trim();
    norm.calificacion = r.calificacion !== undefined ? r.calificacion : (r.CALIFICACION || '-');
    norm.observaciones = r.observaciones !== undefined ? r.observaciones : (r.OBSERVACIONES || '-');

    const hs = r.horas_capacitacion !== undefined ? r.horas_capacitacion :
              (r.HORAS_CAPACITACION !== undefined ? r.HORAS_CAPACITACION :
              (r.horas !== undefined ? r.horas :
              (r.HORAS !== undefined ? r.HORAS : null)));
    if (hs !== null && hs !== undefined) {
        norm.horas_capacitacion = parseFloat(String(hs).replace(',', '.')) || 0;
    }
    return norm;
}

function sanitizarFilasParaExportacion(filas, nombreTabla = '') {
    if (!Array.isArray(filas)) return [];
    const tLower = (nombreTabla || '').trim().toLowerCase();

    // Detección estricta de Asistencias vs Dotación
    const primerItem = filas.length > 0 && filas[0] && typeof filas[0] === 'object' ? filas[0] : {};
    const tieneIdCap = ('id_cap' in primerItem) || ('ID_CAP' in primerItem) || ('id_capacitacion' in primerItem) || ('ID_CAPACITACION' in primerItem);
    
    const esAsistentes = tLower === 'asistentes' || tLower === 'asistencias' || (!tLower && tieneIdCap);
    const esDotacion = !esAsistentes && (tLower === 'dotacion' || tLower === 'dotacion_personal' || (!tLower && (('legajo' in primerItem) || ('Legajo' in primerItem)) && (('puesto' in primerItem) || ('Puesto' in primerItem))));

    // Columnas oficiales de Dotación (11 columnas)
    const columnasOficialesDotacion = [
        'legajo', 'apellido', 'nombre', 'puesto', 'categoria', 
        'direccion', 'gerencia', 'coordinacion', 'jefatura', 'manager', 'email'
    ];

    // Columnas ordenadas para Asistentes: Primera columna siempre ID_CAP (ID de Capacitación)
    const columnasOrdenAsistentes = [
        'legajo', 'apellido', 'nombre', 'puesto', 'categoria', 
        'direccion', 'gerencia', 'coordinacion', 'jefatura', 'manager', 'email',
        'calificacion', 'observaciones'
    ];

    return filas.map(item => {
        if (!item || typeof item !== 'object') return {};

        // CASO 1: ASISTENCIAS - LA PRIMERA COLUMNA ES ID_CAP
        if (esAsistentes) {
            const filaLimpia = {};
            const idCapVal = item.id_cap !== undefined ? item.id_cap : 
                (item.ID_CAP !== undefined ? item.ID_CAP : 
                (item.id_capacitacion !== undefined ? item.id_capacitacion : 
                (item.ID_CAPACITACION !== undefined ? item.ID_CAPACITACION : '')));
            
            filaLimpia['ID_CAP'] = idCapVal !== null && idCapVal !== undefined ? idCapVal : '';

            columnasOrdenAsistentes.forEach(col => {
                let val = item[col];
                if (val === undefined || val === null) {
                    const colCapital = col.charAt(0).toUpperCase() + col.slice(1);
                    val = item[colCapital] !== undefined ? item[colCapital] : (item[col.toUpperCase()] !== undefined ? item[col.toUpperCase()] : '');
                }
                if (typeof val === 'object' && val !== null) {
                    try { val = JSON.stringify(val); } catch (e) { val = ''; }
                }
                filaLimpia[col.toUpperCase()] = val !== null && val !== undefined ? val : '';
            });

            // Conservar cualquier otro campo extra sin perder datos
            Object.keys(item).forEach(k => {
                const kLower = k.toLowerCase();
                if (!['id_cap', 'id_capacitacion', ...columnasOrdenAsistentes, 'datos_completos'].includes(kLower)) {
                    let val = item[k];
                    if (typeof val === 'object' && val !== null) {
                        try { val = JSON.stringify(val); } catch (e) { val = ''; }
                    }
                    filaLimpia[k.toUpperCase()] = val !== null && val !== undefined ? val : '';
                }
            });

            return filaLimpia;
        }

        // CASO 2: DOTACIÓN DE PERSONAL
        if (esDotacion) {
            const filaLimpia = {};
            columnasOficialesDotacion.forEach(col => {
                let val = item[col];
                if (val === undefined || val === null) {
                    const colCapital = col.charAt(0).toUpperCase() + col.slice(1);
                    val = item[colCapital] !== undefined ? item[colCapital] : (item[col.toUpperCase()] !== undefined ? item[col.toUpperCase()] : '');
                }
                if (typeof val === 'object' && val !== null) {
                    try { val = JSON.stringify(val); } catch (e) { val = ''; }
                }
                filaLimpia[col.toUpperCase()] = val !== null && val !== undefined ? val : '';
            });
            return filaLimpia;
        }

        // CASO 3: DEMÁS TABLAS (Cursos, Programas, Proveedores, etc.)
        const limpio = {};
        Object.keys(item).forEach(key => {
            if (key === 'datos_completos') return; // Omitir dumps internos pesados
            const val = item[key];
            if (val === null || val === undefined) {
                limpio[key] = '';
            } else if (typeof val === 'object') {
                try {
                    limpio[key] = JSON.stringify(val);
                } catch (e) {
                    limpio[key] = '';
                }
            } else {
                limpio[key] = val;
            }
        });
        return limpio;
    });
}

function descargarBlobSeguro(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);
}

// Convertir array de objetos a texto CSV con delimitador ';' y codificación UTF-8
function convertirArrayACSV(filas) {
    if (!Array.isArray(filas) || filas.length === 0) return '';
    const columnas = Object.keys(filas[0]);
    const encabezado = columnas.join(';');
    const lineas = filas.map(fila => {
        return columnas.map(col => {
            let val = fila[col];
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            if (val.includes(';') || val.includes('\n') || val.includes('"')) {
                val = `"${val}"`;
            }
            return val;
        }).join(';');
    });
    return [encabezado, ...lineas].join('\r\n');
}

//======================================================
// EXPORTAR BASES DE DATOS A EXCEL (.XLSX)
//======================================================

async function exportarBaseExcel() {
    const selector = document.getElementById('selectTablaExportar');
    const estado = document.getElementById('estadoExportacion');
    const opcion = selector ? selector.value : 'TODAS';

    if (typeof XLSX === 'undefined') {
        alert('La librería para generar Excel no está disponible.');
        return;
    }

    if (estado) estado.value = 'Generando backup Excel seguro...';

    try {
        const db = obtenerClienteDB();
        const libro = XLSX.utils.book_new();
        const fechaActual = new Date().toISOString().split('T')[0];

        if (opcion === 'TODAS') {
            // Backup Completo de las 12 tablas
            const [dot, cap, asis, cur, inst, prog, prov, evalSat, trans, encTrans, certExt, prof] = await Promise.all([
                db.from('dotacion').select('*'),
                db.from('capacitaciones').select('*'),
                db.from('asistentes').select('*'),
                db.from('cursos').select('*'),
                db.from('instructores').select('*'),
                db.from('programas').select('*'),
                db.from('proveedores').select('*'),
                db.from('evaluaciones_satisfaccion').select('*'),
                db.from('transferencias').select('*'),
                db.from('encuestas_transferencia').select('*'),
                db.from('certificaciones_externas').select('*'),
                db.from('profiles').select('*')
            ]);

            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(dot.data || [], 'dotacion')), 'Dotacion_Personal');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(cap.data || [], 'capacitaciones')), 'Capacitaciones');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(asis.data || [], 'asistentes')), 'Asistencias');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(cur.data || [], 'cursos')), 'Cursos');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(inst.data || [], 'instructores')), 'Instructores');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(prog.data || [], 'programas')), 'Programas');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(prov.data || [], 'proveedores')), 'Proveedores');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(evalSat.data || [], 'evaluaciones_satisfaccion')), 'Evaluaciones_Satisfaccion');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(trans.data || [], 'transferencias')), 'Transferencias');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(encTrans.data || [], 'encuestas_transferencia')), 'Encuestas_Transferencia');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(certExt.data || [], 'certificaciones_externas')), 'Certificaciones_Externas');
            XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(sanitizarFilasParaExportacion(prof.data || [], 'profiles')), 'Usuarios_Permisos');

            // Generar buffer limpio sin scripts ni macros
            const arrayBuffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array', Props: { Title: 'SIGA Backup', Author: 'SIGA Sistema' } });
            const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            descargarBlobSeguro(blob, `SIGA_Backup_Total_${fechaActual}.xlsx`);
            if (estado) estado.value = '¡Backup Excel descargado con éxito!';

        } else {
            // Exportación individual
            const { data, error } = await db.from(opcion).select('*');
            if (error) throw error;

            if (!data || data.length === 0) {
                if (estado) estado.value = 'La tabla no contiene datos.';
                alert(`La tabla '${opcion}' no tiene registros para exportar.`);
                return;
            }

            const filasExport = sanitizarFilasParaExportacion(data, opcion);
            const hoja = XLSX.utils.json_to_sheet(filasExport);
            XLSX.utils.book_append_sheet(libro, hoja, opcion);

            const arrayBuffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array', Props: { Title: `SIGA ${opcion}`, Author: 'SIGA Sistema' } });
            const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            descargarBlobSeguro(blob, `SIGA_Export_${opcion}_${fechaActual}.xlsx`);
            if (estado) estado.value = `¡Tabla '${opcion}' exportada a Excel con éxito!`;
        }

    } catch (error) {
        console.error('Error al exportar Excel:', error);
        if (estado) estado.value = 'Error durante la exportación Excel';
        alert('Ocurrió un error al exportar los datos: ' + (error.message || error));
    }
}
window.exportarBaseExcel = exportarBaseExcel;

//======================================================
// EXPORTAR BASES DE DATOS A CSV (.CSV - NUNCA BLOQUEADO POR ANTIVIRUS)
//======================================================
async function exportarBaseCSV() {
    const selector = document.getElementById('selectTablaExportar');
    const estado = document.getElementById('estadoExportacion');
    const opcion = selector ? selector.value : 'TODAS';

    if (estado) estado.value = 'Generando archivo CSV...';

    try {
        const db = obtenerClienteDB();
        const fechaActual = new Date().toISOString().split('T')[0];

        if (opcion === 'TODAS') {
            const tablas = ['dotacion', 'capacitaciones', 'asistentes', 'cursos', 'programas', 'instructores', 'proveedores', 'evaluaciones_satisfaccion', 'transferencias', 'encuestas_transferencia', 'certificaciones_externas', 'profiles'];
            let csvCompleto = '';

            for (const t of tablas) {
                const { data } = await db.from(t).select('*');
                const filas = sanitizarFilasParaExportacion(data || [], t);
                if (filas.length > 0) {
                    csvCompleto += `=== TABLA: ${t.toUpperCase()} ===\r\n`;
                    csvCompleto += convertirArrayACSV(filas) + '\r\n\r\n';
                }
            }

            const blob = new Blob(['\uFEFF' + csvCompleto], { type: 'text/csv;charset=utf-8;' });
            descargarBlobSeguro(blob, `SIGA_Backup_Total_${fechaActual}.csv`);
            if (estado) estado.value = '¡Backup CSV descargado con éxito!';

        } else {
            const { data, error } = await db.from(opcion).select('*');
            if (error) throw error;

            if (!data || data.length === 0) {
                if (estado) estado.value = 'La tabla no contiene datos.';
                alert(`La tabla '${opcion}' no tiene registros para exportar.`);
                return;
            }

            const filas = sanitizarFilasParaExportacion(data, opcion);
            const csvStr = convertirArrayACSV(filas);
            const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
            descargarBlobSeguro(blob, `SIGA_Export_${opcion}_${fechaActual}.csv`);
            if (estado) estado.value = `¡Tabla '${opcion}' exportada a CSV con éxito!`;
        }

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        if (estado) estado.value = 'Error durante la exportación CSV';
        alert('Ocurrió un error al exportar los datos: ' + (error.message || error));
    }
}
window.exportarBaseCSV = exportarBaseCSV;

//======================================================
// EXPORTAR BASES DE DATOS A JSON (.JSON)
//======================================================
async function exportarBaseJSON() {
    const selector = document.getElementById('selectTablaExportar');
    const estado = document.getElementById('estadoExportacion');
    const opcion = selector ? selector.value : 'TODAS';

    if (estado) estado.value = 'Generando backup JSON...';

    try {
        const db = obtenerClienteDB();
        const fechaActual = new Date().toISOString().split('T')[0];

        if (opcion === 'TODAS') {
            const tablas = ['dotacion', 'capacitaciones', 'asistentes', 'cursos', 'programas', 'instructores', 'proveedores', 'evaluaciones_satisfaccion', 'transferencias', 'encuestas_transferencia', 'certificaciones_externas', 'profiles'];
            const backupTotal = { fecha: new Date().toISOString(), version: 'SIGA_V2', tablas: {} };

            for (const t of tablas) {
                const { data } = await db.from(t).select('*');
                backupTotal.tablas[t] = sanitizarFilasParaExportacion(data || [], t);
            }

            const jsonStr = JSON.stringify(backupTotal, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
            descargarBlobSeguro(blob, `SIGA_Backup_Total_${fechaActual}.json`);

            if (estado) estado.value = '¡Backup JSON completo descargado con éxito!';
        } else {
            const { data, error } = await db.from(opcion).select('*');
            if (error) throw error;

            const filas = sanitizarFilasParaExportacion(data || [], opcion);
            const jsonStr = JSON.stringify(filas, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
            descargarBlobSeguro(blob, `SIGA_Export_${opcion}_${fechaActual}.json`);

            if (estado) estado.value = `¡Tabla '${opcion}' exportada a JSON con éxito!`;
        }
    } catch (error) {
        console.error('Error al exportar JSON:', error);
        if (estado) estado.value = 'Error durante la exportación JSON';
        alert('Ocurrió un error al exportar los datos: ' + (error.message || error));
    }
}
window.exportarBaseJSON = exportarBaseJSON;

//======================================================
// SINCRONIZACIÓN DIRECTA DESDE ARCHIVOS JSON EN /data/
//======================================================
async function sincronizarDesdeCarpetaData() {
    const estado = document.getElementById("estadoBase");
    if (estado) estado.value = "Leyendo archivos JSON de la carpeta /data/...";

    const TABLAS_DATA = [
        { archivo: 'dotacion.json', tabla: 'dotacion', pk: 'legajo' },
        { archivo: 'capacitaciones.json', tabla: 'capacitaciones', pk: 'id_cap' },
        { archivo: 'asistentes.json', tabla: 'asistentes', pk: 'id' },
        { archivo: 'cursos.json', tabla: 'cursos', pk: 'codigo_curso' },
        { archivo: 'programas.json', tabla: 'programas', pk: 'codigo_programa' },
        { archivo: 'instructores.json', tabla: 'instructores', pk: 'codigo_instructor' },
        { archivo: 'proveedores.json', tabla: 'proveedores', pk: 'codigo_proveedor' },
        { archivo: 'evaluaciones_satisfaccion.json', tabla: 'evaluaciones_satisfaccion', pk: 'id' },
        { archivo: 'transferencias.json', tabla: 'transferencias', pk: 'id_tra' },
        { archivo: 'encuestas_transferencia.json', tabla: 'encuestas_transferencia', pk: 'id' },
        { archivo: 'certificaciones_externas.json', tabla: 'certificaciones_externas', pk: 'id' },
        { archivo: 'profiles.json', tabla: 'profiles', pk: 'usuario' }
    ];

    let tablasCargadas = 0;
    let totalRegistros = 0;
    const db = obtenerClienteDB();

    for (const item of TABLAS_DATA) {
        try {
            const resp = await fetch(`data/${item.archivo}?v=${Date.now()}`);
            if (resp.ok) {
                const datos = await resp.json();
                if (Array.isArray(datos) && datos.length > 0) {
                    if (db) {
                        await db.from(item.tabla).upsert(datos, { onConflict: item.pk });
                    } else {
                        localStorage.setItem('SIGA_DB_' + item.tabla, JSON.stringify(datos));
                    }
                    if (item.tabla === 'dotacion') {
                        registrarFechaDotacion(datos.length);
                    }
                    tablasCargadas++;
                    totalRegistros += datos.length;
                }
            }
        } catch (e) {
            console.warn(`No se pudo leer data/${item.archivo}:`, e);
        }
    }

    if (tablasCargadas > 0) {
        if (estado) estado.value = `¡Sincronizado! ${tablasCargadas} tablas cargadas (${totalRegistros} registros).`;
        alert(`¡Sincronización exitosa!\n\nSe cargaron ${tablasCargadas} tablas locales con un total de ${totalRegistros} registros desde la carpeta /data/.`);
    } else {
        if (estado) estado.value = "Los archivos de /data/ están vacíos o no disponibles.";
        alert("Atención: Los archivos en la carpeta /data/ están vacíos o no se pudieron leer. Podés reemplazar los archivos .json en /data/ y volver a presionar el botón.");
    }
}
window.sincronizarDesdeCarpetaData = sincronizarDesdeCarpetaData;

//======================================================
// VACIAR / REINICIAR BASES DE DATOS A 0 REGISTROS
//======================================================
async function vaciarBaseDeDatos() {
    const selectBase = document.getElementById("baseDatos");
    const tablaDestino = selectBase ? selectBase.value : "TODAS";
    const estado = document.getElementById("estadoBase");
    
    let mensaje = "";
    if (tablaDestino === "TODAS") {
        mensaje = "⚠️ ATENCIÓN: ¿Estás seguro de que deseas VACIAR TODAS LAS 10 TABLAS del sistema?\n\nEsta acción borrará todas las capacitaciones, dotación, asistencias, cursos, etc., para reiniciar completamente de 0.";
    } else {
        mensaje = `⚠️ ¿Estás seguro de que deseas vaciar todos los registros de la tabla '${tablaDestino}'?`;
    }

    if (!confirm(mensaje)) return;
    if (!confirm("⚠️ Confirmación final: Esta operación no se puede deshacer a menos que tengas un backup. ¿Proceder a vaciar los datos?")) return;

    if (window.dbLocal && window.dbLocal.raw) {
        if (tablaDestino === "TODAS") {
            window.dbLocal.raw.vaciarTodasLasTablas();
            localStorage.removeItem('fechaUltimaDotacion');
            if (typeof window.actualizarFechaDotacionUI === 'function') window.actualizarFechaDotacionUI();
            if (estado) estado.value = "¡Todas las bases han sido vaciadas (0 registros)!";
            alert("✅ Todas las tablas han sido vaciadas exitosamente. El sistema está en 0 registros.");
        } else {
            window.dbLocal.raw.vaciarTabla(tablaDestino);
            if (tablaDestino === 'dotacion') {
                localStorage.removeItem('fechaUltimaDotacion');
                if (typeof window.actualizarFechaDotacionUI === 'function') window.actualizarFechaDotacionUI();
            }
            if (estado) estado.value = `¡Tabla '${tablaDestino}' vaciada (0 registros)!`;
            alert(`✅ La tabla '${tablaDestino}' ha sido vaciada exitosamente.`);
        }
    }

    // Refrescar vistas si estamos en catálogos
    if (typeof cambiarCatalogo === 'function' && typeof catalogoActual !== 'undefined') {
        cambiarCatalogo(catalogoActual);
    }
}
window.vaciarBaseDeDatos = vaciarBaseDeDatos;

//======================================================
// GESTIÓN Y SINCRONIZACIÓN DE SUPABASE CLOUD (POSTGRESQL)
//======================================================
function inicializarPanelSupabaseUI() {
    const inputUrl = document.getElementById('inputSupabaseUrl');
    const inputKey = document.getElementById('inputSupabaseKey');
    const badge = document.getElementById('badgeEstadoSupabase');
    const btnGuardar = document.getElementById('btnGuardarSupabase');
    const btnSubir = document.getElementById('btnSubirTodoSupabase');
    const btnDescargar = document.getElementById('btnDescargarTodoSupabase');
    const btnScriptSQL = document.getElementById('btnDescargarScriptSQL');
    const contProgreso = document.getElementById('progresoSupabaseContenedor');
    const txtProgreso = document.getElementById('textoProgresoSupabase');
    const barProgreso = document.getElementById('barraProgresoSupabase');

    if (!inputUrl || !inputKey) return;

    // Cargar credenciales actuales
    inputUrl.value = window.SUPABASE_URL || '';
    inputKey.value = window.SUPABASE_KEY || '';

    // Verificar estado de conexión
    async function actualizarBadgeEstado() {
        if (!badge) return;
        badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Verificando conexión...';
        badge.style.background = '#d97706';

        if (typeof window.verificarConexionSupabase === 'function') {
            const ok = await window.verificarConexionSupabase();
            if (ok) {
                badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffffff;"></span> 🟢 Conectado a Supabase';
                badge.style.background = '#10b981';
            } else {
                badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffffff;"></span> 🟠 Modo Local (Offline)';
                badge.style.background = '#64748b';
            }
        }
    }
    actualizarBadgeEstado();

    // Evento: Guardar y Probar Conexión
    if (btnGuardar) {
        btnGuardar.addEventListener('click', async () => {
            const url = inputUrl.value.trim();
            const key = inputKey.value.trim();
            if (!url || !key) {
                alert("Por favor completá tanto la URL como la Anon Key de Supabase.");
                return;
            }

            btnGuardar.disabled = true;
            btnGuardar.textContent = "⏳ Verificando...";

            if (typeof window.guardarConfigSupabase === 'function') {
                window.guardarConfigSupabase(url, key);
            }

            const conectado = typeof window.verificarConexionSupabase === 'function' ? await window.verificarConexionSupabase() : false;
            await actualizarBadgeEstado();

            btnGuardar.disabled = false;
            btnGuardar.textContent = "💾 Guardar y Probar";

            if (conectado) {
                alert("✅ ¡Conexión con Supabase PostgreSQL establecida con éxito!");
            } else {
                alert("⚠️ Se guardaron las credenciales, pero no se pudo contactar con Supabase o las tablas aún no fueron creadas. Verificá que hayas ejecutado el script 'supabase_schema.sql' en el SQL Editor de tu proyecto Supabase.");
            }
        });
    }

    // Evento: Subir todo a Supabase
    if (btnSubir) {
        btnSubir.addEventListener('click', async () => {
            if (!confirm("¿Deseas sincronizar y subir todos los datos locales (dotación, capacitaciones, asistentes, etc.) a tu base de datos de Supabase Cloud?")) {
                return;
            }

            if (typeof window.sincronizarTodoASupabase !== 'function') {
                alert("El módulo de sincronización no está listo.");
                return;
            }

            if (contProgreso) contProgreso.style.display = 'block';
            btnSubir.disabled = true;

            try {
                const res = await window.sincronizarTodoASupabase((msg, pct) => {
                    if (txtProgreso) txtProgreso.textContent = msg;
                    if (barProgreso) barProgreso.style.width = pct + '%';
                });

                alert(`✅ ¡Sincronización completa! Se subieron ${res.totalRegistros} registros a Supabase Cloud.`);
                await actualizarBadgeEstado();
            } catch (err) {
                alert("❌ Error durante la sincronización: " + (err.message || err));
            } finally {
                btnSubir.disabled = false;
                setTimeout(() => {
                    if (contProgreso) contProgreso.style.display = 'none';
                }, 3000);
            }
        });
    }

    // Evento: Descargar todo de Supabase
    if (btnDescargar) {
        btnDescargar.addEventListener('click', async () => {
            if (!confirm("¿Deseas descargar los datos actuales de Supabase Cloud para actualizar tu almacenamiento local?")) {
                return;
            }

            if (typeof window.descargarTodoDeSupabase !== 'function') {
                alert("El módulo de descarga no está listo.");
                return;
            }

            if (contProgreso) contProgreso.style.display = 'block';
            btnDescargar.disabled = true;

            try {
                const res = await window.descargarTodoDeSupabase((msg, pct) => {
                    if (txtProgreso) txtProgreso.textContent = msg;
                    if (barProgreso) barProgreso.style.width = pct + '%';
                });

                alert(`✅ ¡Descarga completada con éxito! Se cargaron ${res.totalRegistros} registros en tu base local.`);
                if (typeof cambiarCatalogo === 'function' && typeof catalogoActual !== 'undefined') {
                    cambiarCatalogo(catalogoActual);
                }
            } catch (err) {
                alert("❌ Error al descargar datos de Supabase: " + (err.message || err));
            } finally {
                btnDescargar.disabled = false;
                setTimeout(() => {
                    if (contProgreso) contProgreso.style.display = 'none';
                }, 3000);
            }
        });
    }

    // Evento: Descargar Script SQL
    if (btnScriptSQL) {
        btnScriptSQL.addEventListener('click', async () => {
            try {
                const respuesta = await fetch('supabase_schema.sql');
                if (!respuesta.ok) throw new Error("No se pudo leer el archivo supabase_schema.sql");
                const sqlTexto = await respuesta.text();
                const blob = new Blob([sqlTexto], { type: 'text/sql;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'supabase_schema.sql';
                link.click();
            } catch (e) {
                alert("Ocurrió un error al descargar el script SQL: " + e.message);
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarPanelSupabaseUI);
} else {
    inicializarPanelSupabaseUI();
}


