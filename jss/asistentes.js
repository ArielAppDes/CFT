// ===================================================
// SIGA_APP - REGISTRO DE ASISTENTES
// ===================================================

let listaAsistentes = [];

document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPantallaAsistentes();
    configurarEventos();
});

function obtenerDB() {
    return window.supabaseClient || window.supabase || window.dbLocal || null;
}

// Función central para recuperar el ID_CAP actual sin importar el formato de origen
function obtenerIdCapActual(capData) {
    if (capData) {
        const idEncontrado = capData.id_cap || capData.idCap || capData.id;
        if (idEncontrado) return idEncontrado;
    }

    // Intento por selector en HTML
    const inputId = document.getElementById('resumenIdCap') || 
                    document.getElementById('idCap') || 
                    document.getElementById('idcap') || 
                    document.getElementById('id_cap') || 
                    document.querySelector("input[placeholder*='CAP']");
    if (inputId && inputId.value.trim()) return inputId.value.trim();

    // Intento por localStorage directo
    const capActivaRaw = localStorage.getItem("capacitacion_activa");
    if (capActivaRaw) {
        try {
            const parsed = JSON.parse(capActivaRaw);
            const idParsed = parsed.id_cap || parsed.idCap || parsed.id;
            if (idParsed) return idParsed;
        } catch (e) { console.error(e); }
    }

    return localStorage.getItem("id_cap_asistencia") || '';
}

