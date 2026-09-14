// ===================================================
// 10/08/2026 - V0.2 - SIGA_APP - CAPACITACIONES (Integración con Supabase)
// ===================================================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Comprobar si hay una capacitación seleccionada en localStorage
    let cap = null;
    const dataGuardada = localStorage.getItem("capacitacion_activa");
    if (dataGuardada) {
        try { cap = JSON.parse(dataGuardada); } catch(e) {}
    }

    // 2. Cargar desplegables dinámicos desde Supabase / base local
    await cargarSelectoresDesdeJS(cap);

    if (cap) {
        poblarFormulario(cap);
    } else {
        await generarProximoIdCap();
    }

    evaluarEstadoFormulario();
});

// Carga asíncrona de selectores desde las tablas de Supabase (con limpieza de espacios)
async function cargarSelectoresDesdeJS(capActual = null) {
    const db = window.supabaseClient || window.supabase || (window.dbLocal ? window.dbLocal : null);
    if (!db) {
        setTimeout(() => cargarSelectoresDesdeJS(capActual), 400);
        return;
    }

    try {
        // 1. Cargar Programas desde la tabla 'programas'
        const { data: progs, error: errProgs } = await db.from("programas").select("nombre, estado");
        if (!errProgs && progs) {
            const programasFiltrados = progs
                .filter(p => !p.estado || p.estado.trim() === "Activo")
                .map(p => p.nombre.trim());
            poblarSelect("programa", programasFiltrados, capActual?.programa);
        } else if (errProgs) {
            console.error("Error al cargar programas desde Supabase:", errProgs);
        }

        // 2. Cargar Cursos desde la tabla 'cursos'
        const { data: cursos, error: errCursos } = await db.from("cursos").select("nombre, estado");
        if (!errCursos && cursos) {
            const cursosFiltrados = cursos
                .filter(c => !c.estado || c.estado.trim() === "Activo")
                .map(c => c.nombre.trim());
            poblarSelect("curso", cursosFiltrados, capActual?.nombre_curso);
        }

        // 3. Cargar Instructores desde la tabla 'instructores'
        const { data: insts, error: errInsts } = await db.from("instructores").select("nombre, apellido, estado");
        if (!errInsts && insts) {
            const instFiltrados = insts
                .filter(i => !i.estado || i.estado.trim() === "Activo")
                .map(i => `${i.nombre.trim()} ${i.apellido.trim()}`);
            poblarSelect("instructor1", instFiltrados, capActual?.instructor_1);
            poblarSelect("instructor2", instFiltrados, capActual?.instructor_2);
        }
    } catch (err) {
        console.error("Error inesperado al cargar desplegables:", err);
    }
}

function poblarSelect(idElemento, listaDatos, valorSeleccionar = null) {
    const select = document.getElementById(idElemento);
    if (!select) return;

    const valorPrevio = valorSeleccionar || select.value;
    select.innerHTML = '<option value="">Seleccione...</option>';
    
    // Si el valor previo no está en la lista activa, agregarlo para no perderlo
    const listaCompleta = [...listaDatos];
    if (valorPrevio && !listaCompleta.includes(valorPrevio) && valorPrevio !== "Seleccione...") {
        listaCompleta.push(valorPrevio);
    }

    listaCompleta.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });

    if (valorPrevio) {
        select.value = valorPrevio;
    }
}

