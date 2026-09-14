// ===================================================
// 18/08/2026 - V0.10 - SIGA_APP - CONSULTA A TABLA 'asistentes' Y 'jefatura'
// ===================================================

const DIAS_EVALUACION_TRANSFERENCIA = 30; // ⚙️ Parámetro de prueba (cambiar a 90 en producción)

document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.normalizarEstadosSeriesCapacitaciones === 'function') {
        window.normalizarEstadosSeriesCapacitaciones();
    }
    inicializarTarjetas();
    configurarEventosModal();
    verificarCampoIdCapLocal();
});

function obtenerDB() {
    return window.dbLocal || window.supabaseClient || window.supabase || null;
}

function inicializarTarjetas() {
    // Nueva Capacitación
    document.getElementById("cardNueva")?.addEventListener("click", async () => {
        localStorage.removeItem("capacitacion_activa");
        const nuevoIdCap = await obtenerSiguienteIdCap();
        const nuevaCap = { id_cap: nuevoIdCap, clase_nro: "1", estado: "Programado" };
        localStorage.setItem("capacitacion_activa", JSON.stringify(nuevaCap));
        window.location.href = "capacitaciones.html";
    });

    // Programadas
    document.getElementById("cardProgramadas")?.addEventListener("click", () => {
        abrirModalPorEstado("Programado", "Capacitaciones Programadas");
    });

    // En curso
    document.getElementById("cardEnCurso")?.addEventListener("click", () => {
        abrirModalPorEstado("En curso", "Capacitaciones En Curso");
    });

    // Finalizadas
    document.getElementById("cardFinalizadas")?.addEventListener("click", () => {
        abrirModalPorEstado("Finalizado", "Historial de Capacitaciones Finalizadas");
    });

    // Encuesta de Satisfacción (QR directos)
    document.getElementById("cardSatisfaccion")?.addEventListener("click", () => {
        abrirModalPorEstado("QR", "Encuesta de Satisfacción - Seleccionar Capacitación");
    });

    // Encuesta de Transferencia (Gestión Post-30 Días)
    document.getElementById("cardTransferencia")?.addEventListener("click", () => {
        abrirModalTransferencia();
    });
}

// Genera correlativo CAP-AAAA-XXX-01
async function obtenerSiguienteIdCap() {
    const db = obtenerDB();
    const anioActual = new Date().getFullYear();

    if (!db) return `CAP-${anioActual}-001-01`;

    try {
        let items = [];
        if (window.dbLocal && window.dbLocal.raw) {
            items = window.dbLocal.raw.leerTabla('capacitaciones') || [];
        }
        if ((!items || items.length === 0) && (window.supabaseCloudClient || db)) {
            const cliente = window.supabaseCloudClient || db;
            const { data } = await cliente.from("capacitaciones").select("id_cap");
            if (data && data.length > 0) items = data;
        }

        if (!items || items.length === 0) return `CAP-${anioActual}-001-01`;

        let maxNumero = 0;
        items.forEach(item => {
            if (item.id_cap) {
                const partes = item.id_cap.split("-");
                if (partes.length >= 3) {
                    const num = parseInt(partes[2], 10);
                    if (!isNaN(num) && num > maxNumero) maxNumero = num;
                }
            }
        });

        const siguienteNumero = String(maxNumero + 1).padStart(3, "0");
        return `CAP-${anioActual}-${siguienteNumero}-01`;
    } catch (err) {
        console.error("Error al consultar último ID_CAP:", err);
        return `CAP-${anioActual}-001-01`;
    }
}

async function verificarCampoIdCapLocal() {
    const inputIdCap = document.getElementById("id_cap") || document.querySelector("input[placeholder*='CAP-']");
    if (inputIdCap && (!inputIdCap.value || inputIdCap.value.endsWith("-001-01"))) {
        const capActiva = localStorage.getItem("capacitacion_activa");
        if (!capActiva) {
            const nuevoId = await obtenerSiguienteIdCap();
            inputIdCap.value = nuevoId;
        }
    }
}

