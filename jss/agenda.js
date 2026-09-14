// ===================================================
// SIGA-AP - LÓGICA DE AGENDA CON PERSISTENCIA LOCAL Y FECHAS DINÁMICAS
// ===================================================

let fechaActual = new Date();
let capacitacionesMes = [];
let todasLasCapacitaciones = [];

document.addEventListener("DOMContentLoaded", () => {
    configurarControles();
    cargarAgendaCompleta();
});

function obtenerDB() {
    return window.supabaseClient || window.supabase || window.dbLocal || null;
}

// Normalizador seguro de fechas (Excel serial, ISO, DD/MM/AAAA) a YYYY-MM-DD
function aFechaISO(val) {
    if (!val) return "";
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 75000) {
        const ms = Math.round((num - 25569) * 86400 * 1000);
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
            const anio = d.getUTCFullYear();
            const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
            const dia = String(d.getUTCDate()).padStart(2, "0");
            return `${anio}-${mes}-${dia}`;
        }
    }
    const str = String(val).trim();
    if (str.includes("/")) {
        const partes = str.split("/");
        if (partes.length === 3) {
            const dia = partes[0].padStart(2, "0");
            const mes = partes[1].padStart(2, "0");
            const anio = partes[2].length === 2 ? "20" + partes[2] : partes[2];
            return `${anio}-${mes}-${dia}`;
        }
    }
    if (str.includes("T")) {
        return str.split("T")[0];
    }
    return str;
}

// Función para obtener la Fecha Obj. Tra. (+90 días de cursada si no existe en DB)
function calcularFechaObjTra(item) {
    if (item.fecha_tra && String(item.fecha_tra).trim() !== "") {
        return aFechaISO(item.fecha_tra);
    }
    const fechaBaseISO = aFechaISO(item.fecha || item.fecha_curso);
    if (!fechaBaseISO) return null;

    const partes = fechaBaseISO.split("-");
    if (partes.length !== 3) return null;

    const [a, m, d] = partes.map(num => parseInt(num, 10));
    if (isNaN(a) || isNaN(m) || isNaN(d)) return null;

    const fechaBase = new Date(a, m - 1, d);
    fechaBase.setDate(fechaBase.getDate() + 90); // 90 días post-cursada

    const anio = fechaBase.getFullYear();
    const mes = String(fechaBase.getMonth() + 1).padStart(2, "0");
    const dia = String(fechaBase.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

let catalogoCursos = [];

async function cargarCatalogoCursos() {
    try {
        if (window.dbLocal && window.dbLocal.raw && typeof window.dbLocal.raw.leerTabla === 'function') {
            const curDb = window.dbLocal.raw.leerTabla('cursos');
            if (Array.isArray(curDb) && curDb.length > 0) {
                catalogoCursos = curDb;
                return;
            }
        }
        const db = obtenerDB();
        if (db && typeof db.from === 'function') {
            const { data } = await db.from('cursos').select('*');
            if (Array.isArray(data) && data.length > 0) {
                catalogoCursos = data;
                return;
            }
        }
        const resp = await fetch('data/cursos.json');
        if (resp.ok) {
            catalogoCursos = await resp.json();
        }
    } catch (err) {
        console.warn("Aviso al cargar catálogo de cursos para reportes:", err);
    }
}

function configurarControles() {
    document.getElementById("btnMesAnterior")?.addEventListener("click", () => {
        fechaActual.setMonth(fechaActual.getMonth() - 1);
        renderizarVistaAgenda();
    });

    document.getElementById("btnMesSiguiente")?.addEventListener("click", () => {
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        renderizarVistaAgenda();
    });

    const modal = document.getElementById("modalDia");
    document.getElementById("btnCerrarModalDia")?.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });

    configurarModalReporteAgenda();
}

async function cargarAgendaCompleta() {
    if (typeof window.normalizarEstadosSeriesCapacitaciones === 'function') {
        window.normalizarEstadosSeriesCapacitaciones();
    }
    await cargarCatalogoCursos();
    const db = obtenerDB();
    if (db) {
        try {
            const { data, error } = await db
                .from("capacitaciones")
                .select("*");

            if (!error && data) {
                // Normalizar fechas de cada capacitación
                todasLasCapacitaciones = data.map(c => ({
                    ...c,
                    fecha: aFechaISO(c.fecha || c.fecha_curso),
                    fecha_tra: c.fecha_tra ? aFechaISO(c.fecha_tra) : ""
                }));
            }
        } catch (err) {
            console.error("Error al cargar capacitaciones para agenda:", err);
        }
    }
    renderizarVistaAgenda();
}

function renderizarVistaAgenda() {
    const txtMesAno = document.getElementById("txtMesAno");
    const anio = fechaActual.getFullYear();
    const mes = fechaActual.getMonth();

    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    if (txtMesAno) txtMesAno.textContent = `${nombresMeses[mes]} ${anio}`;

    const mesStr = String(mes + 1).padStart(2, "0");
    const prefijoAnioMes = `${anio}-${mesStr}`;
    
    // Capacitaciones dictadas en este mes
    capacitacionesMes = todasLasCapacitaciones.filter(c => c.fecha && c.fecha.startsWith(prefijoAnioMes));

    renderizarBannerResumenAnual(anio, mes, nombresMeses);
    renderizarGridCalendario(anio, mes);
}