function poblarFormulario(cap) {
    if (document.getElementById("idCap")) document.getElementById("idCap").value = cap.id_cap || "";
    if (document.getElementById("programa")) document.getElementById("programa").value = cap.programa || "";
    if (document.getElementById("curso")) document.getElementById("curso").value = cap.nombre_curso || "";
    if (document.getElementById("clase")) document.getElementById("clase").value = cap.clase_nro || "1";
    if (document.getElementById("totalClases")) document.getElementById("totalClases").value = cap.total_clases || "1";
    if (document.getElementById("estado")) document.getElementById("estado").value = cap.estado || "Programado";
    if (document.getElementById("requiereTransferencia")) {
        const reqT = String(cap.requiere_transferencia || '').toUpperCase();
        document.getElementById("requiereTransferencia").value = (reqT === 'SI' || reqT === 'SÍ' || reqT === 'TRUE') ? 'SI' : 'NO';
    }
    if (document.getElementById("tema")) document.getElementById("tema").value = cap.tema || "";
    const fechaNormalizada = window.normalizarFecha ? window.normalizarFecha(cap.fecha) : (cap.fecha || "");
    if (document.getElementById("fecha")) document.getElementById("fecha").value = fechaNormalizada;
    if (document.getElementById("horaInicio")) document.getElementById("horaInicio").value = cap.hs_inicio || "";
    if (document.getElementById("horaFin")) document.getElementById("horaFin").value = cap.hs_fin || "";
    if (document.getElementById("lugar")) document.getElementById("lugar").value = cap.lugar || "";
    if (document.getElementById("centro")) document.getElementById("centro").value = cap.centro || "";
    if (document.getElementById("instructor1")) document.getElementById("instructor1").value = cap.instructor_1 || "";
    if (document.getElementById("instructor2")) document.getElementById("instructor2").value = cap.instructor_2 || "";
    if (document.getElementById("observaciones")) document.getElementById("observaciones").value = cap.observaciones || "";
}

function getValor(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    const val = el.value ? el.value.trim() : "";
    return (val === "Seleccione...") ? "" : val;
}

function obtenerObjetoFormulario() {
    const reqTVal = getValor("requiereTransferencia");
    return {
        id_cap: getValor("idCap"),
        programa: getValor("programa"),
        nombre_curso: getValor("curso"),
        clase_nro: parseInt(getValor("clase") || "1", 10),
        total_clases: parseInt(getValor("totalClases") || "1", 10),
        estado: getValor("estado") || "Programado",
        requiere_transferencia: (reqTVal === "SI" || reqTVal === "Sí") ? "SI" : "NO",
        tema: getValor("tema"),
        fecha: document.getElementById("fecha")?.value || null,
        hs_inicio: document.getElementById("horaInicio")?.value || null,
        hs_fin: document.getElementById("horaFin")?.value || null,
        lugar: getValor("lugar"),
        centro: getValor("centro"),
        instructor_1: getValor("instructor1"),
        instructor_2: getValor("instructor2"),
        observaciones: getValor("observaciones")
    };
}


// Bloquea/Desbloquea el acceso a Asistentes según los 3 estados
function evaluarEstadoFormulario() {
    const estado = getValor("estado");
    const btnAsistentes = document.getElementById("btnAsistentes");

    if (btnAsistentes) {
        btnAsistentes.style.opacity = "1";
        btnAsistentes.style.cursor = "pointer";
        if (estado === "Programado") {
            btnAsistentes.title = "Pasar a la toma de asistencia (la actividad pasará a 'En curso').";
        } else {
            btnAsistentes.title = "Pasar a la toma de asistencia.";
        }
    }
}

document.getElementById("estado")?.addEventListener("change", evaluarEstadoFormulario);

// Formateo dinámico de ID_CAP al cambiar el número de clase
document.getElementById("clase")?.addEventListener("input", () => {
    const inputIdCap = document.getElementById("idCap");
    const numClase = String(getValor("clase") || "1").padStart(2, "0");
    
    if (inputIdCap && inputIdCap.value) {
        const partes = inputIdCap.value.split("-");
        if (partes.length >= 3) {
            inputIdCap.value = `${partes[0]}-${partes[1]}-${partes[2]}-${numClase}`;
        }
    }
});