function configurarEventosModal() {
    const modalCap = document.getElementById("modalCapacitaciones");
    const btnCerrarCap = document.getElementById("btnCerrarModal");
    const modalQR = document.getElementById("modalQR");
    const btnCerrarQR = document.getElementById("btnCerrarQR");

    btnCerrarCap?.addEventListener("click", () => { 
        if (modalCap) modalCap.style.display = "none"; 
    });

    // Evento de cierre para el modal del QR / Enlaces
    const intentarCerrarModalQR = async () => {
        if (!modalQR) return;

        // Si la ventana abierta era de satisfacción
        if (window.capEspecialSatisfaccionId) {
            const idCap = window.capEspecialSatisfaccionId;
            const db = obtenerDB();
            if (db) {
                try {
                    await db.from("capacitaciones").update({ estado_sat: "Enviada" }).eq("id_cap", idCap);
                } catch(e) {}
            }
            if (window.dbLocal && window.dbLocal.raw) {
                const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
                const idx = caps.findIndex(c => String(c.id_cap).trim() === idCap.trim());
                if (idx !== -1) {
                    caps[idx].estado_sat = "Enviada";
                    window.dbLocal.raw.escribirTabla('capacitaciones', caps);
                }
            }
            window.capEspecialSatisfaccionId = null;
        }

        // Si la ventana abierta era de transferencia, pedimos confirmación
        if (window.capEspecialTransferenciaId) {
            const idCap = window.capEspecialTransferenciaId;
            const confirmado = confirm(`¿Confirmás el envío de la encuesta de transferencia para la capacitación ${idCap}?`);
            
            if (confirmado) {
                const db = obtenerDB();
                if (db) {
                    try {
                        await db
                            .from("capacitaciones")
                            .update({ 
                                estado_tra: "Enviada",
                                fecha_envio_transferencia: new Date().toISOString()
                            })
                            .eq("id_cap", idCap);
                        
                        alert("Capacitación marcada como 'Enviada'.");
                        abrirModalTransferencia();
                    } catch (err) {
                        console.error("Error al actualizar estado_tra:", err);
                    }
                }
                if (window.dbLocal && window.dbLocal.raw) {
                    const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
                    const idx = caps.findIndex(c => String(c.id_cap).trim() === idCap.trim());
                    if (idx !== -1) {
                        caps[idx].estado_tra = "Enviada";
                        caps[idx].fecha_envio_transferencia = new Date().toISOString();
                        window.dbLocal.raw.escribirTabla('capacitaciones', caps);
                    }
                }
            }
            window.capEspecialTransferenciaId = null;
        }

        modalQR.style.display = "none";
    };

    btnCerrarQR?.addEventListener("click", intentarCerrarModalQR);

    window.addEventListener("click", (e) => {
        if (e.target === modalCap) modalCap.style.display = "none";
        if (e.target === modalQR) intentarCerrarModalQR();
    });
}
// ----------------------------------------------------
// MODAL GENERAL (PROGRAMADAS / EN CURSO / FINALIZADAS / QR)
// ----------------------------------------------------
async function abrirModalPorEstado(estadoFiltro, titulo) {
    const modal = document.getElementById("modalCapacitaciones");
    const txtTitulo = document.getElementById("tituloModal");
    const tbody = document.getElementById("tbodyCapacitaciones");
    const thead = document.querySelector("#modalCapacitaciones table thead");

    if (thead) {
        if (estadoFiltro === "Finalizado") {
            thead.innerHTML = `
                <tr>
                    <th style="padding:10px;">ID CAP</th>
                    <th style="padding:10px;">Curso</th>
                    <th style="padding:10px; text-align:center;">Clase</th>
                    <th style="padding:10px;">Fecha</th>
                    <th style="padding:10px;">Instructor/es</th>
                    <th style="padding:10px; text-align:center;">Estado Encuesta</th>
                    <th style="padding:10px; text-align:center;">Acción</th>
                </tr>
            `;
        } else {
            thead.innerHTML = `
                <tr>
                    <th style="padding:10px;">ID CAP</th>
                    <th style="padding:10px;">Curso</th>
                    <th style="padding:10px; text-align:center;">Clase</th>
                    <th style="padding:10px;">Fecha</th>
                    <th style="padding:10px;">Instructor/es</th>
                    <th style="padding:10px; text-align:center;">Acción</th>
                </tr>
            `;
        }
    }

    const inputBuscar = document.getElementById('inputBuscarModal');
    if (inputBuscar) inputBuscar.value = '';

    if (txtTitulo) txtTitulo.textContent = titulo;
    const colSpan = estadoFiltro === "Finalizado" ? 7 : 6;
    if (tbody) tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:20px;">Cargando datos...</td></tr>`;
    if (modal) modal.style.display = "flex";

    try {
        let lista = [];
        if (window.dbLocal && window.dbLocal.raw) {
            const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
            const evals = window.dbLocal.raw.leerTabla('evaluaciones_satisfaccion') || window.dbLocal.raw.leerTabla('evaluaciones') || [];
            
            if (estadoFiltro === "QR") {
                lista = caps;
            } else {
                lista = caps.filter(c => c.estado === estadoFiltro);
            }

            // Cruzar estado_sat si ya fue respondida en la tabla de evaluaciones
            lista = lista.map(c => {
                const yaRespondio = evals.some(e => String(e.id_cap).trim() === String(c.id_cap).trim());
                if (yaRespondio && c.estado_sat !== 'Respondida') {
                    c.estado_sat = 'Respondida';
                }
                return c;
            });

            // Si en local no hay registros, consultar directamente Supabase Nube
            if (lista.length === 0 && (window.supabaseCloudClient || obtenerDB())) {
                const db = window.supabaseCloudClient || obtenerDB();
                let query = db.from("capacitaciones").select("*");
                if (estadoFiltro !== "QR") {
                    query = query.eq("estado", estadoFiltro);
                }
                const { data } = await query.order("id_cap", { ascending: false });
                if (data && data.length > 0) lista = data;
            }
        } else {
            const db = obtenerDB();
            if (db) {
                let query = db.from("capacitaciones").select("*");
                if (estadoFiltro !== "QR") {
                    query = query.eq("estado", estadoFiltro);
                }
                const { data } = await query.order("id_cap", { ascending: false });
                if (data) lista = data;
            }
        }

        if (!lista || lista.length === 0) {
            const msj = estadoFiltro === "QR" ? "No existen capacitaciones registradas." : `No hay capacitaciones en estado '<strong>${estadoFiltro}</strong>'.`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:20px;">${msj}</td></tr>`;
            return;
        }

        renderizarFilasModal(lista, estadoFiltro);
    } catch (err) {
        console.error("Error al obtener capacitaciones:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; color:red; padding:20px;">Error al consultar la base de datos.</td></tr>`;
    }
}

function renderizarFilasModal(lista, estadoFiltro) {
    const tbody = document.getElementById("tbodyCapacitaciones");
    if (!tbody) return;

    tbody.innerHTML = "";

    lista.forEach(item => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";

        let botonAccion = "";
        const instructores = [item.instructor_1, item.instructor_2].filter(Boolean).join(", ") || "-";

        if (estadoFiltro === "Programado") {
            botonAccion = `<button onclick="editarProgramada('${item.id_cap}')" style="background:#27ae60; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Editar</button>`;
        } else if (estadoFiltro === "En curso") {
            botonAccion = `<button onclick="cargarSiguienteClase('${item.id_cap}')" style="background:#2980b9; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Continuar Clase</button>`;
        } else if (estadoFiltro === "QR") {
            botonAccion = `<button onclick="generarQRModal('${item.id_cap}', '${(item.nombre_curso || '').replace(/'/g, "\\'")}')" style="background:#18C48F; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:600;">📱 Generar QR</button>`;
        } else {
            // Finalizadas: "Editar" protegido por clave Admin a la izquierda y botón de impresión 🖨️ a la derecha
            botonAccion = `
                <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                    <button onclick="editarFinalizadaAdmin('${item.id_cap}')" style="background-color: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;" title="Requiere clave de Administrador">✏️ Editar</button>
                    <button onclick="imprimirPlanillaHistorica('${item.id_cap}')" style="background-color: #1F6FEB; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 13px;" title="Imprimir Planilla A4">🖨️</button>
                </div>
            `;
        }

        const fechaLegible = window.formatearFecha ? window.formatearFecha(item.fecha) : (item.fecha || "-");

        if (estadoFiltro === "Finalizado") {
            const estadoEncuestaVal = item.estado_sat || item.estado_encuesta || "Pendiente";
            let badgeEncuesta = "";
            if (estadoEncuestaVal === "Enviada") {
                badgeEncuesta = `<span style="background:#0284c7; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600;">Enviada</span>`;
            } else if (estadoEncuestaVal === "Respondida" || estadoEncuestaVal === "Recibida") {
                badgeEncuesta = `<span style="background:#10b981; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600;">Respondida</span>`;
            } else {
                badgeEncuesta = `<span style="background:#f59e0b; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600;">Pendiente</span>`;
            }

            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold;">${item.id_cap || "-"}</td>
                <td style="padding:10px;">${item.nombre_curso || "-"}</td>
                <td style="padding:10px; text-align:center;">Clase ${parseInt(item.clase_nro || "1", 10)}</td>
                <td style="padding:10px;">${fechaLegible}</td>
                <td style="padding:10px;">${instructores}</td>
                <td style="padding:10px; text-align:center;">${badgeEncuesta}</td>
                <td style="padding:10px; text-align:center;">${botonAccion}</td>
            `;
        } else {
            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold;">${item.id_cap || "-"}</td>
                <td style="padding:10px;">${item.nombre_curso || "-"}</td>
                <td style="padding:10px; text-align:center;">Clase ${parseInt(item.clase_nro || "1", 10)}</td>
                <td style="padding:10px;">${fechaLegible}</td>
                <td style="padding:10px;">${instructores}</td>
                <td style="padding:10px; text-align:center;">${botonAccion}</td>
            `;
        }

        tbody.appendChild(tr);
    });

    window.listaCapacitacionesTemp = lista;
}