function renderizarBannerResumenAnual(anioActual, mesActual, nombresMeses) {
    const elBanner = document.getElementById("resumenAnualAgenda");
    if (!elBanner) return;

    const conteoPorMes = Array(12).fill(0);

    todasLasCapacitaciones.forEach(item => {
        if (!item.fecha) return;
        const partes = item.fecha.split("-");
        if (partes.length >= 2) {
            const a = parseInt(partes[0], 10);
            const m = parseInt(partes[1], 10);
            if (a === anioActual) {
                const indexMes = m - 1;
                if (indexMes >= 0 && indexMes < 12) {
                    conteoPorMes[indexMes]++;
                }
            }
        }
    });

    const mesesConActividad = [];
    conteoPorMes.forEach((cant, idx) => {
        if (cant > 0 && idx !== mesActual) {
            mesesConActividad.push(`<strong>${cant}</strong> en ${nombresMeses[idx]}`);
        }
    });

    if (mesesConActividad.length === 0) {
        elBanner.innerHTML = `<span style="color:#64748b; font-weight:500;">📅 Panorama: no hay actividades registradas en otros meses de ${anioActual}.</span>`;
    } else {
        elBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:13px; color:#1e293b;">
                <span>📌 <strong>Actividades agendadas en otros meses (${anioActual}):</strong></span>
                <span style="background:#e2e8f0; padding:4px 10px; border-radius:6px;">
                    ${mesesConActividad.join(" &nbsp;|&nbsp; ")}
                </span>
            </div>
        `;
    }
}

function renderizarGridCalendario(anio, mes) {
    const gridDias = document.getElementById("gridDias");
    if (!gridDias) return;

    gridDias.innerHTML = "";

    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const totalDiasMes = new Date(anio, mes + 1, 0).getDate();
    
    // Fecha actual real
    const hoyObj = new Date();
    const hoyStr = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, "0")}-${String(hoyObj.getDate()).padStart(2, "0")}`;

    for (let i = 0; i < primerDiaSemana; i++) {
        const celdaVacia = document.createElement("div");
        celdaVacia.className = "dia-celda vacio";
        gridDias.appendChild(celdaVacia);
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const celda = document.createElement("div");
        celda.className = "dia-celda";

        const diaPadded = String(dia).padStart(2, "0");
        const mesPadded = String(mes + 1).padStart(2, "0");
        const fechaStr = `${anio}-${mesPadded}-${diaPadded}`;

        // 1. Cursadas normales dictadas en este día
        const eventosDelDia = capacitacionesMes.filter(c => c.fecha === fechaStr);

        // 2. Transferencias (Finalizadas y SOLO si requiere_transferencia está en 'SI')
        const transferenciasDelDia = todasLasCapacitaciones.filter(c => {
            if (c.estado !== "Finalizado") return false;

            const reqT = String(c.requiere_transferencia || '').trim().toUpperCase();
            if (reqT !== 'SI' && reqT !== 'SÍ' && reqT !== 'TRUE') return false;

            const estadoTra = (c.estado_tra || "Pendiente").trim();
            if (["Enviada", "Recibida", "No Aplica"].includes(estadoTra)) return false;

            const fechaObjTra = calcularFechaObjTra(c);
            if (!fechaObjTra) return false;

            // Coincide con la fecha objetivo en el calendario
            if (fechaObjTra === fechaStr) return true;

            // Retrasos atrasados acumulados que se muestran en el día de HOY
            if (fechaObjTra < hoyStr && fechaStr === hoyStr) return true;

            return false;
        });

        celda.innerHTML = `<div class="numero-dia">${dia}</div>`;

        // Renderizar tags de Cursadas
        eventosDelDia.forEach(item => {
            const tag = document.createElement("div");
            let claseEstado = "tag-programado";

            if (item.estado === "En curso") claseEstado = "tag-encurso";
            if (item.estado === "Finalizado") claseEstado = "tag-finalizado";

            tag.className = `evento-tag ${claseEstado}`;
            tag.textContent = item.nombre_curso || item.id_cap;
            celda.appendChild(tag);
        });

        // Renderizar tags de Transferencia
        transferenciasDelDia.forEach(item => {
            const tagTra = document.createElement("div");
            const fechaObjTra = calcularFechaObjTra(item);
            const esAtrasado = fechaObjTra < hoyStr;

            let colorBg = esAtrasado ? "#dc2626" : "#f59e0b";
            let prefijo = esAtrasado ? "🚨 TRA VENCIDA:" : "⚠️ ENVIAR TRA:";

            tagTra.className = "evento-tag";
            tagTra.style.cssText = `background-color: ${colorBg}; color: #ffffff; font-weight: 700; border-radius: 4px; padding: 2px 5px; font-size: 10px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
            tagTra.textContent = `${prefijo} ${item.nombre_curso || item.id_cap}`;

            celda.appendChild(tagTra);
        });

        celda.addEventListener("click", () => {
            abrirModalDetalleDia(fechaStr, eventosDelDia, transferenciasDelDia);
        });

        gridDias.appendChild(celda);
    }
}

function abrirModalDetalleDia(fechaStr, listaEventos, listaTransferencias = []) {
    const modal = document.getElementById("modalDia");
    const titulo = document.getElementById("tituloModalDia");
    const tbody = document.getElementById("tbodyDia");

    if (!modal || !tbody) return;

    const [a, m, d] = fechaStr.split("-");
    if (titulo) titulo.textContent = `Actividades del ${d}/${m}/${a}`;

    tbody.innerHTML = "";

    const totalActividades = (listaEventos ? listaEventos.length : 0) + (listaTransferencias ? listaTransferencias.length : 0);

    if (totalActividades === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:20px; color:#888;">
                    No hay capacitaciones ni transferencias programadas para este día.
                </td>
            </tr>
        `;
        modal.style.display = "flex";
        return;
    }

    // 1. Mostrar Cursadas
    if (listaEventos && listaEventos.length > 0) {
        listaEventos.forEach(item => {
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid #eee";

            const hIni = item.hs_inicio || item.hora_inicio || item.horario_inicio || (item.horario && item.horario.includes('a') ? item.horario.split('a')[0].trim() : '');
            const hFin = item.hs_fin || item.hora_fin || item.horario_fin || (item.horario && item.horario.includes('a') ? item.horario.split('a')[1].trim() : '');
            let horario = "-";
            if (hIni && hFin && hIni !== '-' && hFin !== '-') {
                horario = `${hIni} a ${hFin}`;
            } else if (hIni && hIni !== '-') {
                horario = `${hIni} hs`;
            } else if (item.horario && item.horario !== '-') {
                horario = item.horario;
            } else if (item.duracion_horas || item.duracion) {
                horario = `${item.duracion_horas || item.duracion} hs`;
            }
            let badge = "";
            let btnAccion = "";

            if (item.estado === "Programado") {
                badge = `<span class="badge badge-prog">Programada</span>`;
                btnAccion = `<button onclick="window.location.href='actividades.html'" style="background:#27ae60; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Ir a Iniciar</button>`;
            } else if (item.estado === "En curso") {
                badge = `<span class="badge badge-curso">En Curso</span>`;
                btnAccion = `<button onclick="window.location.href='actividades.html'" style="background:#2980b9; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Continuar</button>`;
            } else {
                badge = `<span class="badge badge-fin">Finalizada</span>`;
                btnAccion = `<button onclick="window.location.href='actividades.html'" style="background:#7f8c8d; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Ver</button>`;
            }

            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold;">${item.id_cap}</td>
                <td style="padding:10px;">${item.nombre_curso || "-"}</td>
                <td style="padding:10px;">${horario}</td>
                <td style="padding:10px;">${badge}</td>
                <td style="padding:10px; text-align:center;">${btnAccion}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 2. Mostrar Transferencias
    if (listaTransferencias && listaTransferencias.length > 0) {
        listaTransferencias.forEach(item => {
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid #eee";
            tr.style.backgroundColor = "#fffbeb";

            const fechaObjTra = calcularFechaObjTra(item);
            const hoyObj = new Date();
            const hoyStr = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, "0")}-${String(hoyObj.getDate()).padStart(2, "0")}`;
            const esAtrasado = fechaObjTra < hoyStr;

            const badge = esAtrasado 
                ? `<span style="background:#dc2626; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">🚨 Tra Vencida</span>`
                : `<span style="background:#f59e0b; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">⚠️ Tra Pendiente</span>`;

            const btnAccion = `<button onclick="window.location.href='actividades.html'" style="background:#ea580c; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Gestionar TRA</button>`;

            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold; color:#b45309;">${item.id_cap}</td>
                <td style="padding:10px;"><strong>Evaluación de Transferencia:</strong> ${item.nombre_curso || "-"}</td>
                <td style="padding:10px; font-size:12px; color:#666;">Obj: ${fechaObjTra || "-"}</td>
                <td style="padding:10px;">${badge}</td>
                <td style="padding:10px; text-align:center;">${btnAccion}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    modal.style.display = "flex";
}

// ===================================================
// MÓDULO: GENERADOR DE REPORTE EN PDF DE LA AGENDA
// ===================================================

let reporteActividadesOmitidas = new Set();
let reporteOcultarOmitidas = false;
let reporteActividadesPeriodo = [];

function formatearFechaLatina(fechaISO) {
    if (!fechaISO) return "-";
    const partes = String(fechaISO).split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaISO;
}

function obtenerDetalleCurso(item) {
    const nomCap = String(item.nombre_curso || item.curso || "").trim().toLowerCase();
    const codCap = String(item.codigo_curso || "").trim().toLowerCase();

    let cursoMatch = catalogoCursos.find(c => {
        const codCur = String(c.codigo_curso || c.codigo || "").trim().toLowerCase();
        if (codCap && codCur === codCap) return true;
        const nomCur = String(c.nombre || c.nombre_curso || "").trim().toLowerCase();
        return nomCur && nomCur === nomCap;
    });

    if (!cursoMatch && nomCap) {
        cursoMatch = catalogoCursos.find(c => {
            const nomCur = String(c.nombre || c.nombre_curso || "").trim().toLowerCase();
            return nomCur && (nomCur.includes(nomCap) || nomCap.includes(nomCur));
        });
    }

    const codigo = cursoMatch?.codigo_curso || item.codigo_curso || "S/C";
    const nombre = cursoMatch?.nombre || item.nombre_curso || item.curso || "Capacitación sin nombre";
    const modalidad = cursoMatch?.modalidad || item.modalidad || "Presencial";
    const hsTeo = cursoMatch?.hs_teoria !== undefined && cursoMatch?.hs_teoria !== null ? cursoMatch.hs_teoria : (item.hs_teoria || "-");
    const hsPrac = cursoMatch?.hs_practica !== undefined && cursoMatch?.hs_practica !== null ? cursoMatch.hs_practica : (item.hs_practica || "-");
    let hsTot = cursoMatch?.hs_totales || cursoMatch?.carga_horaria || item.duracion_hs || item.horas || item.duracion;
    if (!hsTot && hsTeo !== "-" && hsPrac !== "-") {
        hsTot = (Number(hsTeo) || 0) + (Number(hsPrac) || 0);
    }
    const contenido = cursoMatch?.contenido || cursoMatch?.objetivo || item.tema || item.observaciones || "";
    const estadoCurso = cursoMatch?.estado || "Activo";

    return {
        codigo,
        nombre,
        modalidad,
        hs_teoria: hsTeo,
        hs_practica: hsPrac,
        hs_totales: hsTot || "-",
        contenido,
        estado_curso: estadoCurso
    };
}

function obtenerHorarioItem(item) {
    const hIni = item.hs_inicio || item.hora_inicio || item.horario_inicio || (item.horario && item.horario.includes("a") ? item.horario.split("a")[0].trim() : "");
    const hFin = item.hs_fin || item.hora_fin || item.horario_fin || (item.horario && item.horario.includes("a") ? item.horario.split("a")[1].trim() : "");
    if (hIni && hFin && hIni !== "-" && hFin !== "-") {
        return `${hIni} a ${hFin} hs`;
    } else if (hIni && hIni !== "-") {
        return `${hIni} hs`;
    } else if (item.horario && item.horario !== "-") {
        return item.horario;
    } else if (item.duracion_hs || item.duracion) {
        return `Duración: ${item.duracion_hs || item.duracion} hs`;
    }
    return "-";
}

function calcularRangoPreset(preset) {
    const hoy = new Date();
    if (preset === "esta_semana" || preset === "proxima_semana" || preset === "semana_anterior") {
        let offset = 0;
        if (preset === "proxima_semana") offset = 7;
        if (preset === "semana_anterior") offset = -7;

        const ref = new Date(hoy);
        ref.setDate(ref.getDate() + offset);
        const day = ref.getDay(); // 0 Dom, 1 Lun...
        const diffToMonday = ref.getDate() - day + (day === 0 ? -6 : 1);
        const lunes = new Date(ref.setDate(diffToMonday));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);

        return {
            desde: lunes.toISOString().split("T")[0],
            hasta: domingo.toISOString().split("T")[0],
            descripcion: `Semana del ${formatearFechaLatina(lunes.toISOString().split("T")[0])} al ${formatearFechaLatina(domingo.toISOString().split("T")[0])}`
        };
    } else if (preset === "mes_visible") {
        const y = fechaActual.getFullYear();
        const m = fechaActual.getMonth();
        const primero = new Date(y, m, 1);
        const ultimo = new Date(y, m + 1, 0);
        return {
            desde: primero.toISOString().split("T")[0],
            hasta: ultimo.toISOString().split("T")[0],
            descripcion: `Mes actual de agenda (${primero.toLocaleDateString("es-AR", { month: "long", year: "numeric" })})`
        };
    } else if (preset === "mes_completo") {
        const y = hoy.getFullYear();
        const m = hoy.getMonth();
        const primero = new Date(y, m, 1);
        const ultimo = new Date(y, m + 1, 0);
        return {
            desde: primero.toISOString().split("T")[0],
            hasta: ultimo.toISOString().split("T")[0],
            descripcion: `Mes calendario actual (${primero.toLocaleDateString("es-AR", { month: "long", year: "numeric" })})`
        };
    }

    return {
        desde: hoy.toISOString().split("T")[0],
        hasta: hoy.toISOString().split("T")[0],
        descripcion: "Período personalizado"
    };
}

function configurarModalReporteAgenda() {
    const btnAbrir = document.getElementById("btnAbrirModalReporteAgenda");
    const modal = document.getElementById("modalReporteAgenda");
    const btnCerrar = document.getElementById("btnCerrarModalReporte");
    const btnCerrarSec = document.getElementById("btnCerrarModalReporteSec");
    const inpDesde = document.getElementById("repFechaDesde");
    const inpHasta = document.getElementById("repFechaHasta");

    if (!btnAbrir || !modal) return;

    btnAbrir.addEventListener("click", () => {
        // Inicializar con "esta_semana" si no hay fechas
        if (!inpDesde.value || !inpHasta.value) {
            aplicarPresetRango("esta_semana");
        } else {
            actualizarListaReporte();
        }
        modal.style.display = "flex";
    });

    const cerrarModal = () => {
        modal.style.display = "none";
        document.getElementById("seccionVistaPreviaPdf").style.display = "none";
    };

    btnCerrar?.addEventListener("click", cerrarModal);
    btnCerrarSec?.addEventListener("click", cerrarModal);

    window.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModal();
    });

    // Presets de Rango
    document.querySelectorAll(".btn-preset-rango").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-preset-rango").forEach(b => b.classList.remove("activo"));
            btn.classList.add("activo");
            aplicarPresetRango(btn.getAttribute("data-preset"));
        });
    });

    // Cambio manual de fechas
    inpDesde?.addEventListener("change", () => {
        desmarcarPresets();
        actualizarListaReporte();
    });
    inpHasta?.addEventListener("change", () => {
        desmarcarPresets();
        actualizarListaReporte();
    });

    // Checkboxes de estado
    document.getElementById("chkEstadoFin")?.addEventListener("change", actualizarListaReporte);
    document.getElementById("chkEstadoCurso")?.addEventListener("change", actualizarListaReporte);
    document.getElementById("chkEstadoProg")?.addEventListener("change", actualizarListaReporte);

    // Acciones de verificación
    document.getElementById("btnRepSeleccionarTodas")?.addEventListener("click", () => {
        reporteActividadesOmitidas.clear();
        renderizarListaVerificacion();
    });

    document.getElementById("btnRepDeseleccionarTodas")?.addEventListener("click", () => {
        reporteActividadesPeriodo.forEach(item => {
            const idKey = item.id_cap || `${item.fecha}_${item.nombre_curso}`;
            reporteActividadesOmitidas.add(idKey);
        });
        renderizarListaVerificacion();
    });

    const btnToggleOcultas = document.getElementById("btnRepToggleOcultas");
    btnToggleOcultas?.addEventListener("click", () => {
        reporteOcultarOmitidas = !reporteOcultarOmitidas;
        btnToggleOcultas.textContent = reporteOcultarOmitidas ? "👁️ Ver Todas" : "👁️ Ocultar Omitidas";
        btnToggleOcultas.style.background = reporteOcultarOmitidas ? "#0f172a" : "#ffffff";
        btnToggleOcultas.style.color = reporteOcultarOmitidas ? "#ffffff" : "#475569";
        renderizarListaVerificacion();
    });

    // Vista Previa
    document.getElementById("btnVerVistaPreviaReporte")?.addEventListener("click", () => {
        const wrapPrevia = document.getElementById("seccionVistaPreviaPdf");
        const contPrevia = document.getElementById("contenedorPrevisualizacionHtml");
        const orientacion = document.querySelector('input[name="orientacionPdf"]:checked')?.value || "landscape";
        
        const incluidas = reporteActividadesPeriodo.filter(item => {
            const idKey = item.id_cap || `${item.fecha}_${item.nombre_curso}`;
            return !reporteActividadesOmitidas.has(idKey);
        });

        if (incluidas.length === 0) {
            mostrarAvisoTemporal("No hay actividades seleccionadas para previsualizar. Marque al menos una.");
            return;
        }

        const html = generarHtmlReporteImprimible(incluidas, {
            desde: inpDesde.value,
            hasta: inpHasta.value
        }, orientacion);

        contPrevia.innerHTML = html;
        wrapPrevia.style.display = "block";
        wrapPrevia.scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("btnOcultarVistaPrevia")?.addEventListener("click", () => {
        document.getElementById("seccionVistaPreviaPdf").style.display = "none";
    });

    // Imprimir
    document.getElementById("btnImprimirReporteAgenda")?.addEventListener("click", () => {
        ejecutarImpresionReporte();
    });

    // Descargar PDF
    document.getElementById("btnGenerarPdfAgenda")?.addEventListener("click", () => {
        ejecutarDescargaPdfReporte();
    });
}

function desmarcarPresets() {
    document.querySelectorAll(".btn-preset-rango").forEach(b => b.classList.remove("activo"));
}

function aplicarPresetRango(preset) {
    const rango = calcularRangoPreset(preset);
    const inpDesde = document.getElementById("repFechaDesde");
    const inpHasta = document.getElementById("repFechaHasta");
    const lblInfo = document.getElementById("lblInfoRangoFechas");

    if (inpDesde) inpDesde.value = rango.desde;
    if (inpHasta) inpHasta.value = rango.hasta;
    if (lblInfo) lblInfo.textContent = rango.descripcion;

    actualizarListaReporte();
}

function actualizarListaReporte() {
    const fDesde = document.getElementById("repFechaDesde")?.value || "";
    const fHasta = document.getElementById("repFechaHasta")?.value || "";
    const chkFin = document.getElementById("chkEstadoFin")?.checked ?? true;
    const chkCurso = document.getElementById("chkEstadoCurso")?.checked ?? true;
    const chkProg = document.getElementById("chkEstadoProg")?.checked ?? true;

    // Filtrar de todasLasCapacitaciones
    reporteActividadesPeriodo = todasLasCapacitaciones.filter(item => {
        const fecha = item.fecha || "";
        if (fDesde && fecha < fDesde) return false;
        if (fHasta && fecha > fHasta) return false;

        const est = String(item.estado || "").toLowerCase();
        if ((est.includes("finaliz")) && !chkFin) return false;
        if ((est.includes("curso")) && !chkCurso) return false;
        if ((est.includes("prog")) && !chkProg) return false;

        return true;
    });

    // Ordenar cronológicamente por fecha y horario
    reporteActividadesPeriodo.sort((a, b) => {
        const fa = a.fecha || "";
        const fb = b.fecha || "";
        if (fa !== fb) return fa.localeCompare(fb);
        const ha = a.hs_inicio || "";
        const hb = b.hs_inicio || "";
        return ha.localeCompare(hb);
    });

    // Actualizar badge de texto descriptivo si es personalizado
    const lblInfo = document.getElementById("lblInfoRangoFechas");
    if (lblInfo && fDesde && fHasta) {
        lblInfo.textContent = `Del ${formatearFechaLatina(fDesde)} al ${formatearFechaLatina(fHasta)}`;
    }

    renderizarListaVerificacion();
}

function renderizarListaVerificacion() {
    const contenedor = document.getElementById("contenedorListaVerificacion");
    const lblConteo = document.getElementById("lblConteoSeleccionadas");
    if (!contenedor) return;

    if (reporteActividadesPeriodo.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align:center; padding:35px 20px; color:#64748b; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
                <span style="font-size:32px; display:block; margin-bottom:8px;">📅</span>
                <strong style="color:#1e293b; font-size:0.95rem;">No se encontraron actividades en el período seleccionado.</strong>
                <p style="margin:6px 0 0 0; font-size:0.82rem;">Pruebe ampliando el rango de fechas o activando más estados de actividad.</p>
            </div>
        `;
        if (lblConteo) lblConteo.textContent = "0 actividades";
        return;
    }

    let conteoIncluidas = 0;
    let conteoOmitidas = 0;

    let htmlCards = "";

    reporteActividadesPeriodo.forEach((item, idx) => {
        const idKey = item.id_cap || `${item.fecha}_${item.nombre_curso}_${idx}`;
        const estaOmitida = reporteActividadesOmitidas.has(idKey);

        if (estaOmitida) {
            conteoOmitidas++;
            if (reporteOcultarOmitidas) return; // Si el usuario eligió ocultar las omitidas
        } else {
            conteoIncluidas++;
        }

        const est = String(item.estado || "").toLowerCase();
        let claseEstado = "card-programado";
        let badgeEstadoHtml = `<span class="badge badge-prog" style="font-size:0.75rem;">Programada</span>`;
        if (est.includes("finaliz")) {
            claseEstado = "card-finalizado";
            badgeEstadoHtml = `<span class="badge badge-fin" style="font-size:0.75rem;">Finalizada</span>`;
        } else if (est.includes("curso")) {
            claseEstado = "card-encurso";
            badgeEstadoHtml = `<span class="badge badge-curso" style="font-size:0.75rem;">En Curso</span>`;
        }

        const detCurso = obtenerDetalleCurso(item);
        const horario = obtenerHorarioItem(item);
        const instructor = item.instructor_1 ? (item.instructor_2 ? `${item.instructor_1}, ${item.instructor_2}` : item.instructor_1) : (item.instructor || item.docente || "-");
        const lugar = item.lugar || item.aula || item.centro || "CFT";

        htmlCards += `
            <div class="verif-card ${claseEstado} ${estaOmitida ? 'omitida' : ''}" id="verifCard_${idKey}">
                <div class="verif-card-header">
                    <div class="verif-header-izq">
                        <input type="checkbox" class="verif-checkbox" 
                            id="chkInc_${idKey}" 
                            data-id="${idKey}" 
                            ${estaOmitida ? '' : 'checked'}
                            title="${estaOmitida ? 'Marcar para incluir en el reporte' : 'Desmarcar para quitar del reporte'}">
                        
                        <span class="verif-id-badge">${item.id_cap || 'CAP'}</span>
                        ${badgeEstadoHtml}
                        <span class="verif-fecha-hora">📅 ${formatearFechaLatina(item.fecha)} | ⏰ ${horario}</span>
                    </div>

                    <button type="button" 
                        class="btn-toggle-incluir ${estaOmitida ? 'btn-incluir' : 'btn-quitar'}"
                        data-id="${idKey}">
                        ${estaOmitida ? '➕ Re-incluir en reporte' : '🚫 Omitir del reporte'}
                    </button>
                </div>

                <h4 class="verif-curso-titulo">
                    <span>📘 ${detCurso.nombre}</span>
                    ${detCurso.codigo !== '-' ? `<span style="font-size:0.75rem; font-weight:700; color:#0369a1; background:#e0f2fe; padding:2px 7px; border-radius:4px;">Cód: ${detCurso.codigo}</span>` : ''}
                </h4>

                <!-- Bloque de Datos del Curso (Foto 2) -->
                <div class="verif-curso-detalles">
                    <div class="verif-dato-item">
                        <span>Modalidad:</span>
                        <strong>${detCurso.modalidad}</strong>
                    </div>
                    <div class="verif-dato-item">
                        <span>Hs Teoría:</span>
                        <strong>${detCurso.hs_teoria} hs</strong>
                    </div>
                    <div class="verif-dato-item">
                        <span>Hs Práctica:</span>
                        <strong>${detCurso.hs_practica} hs</strong>
                    </div>
                    <div class="verif-dato-item">
                        <span>Carga Horaria:</span>
                        <strong>${detCurso.hs_totales} hs</strong>
                    </div>
                    <div class="verif-dato-item">
                        <span>Instructor:</span>
                        <strong>${instructor}</strong>
                    </div>
                    <div class="verif-dato-item">
                        <span>Lugar:</span>
                        <strong>${lugar}</strong>
                    </div>
                </div>

                ${detCurso.contenido ? `<div class="verif-contenido-txt">📝 <strong>Contenido/Tema:</strong> ${detCurso.contenido}</div>` : ''}
            </div>
        `;
    });

    contenedor.innerHTML = htmlCards;

    if (lblConteo) {
        lblConteo.textContent = `${conteoIncluidas} de ${reporteActividadesPeriodo.length} seleccionadas ${conteoOmitidas > 0 ? `(${conteoOmitidas} omitidas)` : ''}`;
    }

    // Vincular eventos de toggle en checkboxes y botones de las tarjetas
    contenedor.querySelectorAll(".verif-checkbox").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const idKey = e.target.getAttribute("data-id");
            if (e.target.checked) {
                reporteActividadesOmitidas.delete(idKey);
            } else {
                reporteActividadesOmitidas.add(idKey);
            }
            renderizarListaVerificacion();
        });
    });

    contenedor.querySelectorAll(".btn-toggle-incluir").forEach(btn => {
        btn.addEventListener("click", () => {
            const idKey = btn.getAttribute("data-id");
            if (reporteActividadesOmitidas.has(idKey)) {
                reporteActividadesOmitidas.delete(idKey);
            } else {
                reporteActividadesOmitidas.add(idKey);
            }
            renderizarListaVerificacion();
        });
    });
}

function generarHtmlReporteImprimible(actividades, rangoFechas, orientacion) {
    let cantProg = 0;
    let cantCurso = 0;
    let cantFin = 0;
    let sumaHoras = 0;

    actividades.forEach(item => {
        const est = String(item.estado || "").toLowerCase();
        if (est.includes("finaliz")) cantFin++;
        else if (est.includes("curso")) cantCurso++;
        else cantProg++;

        const dur = Number(item.duracion_hs || item.horas || item.duracion) || 0;
        sumaHoras += dur;
    });

    const fechaHoyStr = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const horaHoyStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    let filasTablaHtml = "";

    actividades.forEach((item, idx) => {
        const detCurso = obtenerDetalleCurso(item);
        const horario = obtenerHorarioItem(item);
        const instructor = item.instructor_1 ? (item.instructor_2 ? `${item.instructor_1}, ${item.instructor_2}` : item.instructor_1) : (item.instructor || item.docente || "-");
        const lugar = item.lugar || item.aula || item.centro || "CFT";

        const est = String(item.estado || "").toLowerCase();
        let badgeClase = "pdf-badge-programada";
        let estadoNombre = "Programada";
        if (est.includes("finaliz")) {
            badgeClase = "pdf-badge-finalizada";
            estadoNombre = "Finalizada";
        } else if (est.includes("curso")) {
            badgeClase = "pdf-badge-encurso";
            estadoNombre = "En Curso";
        }

        filasTablaHtml += `
            <tr style="page-break-inside: avoid;">
                <td style="width: 14%; font-weight:600;">
                    <div style="font-size:10px; color:#0f172a; font-weight:800;">${formatearFechaLatina(item.fecha)}</div>
                    <div style="color:#475569; font-size:8.5px; margin-top:2px;">⏰ ${horario}</div>
                    <div style="color:#64748b; font-size:8.5px; margin-top:2px;">📍 ${lugar}</div>
                </td>
                <td style="width: 13%;">
                    <div style="font-family:monospace; font-weight:800; font-size:9.5px; color:#1e293b;">${item.id_cap || '-'}</div>
                    <div style="margin-top:4px;"><span class="pdf-badge-estado ${badgeClase}">${estadoNombre}</span></div>
                    ${item.programa ? `<div style="font-size:8px; color:#64748b; margin-top:3px;">Prog: ${item.programa}</div>` : ''}
                </td>
                <td style="width: 48%;">
                    <div class="pdf-curso-nombre">${detCurso.nombre}</div>
                    <div class="pdf-curso-meta-grid">
                        <div><strong>Código:</strong> ${detCurso.codigo}</div>
                        <div><strong>Modalidad:</strong> ${detCurso.modalidad}</div>
                        <div><strong>Hs Teoría:</strong> ${detCurso.hs_teoria} hs | <strong>Hs Práctica:</strong> ${detCurso.hs_practica} hs</div>
                        <div><strong>Carga Total:</strong> ${detCurso.hs_totales} hs</div>
                        <div style="grid-column: span 2;"><strong>Instructor/Docente:</strong> ${instructor}</div>
                    </div>
                </td>
                <td style="width: 25%; font-size:8.5px; color:#334155;">
                    ${detCurso.contenido ? `<div><strong>Contenido/Tema:</strong><br>${detCurso.contenido}</div>` : (item.tema || item.observaciones ? `<div>${item.tema || item.observaciones}</div>` : '<span style="color:#94a3b8; font-style:italic;">Sin observaciones adicionales</span>')}
                </td>
            </tr>
        `;
    });

    return `
        <div class="pdf-hoja">
            <!-- Encabezado Institucional -->
            <div class="pdf-header">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div class="pdf-logo-box">
                        <h2>CFT</h2>
                        <p>Centro de Formación Técnica</p>
                    </div>
                    <div>
                        <div style="font-size:12px; font-weight:800; color:#1e293b; letter-spacing:0.5px;">SISTEMA INTEGRADO DE GESTIÓN Y APRENDIZAJE</div>
                        <div style="font-size:9.5px; color:#64748b; font-weight:600;">SIGA-AP • Coordinación y Planificación Académica</div>
                    </div>
                </div>

                <div class="pdf-header-titulos">
                    <h1>REPORTE DE ACTIVIDADES EN AGENDA</h1>
                    <div class="pdf-subtitulo">Período: Del ${formatearFechaLatina(rangoFechas.desde)} al ${formatearFechaLatina(rangoFechas.hasta)}</div>
                    <div class="pdf-meta">Emisión: ${fechaHoyStr} ${horaHoyStr} hs | Usuario: Ariel Pizzutto</div>
                </div>
            </div>

            <!-- Barra de Resumen Ejecutivo -->
            <div class="pdf-resumen-bar">
                <div class="pdf-resumen-item">
                    <span>Actividades Reportadas:</span>
                    <strong>${actividades.length}</strong>
                </div>
                <div class="pdf-resumen-item">
                    <span style="color:#16a34a; font-weight:700;">● Finalizadas:</span>
                    <strong>${cantFin}</strong>
                </div>
                <div class="pdf-resumen-item">
                    <span style="color:#0284c7; font-weight:700;">● En curso:</span>
                    <strong>${cantCurso}</strong>
                </div>
                <div class="pdf-resumen-item">
                    <span style="color:#d97706; font-weight:700;">● Programadas:</span>
                    <strong>${cantProg}</strong>
                </div>
                <div class="pdf-resumen-item">
                    <span>Carga Horaria Acumulada:</span>
                    <strong>${sumaHoras > 0 ? `${sumaHoras} hs` : '-'}</strong>
                </div>
            </div>

            <!-- Tabla de Actividades y Datos del Curso -->
            <table class="pdf-tabla-actividades">
                <thead>
                    <tr>
                        <th>Fecha & Horario</th>
                        <th>ID & Estado</th>
                        <th>Datos del Curso (Catálogo y Carga Horaria)</th>
                        <th>Contenido / Temario / Observaciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasTablaHtml}
                </tbody>
            </table>

            <!-- Pie de Documento Oficial -->
            <div class="pdf-footer-doc">
                <div>CFT Centro de Formación Técnica • SIGA-AP Plataforma de Gestión de Capacitaciones</div>
                <div>Documento de verificación oficial generado automáticamente</div>
            </div>
        </div>
    `;
}

function ejecutarImpresionReporte() {
    const inpDesde = document.getElementById("repFechaDesde");
    const inpHasta = document.getElementById("repFechaHasta");
    const orientacion = document.querySelector('input[name="orientacionPdf"]:checked')?.value || "landscape";

    const incluidas = reporteActividadesPeriodo.filter(item => {
        const idKey = item.id_cap || `${item.fecha}_${item.nombre_curso}`;
        return !reporteActividadesOmitidas.has(idKey);
    });

    if (incluidas.length === 0) {
        mostrarAvisoTemporal("No hay actividades seleccionadas para imprimir. Marque al menos una actividad.");
        return;
    }

    const contImprimible = document.getElementById("contenedorReporteImprimible");
    if (!contImprimible) return;

    contImprimible.innerHTML = generarHtmlReporteImprimible(incluidas, {
        desde: inpDesde?.value,
        hasta: inpHasta?.value
    }, orientacion);

    contImprimible.style.display = "block";
    window.print();
    setTimeout(() => {
        contImprimible.style.display = "none";
    }, 1000);
}

function ejecutarDescargaPdfReporte() {
    const inpDesde = document.getElementById("repFechaDesde");
    const inpHasta = document.getElementById("repFechaHasta");
    const orientacion = document.querySelector('input[name="orientacionPdf"]:checked')?.value || "landscape";

    const incluidas = reporteActividadesPeriodo.filter(item => {
        const idKey = item.id_cap || `${item.fecha}_${item.nombre_curso}`;
        return !reporteActividadesOmitidas.has(idKey);
    });

    if (incluidas.length === 0) {
        mostrarAvisoTemporal("No hay actividades seleccionadas para el reporte. Seleccione al menos una actividad.");
        return;
    }

    const contImprimible = document.getElementById("contenedorReporteImprimible");
    if (!contImprimible) return;

    contImprimible.innerHTML = generarHtmlReporteImprimible(incluidas, {
        desde: inpDesde?.value,
        hasta: inpHasta?.value
    }, orientacion);
    contImprimible.style.display = "block";

    const btnDescargar = document.getElementById("btnGenerarPdfAgenda");
    const textoOriginal = btnDescargar ? btnDescargar.innerHTML : "";
    if (btnDescargar) {
        btnDescargar.disabled = true;
        btnDescargar.innerHTML = `<span>⏳</span> Generando PDF...`;
    }

    const nombreArchivo = `Reporte_Agenda_${inpDesde?.value || 'inicio'}_al_${inpHasta?.value || 'fin'}.pdf`;

    if (typeof window.html2pdf === "function") {
        const opt = {
            margin: [8, 8, 8, 8],
            filename: nombreArchivo,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: "mm", format: "a4", orientation: orientacion }
        };

        window.html2pdf().set(opt).from(contImprimible).save().then(() => {
            contImprimible.style.display = "none";
            if (btnDescargar) {
                btnDescargar.disabled = false;
                btnDescargar.innerHTML = textoOriginal;
            }
            mostrarAvisoTemporal(`✓ Reporte PDF descargado: ${nombreArchivo}`);
        }).catch(err => {
            console.error("Error al exportar PDF con html2pdf:", err);
            contImprimible.style.display = "none";
            if (btnDescargar) {
                btnDescargar.disabled = false;
                btnDescargar.innerHTML = textoOriginal;
            }
            // Fallback directo a ventana de impresión / guardar como PDF
            window.print();
        });
    } else {
        // Si no está disponible la librería html2pdf, usar ventana nativa
        window.print();
        setTimeout(() => {
            contImprimible.style.display = "none";
            if (btnDescargar) {
                btnDescargar.disabled = false;
                btnDescargar.innerHTML = textoOriginal;
            }
        }, 1000);
    }
}

function mostrarAvisoTemporal(mensaje) {
    let aviso = document.getElementById("repAvisoTemporalToast");
    if (!aviso) {
        aviso = document.createElement("div");
        aviso.id = "repAvisoTemporalToast";
        aviso.style.cssText = "position:fixed; bottom:25px; right:25px; background:#0f172a; color:#fff; padding:12px 20px; border-radius:8px; font-weight:700; font-size:0.88rem; box-shadow:0 8px 20px rgba(0,0,0,0.3); z-index:3500; border-left:4px solid #18C48F; transition:all 0.3s ease;";
        document.body.appendChild(aviso);
    }
    aviso.textContent = mensaje;
    aviso.style.opacity = "1";
    aviso.style.display = "block";
    setTimeout(() => {
        aviso.style.opacity = "0";
        setTimeout(() => { aviso.style.display = "none"; }, 300);
    }, 3500);
}