// Autogenera el próximo correlativo si es una capacitación nueva
async function generarProximoIdCap() {
    const inputIdCap = document.getElementById("idCap");
    const inputClase = document.getElementById("clase");
    const db = window.supabaseClient || window.supabase;
    const anio = new Date().getFullYear();

    try {
        if (!db) {
            if (inputIdCap) inputIdCap.value = `CAP-${anio}-001-01`;
            if (inputClase) inputClase.value = "1";
            return;
        }

        const { data, error } = await db.from("capacitaciones").select("id_cap");

        if (error || !data || data.length === 0) {
            if (inputIdCap) inputIdCap.value = `CAP-${anio}-001-01`;
            if (inputClase) inputClase.value = "1";
            return;
        }

        let maxCurso = 0;
        data.forEach(item => {
            if (item.id_cap) {
                const partes = item.id_cap.split("-");
                if (partes.length >= 3) {
                    const num = parseInt(partes[2], 10);
                    if (!isNaN(num) && num > maxCurso) maxCurso = num;
                }
            }
        });

        const nuevoNum = maxCurso + 1;
        const cursoPadded = String(nuevoNum).padStart(3, "0");

        if (inputIdCap) inputIdCap.value = `CAP-${anio}-${cursoPadded}-01`;
        if (inputClase) inputClase.value = "1";

    } catch (err) {
        console.error("Error al generar ID:", err);
        if (inputIdCap) inputIdCap.value = `CAP-${anio}-001-01`;
        if (inputClase) inputClase.value = "1";
    }
}

function limpiarFormulario() {
    localStorage.removeItem("capacitacion_activa");
    ["programa", "curso", "tema", "fecha", "horaInicio", "horaFin", "lugar", "centro", "instructor1", "instructor2", "observaciones"].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = "";
    });
    if (document.getElementById("clase")) document.getElementById("clase").value = "1";
    if (document.getElementById("totalClases")) document.getElementById("totalClases").value = "1";
    if (document.getElementById("estado")) document.getElementById("estado").value = "Programado";
    if (document.getElementById("requiereTransferencia")) document.getElementById("requiereTransferencia").value = "NO";
    evaluarEstadoFormulario();
}

// Variable para la acción pendiente confirmada en el modal
let accionModalPendiente = null;

function mostrarModalVerificacionCabecera(tipoAccion) {
    const datos = obtenerObjetoFormulario();

    if (!datos.nombre_curso || !datos.fecha) {
        alert("Atención: Por favor seleccioná un Curso y una Fecha antes de continuar.");
        return;
    }

    if (tipoAccion === "asistentes" && datos.estado === "Programado") {
        const confirmarPase = confirm("La capacitación está en estado 'Programado'. Para registrar la asistencia pasará a 'En curso'. ¿Desea continuar?");
        if (!confirmarPase) return;
        const selectEstado = document.getElementById("estado");
        if (selectEstado) selectEstado.value = "En curso";
        datos.estado = "En curso";
        evaluarEstadoFormulario();
    }

    accionModalPendiente = tipoAccion;

    const contenedorResumen = document.getElementById("resumenCabeceraModal");
    if (contenedorResumen) {
        const instructores = [datos.instructor_1, datos.instructor_2].filter(Boolean).join(" | ") || "Sin instructor asignado";
        const fechaFormateada = window.formatearFecha ? window.formatearFecha(datos.fecha) : datos.fecha;
        const reqTransTxt = (datos.requiere_transferencia === "SI") ? "✅ Sí (Conteo 90 días activo)" : "❌ No";

        contenedorResumen.innerHTML = `
            <div><strong>ID Actividad:</strong> <span style="color: #0f766e; font-weight: bold;">${datos.id_cap || '-'}</span></div>
            <div><strong>Programa:</strong> <span>${datos.programa || 'Sin programa'}</span></div>
            <div style="grid-column: 1 / -1;"><strong>Curso:</strong> <span style="color: #1e293b; font-weight: 600;">${datos.nombre_curso}</span></div>
            <div><strong>Clase:</strong> <span>Clase ${datos.clase_nro} de ${datos.total_clases}</span></div>
            <div><strong>Estado:</strong> <span style="padding: 2px 8px; border-radius: 6px; background: #e0f2fe; color: #0369a1; font-weight: bold;">${datos.estado}</span></div>
            <div style="grid-column: 1 / -1;"><strong>Req. Transferencia (90 días):</strong> <span style="font-weight: 600;">${reqTransTxt}</span></div>
            <div><strong>Fecha:</strong> <span>${fechaFormateada}</span></div>
            <div><strong>Horario:</strong> <span>${datos.hs_inicio || '--:--'} a ${datos.hs_fin || '--:--'} hs</span></div>
            <div><strong>Lugar:</strong> <span>${datos.lugar || '-'}</span></div>
            <div><strong>Centro:</strong> <span>${datos.centro || '-'}</span></div>
            <div style="grid-column: 1 / -1;"><strong>Instructor/es:</strong> <span>${instructores}</span></div>
            ${datos.tema ? `<div style="grid-column: 1 / -1; border-top: 1px dashed #cbd5e1; padding-top: 8px;"><strong>Tema:</strong> <span style="color: #475569;">${datos.tema}</span></div>` : ''}
            ${datos.observaciones ? `<div style="grid-column: 1 / -1; border-top: 1px dashed #cbd5e1; padding-top: 8px;"><strong>Observaciones:</strong> <span style="color: #475569;">${datos.observaciones}</span></div>` : ''}
        `;
    }

    const modal = document.getElementById("modalConfirmacionCabecera");
    if (modal) modal.style.display = "flex";
}