// ----------------------------------------------------
// MÓDULO ESPECIAL: ENCUESTA DE TRANSFERENCIA
// ----------------------------------------------------
async function abrirModalTransferencia() {
    const modal = document.getElementById("modalCapacitaciones");
    const txtTitulo = document.getElementById("tituloModal");
    const tbody = document.getElementById("tbodyCapacitaciones");
    const thead = document.querySelector("#modalCapacitaciones table thead");

    if (thead) {
        thead.innerHTML = `
            <tr>
                <th style="padding:10px;">ID CAP</th>
                <th style="padding:10px;">Curso</th>
                <th style="padding:10px; text-align:center;">Fecha Cursada</th>
                <th style="padding:10px; text-align:center;">Fecha Obj. Tra.</th>
                <th style="padding:10px; text-align:center;">Estado / Atraso</th>
                <th style="padding:10px; text-align:center;">Acciones</th>
            </tr>
        `;
    }

    const inputBuscar = document.getElementById('inputBuscarModal');
    if (inputBuscar) inputBuscar.value = '';

    if (txtTitulo) txtTitulo.textContent = "Encuesta de Transferencia (Evaluación Post-Capacitación)";
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Cargando capacitaciones...</td></tr>';
    if (modal) modal.style.display = "flex";

    try {
        let data = [];
        const requiereTra = (c) => {
            if (!c || c.estado !== 'Finalizado') return false;
            const req = String(c.requiere_transferencia || '').toUpperCase();
            return (req === 'SI' || req === 'SÍ' || req === 'TRUE') || (c.estado_tra && c.estado_tra !== 'No Aplica' && c.estado_tra !== 'No');
        };

        if (window.dbLocal && window.dbLocal.raw) {
            const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
            const trafs = window.dbLocal.raw.leerTabla('transferencias') || window.dbLocal.raw.leerTabla('encuestas_transferencia') || [];

            data = caps.filter(c => requiereTra(c));
            
            // Cruzar estado_tra si ya fue recibida en la tabla de transferencias
            data = data.map(c => {
                const yaRecibida = trafs.some(t => String(t.id_cap).trim() === String(c.id_cap).trim());
                if (yaRecibida && c.estado_tra !== 'Recibida') {
                    c.estado_tra = 'Recibida';
                }
                return c;
            });
        } else {
            const db = obtenerDB();
            if (db) {
                const { data: dbData, error } = await db
                    .from("capacitaciones")
                    .select("*")
                    .eq("estado", "Finalizado")
                    .order("id_cap", { ascending: false });

                if (error) throw error;
                if (dbData) data = dbData.filter(c => requiereTra(c));
            }
        }

        if (!data || data.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">No hay capacitaciones pendientes de evaluación de transferencia.</td></tr>`;
            return;
        }

        renderizarFilasTransferencia(data);
    } catch (err) {
        console.error("Error al cargar transferencias:", err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Error al consultar capacitaciones.</td></tr>';
    }
}

function renderizarFilasTransferencia(lista) {
    const tbody = document.getElementById("tbodyCapacitaciones");
    if (!tbody) return;

    tbody.innerHTML = "";
    const hoy = new Date();

    lista.forEach(item => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";

        let fechaObj;
        if (item.fecha_tra) {
            fechaObj = new Date(item.fecha_tra + "T00:00:00");
        } else if (item.fecha) {
            fechaObj = new Date(item.fecha + "T00:00:00");
            fechaObj.setDate(fechaObj.getDate() + DIAS_EVALUACION_TRANSFERENCIA);
        } else {
            fechaObj = new Date();
        }

        const difMs = fechaObj.getTime() - hoy.getTime();
        const diasDiferencia = Math.ceil(difMs / (1000 * 3600 * 24));

        let contadorHTML = "";
        const estadoActual = item.estado_tra || "Pendiente";

        if (estadoActual === "Recibida") {
            contadorHTML = `<span style="background:#10b981; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600;">Recibida</span>`;
        } else if (estadoActual === "Enviada") {
            if (diasDiferencia < 0) {
                const atraso = Math.abs(diasDiferencia);
                contadorHTML = `<span style="background:#0284c7; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600;">Enviada</span> <br><small style="color:#ef4444; font-weight:700;">🚨 ${atraso} días vencida</small>`;
            } else {
                contadorHTML = `<span style="background:#0284c7; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:600;">Enviada</span>`;
            }
        } else if (diasDiferencia < 0) {
            const atraso = Math.abs(diasDiferencia);
            contadorHTML = `<span style="color:#ef4444; font-weight:700; font-size:13px;">🚨 ${atraso} días de atraso (Sin enviar)</span>`;
        } else {
            contadorHTML = `<span style="color:#16a34a; font-weight:600; font-size:13px;">🟢 Faltan ${diasDiferencia} días</span>`;
        }

        const nombreCursoEscaped = (item.nombre_curso || '').replace(/'/g, "\\'");

        const accionesHTML = `
            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                <button onclick="generarQRTransferencia('${item.id_cap}', '${nombreCursoEscaped}')" style="background:#18C48F; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-weight:600; font-size:12px;" title="Generar QR para Jefatura">
                    📱 QR Jefaturas
                </button>
                <button onclick="omitirTransferencia('${item.id_cap}')" style="background:#dc2626; color:#fff; border:none; padding:6px 8px; border-radius:4px; cursor:pointer; font-size:12px;" title="Omitir / Borrar de pendientes">
                    🗑️ Omitir
                </button>
            </div>
        `;

        tr.innerHTML = `
            <td style="padding:10px; font-weight:bold;">${item.id_cap || "-"}</td>
            <td style="padding:10px;">${item.nombre_curso || "-"}</td>
            <td style="padding:10px; text-align:center;">${item.fecha || "-"}</td>
            <td style="padding:10px; text-align:center;">${fechaObj.toISOString().split("T")[0]}</td>
            <td style="padding:10px; text-align:center;">${contadorHTML}</td>
            <td style="padding:10px; text-align:center;">${accionesHTML}</td>
        `;

        tbody.appendChild(tr);
    });

    window.listaCapacitacionesTemp = lista;
}

// Omitir transferencia ("No Aplica")
window.omitirTransferencia = async function(idCap) {
    if (!confirm(`¿Confirmás omitir la encuesta de transferencia para la capacitación ${idCap}? Ya no figurará como pendiente.`)) return;

    const db = obtenerDB();
    if (!db) return;

    try {
        const { error } = await db
            .from("capacitaciones")
            .update({ estado_tra: "No Aplica" })
            .eq("id_cap", idCap);

        if (error) throw error;

        alert("Capacitación omitida correctamente.");
        abrirModalTransferencia();
    } catch (err) {
        console.error("Error al omitir transferencia:", err);
        alert("Ocurrió un error al actualizar la capacitación.");
    }
};

// Generar QR de Transferencia agrupando por Jefatura
window.generarQRTransferencia = async function(idCap, nombreCurso) {
    const modalQR = document.getElementById("modalQR");
    const contenedorJefaturas = document.getElementById("contenedorJefaturas");
    const qrTituloModal = document.getElementById("qrTituloModal");
    const qrSubtitulo = document.getElementById("qrSubtitulo");
    const qrIdCapText = document.getElementById("qrIdCapText");

    if (!contenedorJefaturas || !modalQR) return;

    // Guardamos el ID actual en la variable global para usarlo al cerrar
    window.capEspecialTransferenciaId = idCap;

    // Buscar datos completos de la capacitación
    let cap = null;
    if (window.dbLocal && window.dbLocal.raw) {
        const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
        cap = caps.find(c => String(c.id_cap).trim() === String(idCap).trim());
    }
    if (!cap && window.listaCapacitacionesTemp) {
        cap = window.listaCapacitacionesTemp.find(c => String(c.id_cap).trim() === String(idCap).trim());
    }

    const nombreCursoFinal = cap?.nombre_curso || nombreCurso || idCap;
    const fechaCap = cap?.fecha || '';

    if (qrTituloModal) qrTituloModal.textContent = "Encuesta de Transferencia";
    if (qrSubtitulo) qrSubtitulo.textContent = `Evaluación de Transferencia: ${nombreCursoFinal}`;
    if (qrIdCapText) qrIdCapText.textContent = `ID CAP: ${idCap}`;

    contenedorJefaturas.innerHTML = `<p style="text-align:center; color:#64748b; padding:15px;">Obteniendo información de jefaturas y asistentes...</p>`;
    modalQR.style.display = "flex";

    const origin = window.location.origin;
    const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const rutaBase = `${origin}${path}`;

    try {
        let participantes = [];
        if (window.dbLocal && window.dbLocal.raw) {
            const todos = window.dbLocal.raw.leerTabla('asistentes') || [];
            participantes = todos.filter(a => String(a.id_cap).trim() === String(idCap).trim());
        }

        if (participantes.length === 0 && (window.supabaseCloudClient || window.supabaseClient || window.supabase)) {
            const db = window.supabaseCloudClient || window.supabaseClient || window.supabase;
            const { data, error } = await db
                .from("asistentes")
                .select("apellido, nombre, jefatura, legajo, manager")
                .eq("id_cap", idCap);
            
            if (!error && data) participantes = data;
        }

        // Agrupar por jefatura / responsable con nombres y legajos
        const gruposJefatura = {};
        const legajosJefatura = {};

        participantes.forEach(p => {
            let j = p.jefatura || p.manager;
            if (!j || j === '-' || j === 'Sin Jefatura Asignada' || j.trim() === '') {
                // Consultar en la base de dotación por legajo
                if (window.dbLocal && window.dbLocal.raw) {
                    const dota = window.dbLocal.raw.leerTabla('dotacion') || [];
                    const emp = dota.find(d => 
                        String(d.legajo).padStart(5, '0') === String(p.legajo).padStart(5, '0') || 
                        String(d.legajo) === String(p.legajo)
                    );
                    if (emp) {
                        j = emp.jefatura || emp.manager || emp.gerencia || 'Sin Jefatura Asignada';
                    }
                }
            }
            if (!j || j === '-' || j.trim() === '') {
                j = "Sin Jefatura Asignada";
            }
            
            if (!gruposJefatura[j]) {
                gruposJefatura[j] = [];
                legajosJefatura[j] = [];
            }
            
            const nombreCompleto = (p.apellido && p.nombre) 
                ? `${p.apellido}, ${p.nombre}` 
                : (p.apellido || p.nombre || `Legajo: ${p.legajo}`);

            gruposJefatura[j].push(nombreCompleto);
            if (p.legajo) {
                legajosJefatura[j].push(String(p.legajo).padStart(5, '0'));
            }
        });

        const clavesJefatura = Object.keys(gruposJefatura);

        if (clavesJefatura.length === 0) {
            const urlGen = `${rutaBase}transferencia.html?id_cap=${encodeURIComponent(idCap)}&curso=${encodeURIComponent(nombreCursoFinal)}&fecha=${encodeURIComponent(fechaCap)}`;
            contenedorJefaturas.innerHTML = `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; text-align:center; display:flex; flex-direction:column; align-items:center;">
                    <p style="margin:0 0 10px 0; font-size:13px; color:#64748b;">Enlace general de evaluación:</p>
                    <div id="qrUnico" style="display:flex; justify-content:center; margin-bottom:12px;"></div>
                    <button onclick="copiarAlPortapapeles('${urlGen}', this)" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">
                        📋 Copiar Enlace Directo
                    </button>
                    <a href="${urlGen}" target="_blank" style="font-size:13px; color:#0284c7; text-decoration:none; margin-top:8px; font-weight:600;">🔗 Abrir Encuesta</a>
                </div>
            `;
            new QRCode(document.getElementById("qrUnico"), {
                text: urlGen,
                width: 150,
                height: 150,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
            return;
        }

        contenedorJefaturas.innerHTML = "";
        clavesJefatura.forEach((jefatura, index) => {
            const nombresStr = gruposJefatura[jefatura].join(" | ");
            const legajosStr = legajosJefatura[jefatura].join(" | ");
            const urlJefe = `${rutaBase}transferencia.html?id_cap=${encodeURIComponent(idCap)}&curso=${encodeURIComponent(nombreCursoFinal)}&fecha=${encodeURIComponent(fechaCap)}&jefatura=${encodeURIComponent(jefatura)}&nombres=${encodeURIComponent(nombresStr)}&legajos=${encodeURIComponent(legajosStr)}`;
            const qrDivId = `qrJefe_${index}`;

            const cardHtml = document.createElement("div");
            cardHtml.style.cssText = "background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:15px; display:flex; flex-direction:column; gap:10px; margin-bottom:12px;";

            cardHtml.innerHTML = `
                <div style="border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    <h4 style="margin:0; color:#0f172a; font-size:15px;">👔 Jefatura: <span style="color:#0284c7;">${jefatura}</span></h4>
                    <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;"><strong>Colaboradores:</strong> ${nombresStr}</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px; justify-content:space-around; flex-wrap:wrap;">
                    <div id="${qrDivId}"></div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button onclick="copiarAlPortapapeles('${urlJefe}', this)" style="background:#18C48F; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer;">
                            📋 Copiar Enlace
                        </button>
                        <a href="${urlJefe}" target="_blank" style="font-size:12px; color:#0284c7; text-decoration:none; text-align:center; font-weight:600;">🔗 Abrir Encuesta</a>
                    </div>
                </div>
            `;

            contenedorJefaturas.appendChild(cardHtml);

            new QRCode(document.getElementById(qrDivId), {
                text: urlJefe,
                width: 120,
                height: 120,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        });

    } catch (err) {
        console.error("Error al procesar jefaturas para QR:", err);
        contenedorJefaturas.innerHTML = `<p style="color:red; text-align:center;">Ocurrió un error al cargar el desglose por jefatura.</p>`;
    }
};

// Copiar al portapapeles con feedback en el botón
window.copiarAlPortapapeles = function(texto, elementoBtn) {
    navigator.clipboard.writeText(texto).then(() => {
        const textoOriginal = elementoBtn.textContent;
        elementoBtn.textContent = "✅ ¡Copiado!";
        elementoBtn.style.background = "#10b981";
        setTimeout(() => {
            elementoBtn.textContent = textoOriginal;
            elementoBtn.style.background = "#18C48F";
        }, 2000);
    }).catch(err => {
        console.error("Error al copiar enlace:", err);
        alert("No se pudo copiar el enlace al portapapeles.");
    });
};

// Generar QR de Satisfacción normal
window.generarQRModal = function(idCap, nombreCurso) {
    const modalQR = document.getElementById("modalQR");
    const contenedorJefaturas = document.getElementById("contenedorJefaturas");
    const qrTituloModal = document.getElementById("qrTituloModal");
    const qrSubtitulo = document.getElementById("qrSubtitulo");
    const qrIdCapText = document.getElementById("qrIdCapText");

    if (!contenedorJefaturas || !modalQR) return;

    window.capEspecialSatisfaccionId = idCap;

    let cap = null;
    if (window.dbLocal && window.dbLocal.raw) {
        const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
        cap = caps.find(c => String(c.id_cap).trim() === String(idCap).trim());
    }
    if (!cap && window.listaCapacitacionesTemp) {
        cap = window.listaCapacitacionesTemp.find(c => String(c.id_cap).trim() === String(idCap).trim());
    }

    const nombreCursoFinal = cap?.nombre_curso || nombreCurso || idCap;
    const fechaCap = cap?.fecha || '';
    const instructorCap = [cap?.instructor_1, cap?.instructor_2, cap?.instructor, cap?.capacitador].filter(Boolean).join(', ') || '';

    if (qrTituloModal) qrTituloModal.textContent = "Encuesta de satisfacción de la actividad";
    if (qrSubtitulo) qrSubtitulo.textContent = nombreCursoFinal || "Evaluación de Satisfacción";
    if (qrIdCapText) qrIdCapText.textContent = `ID CAP: ${idCap}`;

    const origin = window.location.origin;
    const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const rutaBase = `${origin}${path}`;

    const urlEncuesta = `${rutaBase}encuesta.html?id_cap=${encodeURIComponent(idCap)}&curso=${encodeURIComponent(nombreCursoFinal)}&fecha=${encodeURIComponent(fechaCap)}&instructor=${encodeURIComponent(instructorCap)}`;

    contenedorJefaturas.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; background:#f8fafc; border-radius:12px; padding:15px;">
            <div id="qrSatGen"></div>
            <button onclick="copiarAlPortapapeles('${urlEncuesta}', this)" style="margin-top:12px; background:#18C48F; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">
                📋 Copiar Enlace
            </button>
            <a href="${urlEncuesta}" target="_blank" style="font-size:13px; color:#0284c7; text-decoration:none; margin-top:8px; font-weight:600;">
                🔗 Abrir Encuesta
            </a>
        </div>
    `;

    new QRCode(document.getElementById("qrSatGen"), {
        text: urlEncuesta,
        width: 180,
        height: 180,
        colorDark: "#1a252f",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });

    modalQR.style.display = "flex";
};

// Editar Programada
window.editarProgramada = function(idCap) {
    const cap = window.listaCapacitacionesTemp?.find(c => c.id_cap === idCap);
    if (!cap) return;
    localStorage.setItem("capacitacion_activa", JSON.stringify(cap));
    window.location.href = "capacitaciones.html";
};

// Continuar Clase (Siguiente Clase)
window.cargarSiguienteClase = async function(idCap) {
    const cap = window.listaCapacitacionesTemp?.find(c => c.id_cap === idCap) || 
                (window.dbLocal && window.dbLocal.raw ? window.dbLocal.raw.leerTabla('capacitaciones').find(c => c.id_cap === idCap) : null);
    if (!cap) return;

    let claseActual = parseInt(cap.clase_nro || "1", 10);
    let siguienteClase = claseActual + 1;
    const numClaseFormateado = String(siguienteClase).padStart(2, "0");
    const partes = idCap.split("-");

    if (partes.length >= 3) partes[3] = numClaseFormateado;
    const nuevoIdCap = partes.slice(0, 3).join("-") + "-" + numClaseFormateado;

    const nuevaClaseCap = {
        ...cap,
        id_cap: nuevoIdCap,
        clase_nro: String(siguienteClase),
        total_clases: cap.total_clases || "2",
        estado: cap.estado || "Programado",
        fecha: new Date().toISOString().split("T")[0]
    };

    localStorage.setItem("capacitacion_activa", JSON.stringify(nuevaClaseCap));
    window.location.href = "capacitaciones.html";
};

// Ver / Editar Finalizada protegida por credenciales de Administrador
let idCapParaEdicionFinalizada = null;

window.editarFinalizadaAdmin = function(idCap) {
    const cap = window.listaCapacitacionesTemp?.find(c => c.id_cap === idCap) ||
                (window.dbLocal && window.dbLocal.raw ? window.dbLocal.raw.leerTabla('capacitaciones').find(c => c.id_cap === idCap) : null);
    if (!cap) return;

    idCapParaEdicionFinalizada = idCap;

    const modalAdmin = document.getElementById("modalAdminAuth");
    const inputUser = document.getElementById("adminAuthUser");
    const inputPass = document.getElementById("adminAuthPass");
    const divError = document.getElementById("adminAuthError");

    if (divError) divError.style.display = "none";
    if (inputPass) inputPass.value = "";

    // Pre-cargar usuario si hay sesión activa
    let sesion = null;
    try {
        sesion = JSON.parse(localStorage.getItem("siga_usuario_activo") || "{}");
    } catch(e) {}

    if (inputUser) {
        inputUser.value = sesion && sesion.usuario ? sesion.usuario : "Admin";
    }

    if (modalAdmin) {
        modalAdmin.style.display = "flex";
        setTimeout(() => {
            if (inputPass) inputPass.focus();
        }, 100);
    } else {
        // Fallback si no está el modal
        procederEdicionFinalizada(cap);
    }
};

function procederEdicionFinalizada(cap) {
    localStorage.setItem("capacitacion_activa", JSON.stringify(cap));
    window.location.href = "capacitaciones.html";
}

// Configurar listeners del Modal de Autenticación Admin
document.addEventListener("DOMContentLoaded", () => {
    const modalAdmin = document.getElementById("modalAdminAuth");
    const btnCerrar = document.getElementById("btnCerrarAdminAuth");
    const btnCancelar = document.getElementById("btnCancelarAdminAuth");
    const formAuth = document.getElementById("formAdminAuth");

    const cerrarModalAuth = () => {
        if (modalAdmin) modalAdmin.style.display = "none";
        idCapParaEdicionFinalizada = null;
    };

    if (btnCerrar) btnCerrar.addEventListener("click", cerrarModalAuth);
    if (btnCancelar) btnCancelar.addEventListener("click", cerrarModalAuth);

    if (formAuth) {
        formAuth.addEventListener("submit", async (e) => {
            e.preventDefault();
            const inputUser = document.getElementById("adminAuthUser");
            const inputPass = document.getElementById("adminAuthPass");
            const divError = document.getElementById("adminAuthError");

            const usuario = (inputUser?.value || "").trim();
            const clave = (inputPass?.value || "").trim();

            if (!usuario || !clave) {
                if (divError) {
                    divError.textContent = "Por favor ingrese usuario y contraseña.";
                    divError.style.display = "block";
                }
                return;
            }

            let esValido = false;

            // 1. Verificación contra el usuario maestro 'Admin' / 'CFT2026'
            if (usuario.toLowerCase() === "admin" && clave.toUpperCase() === "CFT2026") {
                esValido = true;
            } else {
                // 2. Verificación contra profiles de la base de datos
                let usuarios = [];
                if (window.dbLocal && window.dbLocal.raw) {
                    usuarios = window.dbLocal.raw.leerTabla('profiles') || [];
                }
                if (usuarios.length === 0) {
                    try {
                        const raw = localStorage.getItem("SIGA_DB_profiles");
                        if (raw) usuarios = JSON.parse(raw);
                    } catch(e) {}
                }

                const uEncontrado = usuarios.find(u => 
                    String(u.usuario || '').trim().toLowerCase() === usuario.toLowerCase() &&
                    String(u.clave || '').trim() === clave &&
                    String(u.rol || '').trim().toLowerCase() === 'administrador'
                );

                if (uEncontrado) {
                    esValido = true;
                }
            }

            if (esValido) {
                const idTarget = idCapParaEdicionFinalizada;
                cerrarModalAuth();

                let cap = window.listaCapacitacionesTemp?.find(c => c.id_cap === idTarget);
                if (!cap && window.dbLocal && window.dbLocal.raw) {
                    const todasCaps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
                    cap = todasCaps.find(c => c.id_cap === idTarget);
                }
                if (!cap) {
                    try {
                        const raw = localStorage.getItem("SIGA_DB_capacitaciones");
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            cap = parsed.find(c => c.id_cap === idTarget);
                        }
                    } catch(e) {}
                }

                if (!cap && idTarget) {
                    cap = { id_cap: idTarget, estado: 'Finalizado' };
                }

                if (cap) {
                    procederEdicionFinalizada(cap);
                }
            } else {
                if (divError) {
                    divError.textContent = "Credenciales incorrectas o el usuario no posee rol Administrador.";
                    divError.style.display = "block";
                }
            }
        });
    }
});

// Ver Finalizada (mantiene compatibilidad)
window.verFinalizada = window.editarFinalizadaAdmin;

// Imprimir Planilla Histórica
window.imprimirPlanillaHistorica = function(idCap) {
    if (!idCap) return;
    window.open(`planilla_asistencia.html?id_cap=${encodeURIComponent(idCap)}`, '_blank');
};

// Buscador Modal
function filtrarModal() {
    const input = document.getElementById('inputBuscarModal');
    if (!input) return;

    const termino = input.value.toLowerCase().trim();
    const filas = document.querySelectorAll('#tbodyCapacitaciones tr');

    filas.forEach(fila => {
        if (fila.children.length <= 1) return;
        const textoFila = fila.textContent.toLowerCase();
        fila.style.display = textoFila.includes(termino) ? '' : 'none';
    });
}