// 1. CARGA DE CABECERA Y ASISTENTES
async function inicializarPantallaAsistentes() {
    const capActivaRaw = localStorage.getItem("capacitacion_activa");
    let capData = null;

    if (capActivaRaw) {
        try { capData = JSON.parse(capActivaRaw); } catch (e) { console.error(e); }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const idCapTarget = obtenerIdCapActual(capData) || urlParams.get('id_cap');

    // Consultar a la base local si falta información del curso
    const db = obtenerDB();
    if (db && idCapTarget && (!capData || !capData.nombre_curso)) {
        try {
            const { data } = await db
                .from('capacitaciones')
                .select('*')
                .eq('id_cap', idCapTarget);

            if (data && data.length > 0) capData = data[0];
        } catch (err) {
            console.error("Error consultando capacitación:", err);
        }
    }

    poblarCabeceraVisible(capData, idCapTarget);

    if (idCapTarget) {
        await cargarAsistentes(idCapTarget);
    }
}

function poblarCabeceraVisible(cap, idFallback) {
    const cActual = cap?.clase_nro || cap?.clase || '1';
    const cTotal = cap?.total_clases || cap?.totalClases || '1';
    const fechaRaw = cap?.fecha || cap?.fecha_curso || '';
    const fechaFormat = window.formatearFecha ? window.formatearFecha(fechaRaw) : fechaRaw;

    const datos = {
        id: obtenerIdCapActual(cap) || idFallback || '',
        curso: cap?.nombre_curso || cap?.curso || '',
        clase: `${cActual} de ${cTotal}`,
        fecha: fechaFormat,
        instructor: cap?.instructor_1 || cap?.instructor1 || cap?.instructor || '',
        estado: cap?.estado || 'Programado'
    };

    // 1. Asignación por selector o ID explícito
    const inputId = document.getElementById('resumenIdCap') || document.getElementById('idCap') || document.getElementById('idcap') || document.getElementById('id_cap');
    const inputCurso = document.getElementById('resumenCurso') || document.getElementById('curso') || document.getElementById('nombre_curso');
    const inputClase = document.getElementById('resumenClase') || document.getElementById('clase') || document.getElementById('clase_nro');
    const inputFecha = document.getElementById('resumenFecha') || document.getElementById('fecha');
    const inputInst = document.getElementById('resumenInstructor') || document.getElementById('instructor') || document.getElementById('instructor_1');
    const inputEstado = document.getElementById('resumenEstado') || document.getElementById('estado');

    if (inputId) inputId.value = datos.id;
    if (inputCurso) inputCurso.value = datos.curso;
    if (inputClase) inputClase.value = datos.clase;
    if (inputFecha) inputFecha.value = datos.fecha;
    if (inputInst) inputInst.value = datos.instructor;
    if (inputEstado) inputEstado.value = datos.estado;

    // 2. Respaldo directo por posición de inputs en el bloque superior
    const todosInputs = document.querySelectorAll('main input, form input, .card input, input');
    if (todosInputs.length >= 6) {
        if (!inputId || !inputId.value) todosInputs[0].value = datos.id;
        if (!inputCurso || !inputCurso.value) todosInputs[1].value = datos.curso;
        if (!inputClase || !inputClase.value) todosInputs[2].value = datos.clase;
        if (!inputFecha || !inputFecha.value) todosInputs[3].value = datos.fecha;
        if (!inputInst || !inputInst.value) todosInputs[4].value = datos.instructor;
        if (!inputEstado || !inputEstado.value) todosInputs[5].value = datos.estado;
    }
}

async function cargarAsistentes(idCap) {
    const db = obtenerDB();
    if (!db) return;

    try {
        const { data, error } = await db
            .from('asistentes')
            .select('*')
            .eq('id_cap', idCap);

        listaAsistentes = (!error && data) ? data : [];
        renderizarGrilla();
    } catch (err) {
        console.error("Error leyendo asistentes:", err);
    }
}

// Obtener nómina de dotación actualizada de forma segura
function obtenerNominaDotacion() {
    if (window.dbLocal && window.dbLocal.raw) {
        const datos = window.dbLocal.raw.leerTabla('dotacion');
        if (Array.isArray(datos) && datos.length > 0) return datos;
    }
    if (window.empleados && Array.isArray(window.empleados) && window.empleados.length > 0) {
        return window.empleados;
    }
    if (window.dotacion && Array.isArray(window.dotacion) && window.dotacion.length > 0) {
        return window.dotacion;
    }
    try {
        const raw = localStorage.getItem('SIGA_DB_dotacion');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {
        console.error("Error leyendo dotacion:", e);
    }
    return [];
}

// 2. AGREGAR PARTICIPANTE CON BÚSQUEDA FLEXIBLE DE LEGAJO (00005, 5, etc.)
function agregarParticipante() {
    const inputs = document.querySelectorAll('input');
    const inputLegajo = document.getElementById('inputLegajo') || document.getElementById('legajo') || inputs[6];
    const inputCalificaciones = document.getElementById('inputCalificacion') || document.getElementById('calificacion') || inputs[7];
    const inputObservaciones = document.getElementById('inputObservaciones') || document.getElementById('observaciones') || inputs[8];

    const idCap = obtenerIdCapActual();
    const legajoVal = inputLegajo?.value ? String(inputLegajo.value).trim() : '';

    if (!legajoVal) {
        alert("Por favor, ingrese un número de legajo.");
        return;
    }

    const nomina = obtenerNominaDotacion();
    const legajoBuscado = legajoVal.toLowerCase();
    const legajoPadded = legajoVal.padStart(5, '0').toLowerCase();
    const legajoNum = parseInt(legajoVal, 10);

    const emp = nomina.find(e => {
        if (!e.legajo && e.legajo !== 0) return false;
        const lStr = String(e.legajo).trim().toLowerCase();
        if (lStr === legajoBuscado || lStr === legajoPadded) return true;
        const lNum = parseInt(lStr, 10);
        return !isNaN(legajoNum) && !isNaN(lNum) && legajoNum === lNum;
    });

    if (!emp) {
        alert(`El legajo "${legajoVal}" no se encuentra registrado en la base de dotación de personal.`);
        return;
    }

    const legajoFinal = String(emp.legajo || legajoVal).padStart(5, '0');

    if (listaAsistentes.some(a => String(a.legajo).trim() === legajoFinal || String(a.legajo).trim() === String(emp.legajo).trim())) {
        alert(`El empleado con legajo ${legajoFinal} ya está agregado en la grilla.`);
        return;
    }

    const puestoFinal = emp.puesto || emp.col_4 || (emp.datos_completos && emp.datos_completos.col_4) || emp.puesto_cargo || '';
    const categoriaFinal = emp.categoria || emp.col_8 || (emp.datos_completos && emp.datos_completos.col_8) || '';
    const direccionFinal = emp.direccion || emp.col_13 || (emp.datos_completos && emp.datos_completos.col_13) || '';
    const gerenciaFinal = emp.gerencia || emp.col_14 || (emp.datos_completos && emp.datos_completos.col_14) || '';
    const coordinacionFinal = emp.coordinacion || emp.col_15 || (emp.datos_completos && emp.datos_completos.col_15) || '';
    const jefaturaFinal = emp.jefatura || emp.col_16 || (emp.datos_completos && emp.datos_completos.col_16) || '';
    const managerFinal = emp.manager || emp.col_19 || (emp.datos_completos && emp.datos_completos.col_19) || '';
    const emailFinal = emp.email || emp.col_37 || (emp.datos_completos && emp.datos_completos.col_37) || emp.mail || '';

    const nuevoAsistente = {
        id_cap: idCap,
        legajo: legajoFinal,
        apellido: emp.apellido || '',
        nombre: emp.nombre || '',
        puesto: puestoFinal,
        categoria: categoriaFinal,
        direccion: direccionFinal,
        gerencia: gerenciaFinal,
        coordinacion: coordinacionFinal,
        jefatura: jefaturaFinal,
        manager: managerFinal,
        email: emailFinal,
        calificacion: inputCalificaciones?.value ? inputCalificaciones.value.trim() : '-',
        observaciones: inputObservaciones?.value ? inputObservaciones.value.trim() : '-'
    };

    listaAsistentes.push(nuevoAsistente);
    renderizarGrilla();

    if (inputLegajo) inputLegajo.value = '';
    if (inputCalificaciones) inputCalificaciones.value = '';
    if (inputObservaciones) inputObservaciones.value = '';
    if (inputLegajo) inputLegajo.focus();
}

function renderizarGrilla() {
    const tbody = document.getElementById('tbodyAsistentes') || document.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (listaAsistentes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">
                    No hay participantes registrados para esta clase aún.
                </td>
            </tr>
        `;
        return;
    }

    listaAsistentes.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';

        tr.innerHTML = `
            <td style="padding:12px 15px; font-weight:bold;">${item.legajo}</td>
            <td style="padding:12px 15px;">${item.apellido}</td>
            <td style="padding:12px 15px;">${item.nombre}</td>
            <td style="padding:12px 15px; text-align:center;">${item.calificacion || '-'}</td>
            <td style="padding:12px 15px;">${item.observaciones || '-'}</td>
            <td style="padding:12px 15px; color:#64748b; text-align:center;">Pendiente</td>
            <td style="padding:12px 15px; text-align:center;">
                <button onclick="quitarParticipante(${idx})" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                    Quitar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.quitarParticipante = function(index) {
    listaAsistentes.splice(index, 1);
    renderizarGrilla();
};

// 3. GUARDAR EN BASE LOCAL Y DESPLEGAR MODAL
async function cerrarRegistro() {
    const idCap = obtenerIdCapActual();

    if (!idCap) {
        alert("No hay un ID_CAP válido asignado.");
        return;
    }

    const confirmacion = confirm(`¿Desea cerrar el registro de la capacitación?\n\nID: ${idCap}\nTotal de asistentes: ${listaAsistentes.length}`);
    if (!confirmacion) return;

    // Evaluación para definir el estado de la serie
    const capActivaRaw = localStorage.getItem("capacitacion_activa");
    let capData = capActivaRaw ? JSON.parse(capActivaRaw) : {};

    // Si capData no tiene todos los campos, obtenerlos de la base de datos
    if ((!capData.nombre_curso || !capData.total_clases) && window.dbLocal && window.dbLocal.raw) {
        const dbCaps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
        const found = dbCaps.find(c => String(c.id_cap).trim() === String(idCap).trim());
        if (found) capData = { ...found, ...capData };
    }

    const claseActual = parseInt(capData.clase_nro || "1", 10);
    const totalClases = parseInt(capData.total_clases || "1", 10);
    // Cada clase en la que se registra y cierra asistencia finaliza de forma independiente
    const estadoFinal = "Finalizado";

    const db = obtenerDB();
    if (db) {
        try {
            await db.from('asistentes').delete().eq('id_cap', idCap);

            if (listaAsistentes.length > 0) {
                const { error: errInsert } = await db.from('asistentes').insert(listaAsistentes);
                if (errInsert) throw errInsert;
            }

            await db.from('capacitaciones').update({ estado: estadoFinal }).eq('id_cap', idCap);

            // Actualizar la clase en la base local manteniendo intactas las demás clases de la serie
            if (window.dbLocal && window.dbLocal.raw) {
                const todasCaps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
                const idx = todasCaps.findIndex(c => c && c.id_cap && String(c.id_cap).trim() === String(idCap).trim());
                if (idx !== -1) {
                    todasCaps[idx].estado = estadoFinal;
                    window.dbLocal.raw.escribirTabla('capacitaciones', todasCaps);
                }
            }

            if (typeof window.normalizarEstadosSeriesCapacitaciones === 'function') {
                window.normalizarEstadosSeriesCapacitaciones();
            }

        } catch (err) {
            console.error("Error guardando asistentes en base local:", err);
            alert("Error al guardar asistentes: " + (err.message || "Error al procesar los datos"));
            return;
        }
    }

    // Preparar datos de cabecera e impresión antes de limpiar estado activo
    let horarioStr = '-';
    if (capData.hs_inicio && capData.hs_fin) {
        horarioStr = `${capData.hs_inicio} a ${capData.hs_fin}`;
    } else if (capData.hs_inicio) {
        horarioStr = `${capData.hs_inicio}`;
    } else if (capData.horario && capData.horario !== '-') {
        horarioStr = capData.horario;
    } else if (capData.duracion || capData.duracion_horas) {
        horarioStr = `${capData.duracion || capData.duracion_horas} hs`;
    }

    let fechaFormateada = capData.fecha || new Date().toLocaleDateString('es-AR');
    if (window.formatearFecha && fechaFormateada) {
        fechaFormateada = window.formatearFecha(fechaFormateada);
    }

    const cursoNombre = capData.nombre_curso || capData.curso || 'Capacitación General';
    const datosCapParaImprimir = {
        id_cap: idCap,
        fecha: fechaFormateada,
        horario: horarioStr,
        programa: capData.programa || cursoNombre,
        curso: `${cursoNombre} (Clase Nº ${claseActual} de ${totalClases})`,
        modulo: `Clase Nº ${claseActual}`,
        temas: capData.tema || capData.temas || capData.descripcion || '-',
        capacitador: [capData.instructor_1, capData.instructor_2, capData.instructor, capData.capacitador].filter(Boolean).join(', ') || '-',
        lugar: capData.lugar || 'Planta General',
        modalidad: capData.modalidad || 'Presencial'
    };

    localStorage.setItem('siga_impresion_cabecera', JSON.stringify(datosCapParaImprimir));
    localStorage.setItem('siga_impresion_asistentes', JSON.stringify(listaAsistentes.map(a => ({
        legajo: a.legajo || '',
        apellido: a.apellido || '',
        nombre: a.nombre || '',
        sector: '',
        linea: ''
    }))));

    // Limpiar claves locales relativas a la sesión de carga activa
    localStorage.removeItem("capacitacion_activa");
    localStorage.removeItem("id_cap_asistencia");

    // Abrir Modal de Confirmación e Impresión
    const modal = document.getElementById('confirmacion');
    const msgConfirmacion = document.getElementById('mensajeConfirmacion');

    if (msgConfirmacion) {
        msgConfirmacion.textContent = `Los datos del curso fueron guardados con éxito. Estado asignado: "${estadoFinal}".`;
    }

    if (modal) {
        modal.style.display = 'flex';
    } else {
        alert(`Registro cerrado con éxito. Estado asignado: ${estadoFinal}.`);
        window.location.href = "actividades.html";
    }
}

function configurarEventos() {
    const botones = document.querySelectorAll('button');

    const btnAgregar = document.getElementById('btnAgregarParticipante') || document.getElementById('btnAgregar') || Array.from(botones).find(b => b.textContent.includes('Agregar'));
    if (btnAgregar) btnAgregar.onclick = (e) => { e.preventDefault(); agregarParticipante(); };

    const btnCerrar = document.getElementById('btnCerrarRegistro') || Array.from(botones).find(b => b.textContent.includes('Cerrar'));
    if (btnCerrar) btnCerrar.onclick = (e) => { e.preventDefault(); cerrarRegistro(); };

    const btnCancelar = document.getElementById('btnCancelar') || Array.from(botones).find(b => b.textContent.includes('Cancelar'));
    if (btnCancelar) btnCancelar.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem("capacitacion_activa");
        window.location.href = "actividades.html";
    };

    // Permitir presionar Enter en el input de legajo para agregar inmediatamente
    const inputLegajo = document.getElementById('inputLegajo') || document.getElementById('legajo') || document.querySelector("input[placeholder*='01001']");
    if (inputLegajo) {
        inputLegajo.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                agregarParticipante();
            }
        });
    }
}