function ocultarModalVerificacionCabecera() {
    const modal = document.getElementById("modalConfirmacionCabecera");
    if (modal) modal.style.display = "none";
    accionModalPendiente = null;
}

// Botones del Modal
document.getElementById("btnModalModificar")?.addEventListener("click", () => {
    ocultarModalVerificacionCabecera();
});

document.getElementById("btnModalContinuar")?.addEventListener("click", async () => {
    const accion = accionModalPendiente;
    ocultarModalVerificacionCabecera();

    if (accion === "guardar") {
        await ejecutarGuardadoActividad();
    } else if (accion === "asistentes") {
        await ejecutarPaseAsistentes();
    }
});

// Guardado efectivo tras confirmación
async function ejecutarGuardadoActividad() {
    const datos = obtenerObjetoFormulario();
    const db = window.supabaseClient || window.supabase;

    if (db) {
        const { error } = await db.from("capacitaciones").upsert([datos]);
        if (error) {
            alert("Error al guardar en base de datos: " + error.message);
            return;
        }

        if (typeof window.normalizarEstadosSeriesCapacitaciones === 'function') {
            window.normalizarEstadosSeriesCapacitaciones();
        }
    }

    alert(`Capacitación ${datos.id_cap} guardada con éxito con estado '${datos.estado}'.`);
    limpiarFormulario();
    window.location.href = "actividades.html";
}

// Pase a toma de asistencia tras confirmación
async function ejecutarPaseAsistentes() {
    const datos = obtenerObjetoFormulario();
    localStorage.setItem("capacitacion_activa", JSON.stringify(datos));

    const db = window.supabaseClient || window.supabase;
    if (db) {
        try {
            await db.from("capacitaciones").upsert([datos]);

            if (typeof window.normalizarEstadosSeriesCapacitaciones === 'function') {
                window.normalizarEstadosSeriesCapacitaciones();
            }
        } catch (err) {
            console.warn("Aviso al actualizar capacitación previa a asistencia:", err);
        }
    }

    window.location.href = "asistentes.html";
}

// BOTÓN: Guardar -> Muestra popup de verificación
document.getElementById("btnGuardar")?.addEventListener("click", (e) => {
    e.preventDefault();
    mostrarModalVerificacionCabecera("guardar");
});

// BOTÓN: Registrar Asistentes -> Muestra popup de verificación
document.getElementById("btnAsistentes")?.addEventListener("click", (e) => {
    e.preventDefault();
    mostrarModalVerificacionCabecera("asistentes");
});

// BOTÓN: Volver
document.getElementById("btnVolver")?.addEventListener("click", (e) => {
    e.preventDefault();
    limpiarFormulario();
    window.location.href = "actividades.html";
});
