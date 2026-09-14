/* ===================================================
   SIGA-AP - CONTROLADOR DE CERTIFICACIONES (certificaciones.js)
   =================================================== */

// Estado global del módulo
const CertificacionesState = {
    nivel: 1, // 1: Raíz (Internas/Externas), 2: Familias, 3: Detalle Familia + Gráfico, 4: Grilla Subcategoría
    categoriaSeleccionada: null, // 'END', 'Soldadores', 'Equipos de Izaje'
    subcategoriaSeleccionada: null, // 'Ultrasonido', 'SMAW', etc.
    certificados: [],
    dotacion: [],
    proveedores: [],
    filtroTexto: '',
    filtroEstado: 'todos',
    filtroTipoRegistro: 'activos', // 'activos' (solo vigentes/no renovados), 'historicos', 'todos'
    anioGraficoVencimientos: new Date().getFullYear(),
    chartInstance: null,
    certEditandoId: null,
    archivoPdfCargado: null // { nombre, dataUrl }
};

// Helper para obtener el HTML de un ícono (sea SVG o Emoji/Texto)
function obtenerIconoHTML(iconoKeyOString, extraClase = '') {
    if (!iconoKeyOString) return '';
    const dict = window.SVG_ICONOS_CERTIFICACIONES || {};
    const key = String(iconoKeyOString).toLowerCase().trim();
    if (dict[key]) {
        return `<div class="cert-icono ${extraClase}">${dict[key]}</div>`;
    }
    if (dict[iconoKeyOString]) {
        return `<div class="cert-icono ${extraClase}">${dict[iconoKeyOString]}</div>`;
    }
    if (String(iconoKeyOString).trim().startsWith('<svg')) {
        return `<div class="cert-icono ${extraClase}">${iconoKeyOString}</div>`;
    }
    // Fallback con emojis en caso de no encontrarse el vector
    const fallbackEmojis = {
        'end': '🔬',
        'soldadores': '👨‍🏭',
        'equipos_izaje': '🏗️',
        'smaw': '🛡️',
        'aluminotermica': '⚡',
        'hidrogrua': '🚛',
        'puente_grua': '🏭',
        'ultrasonido': '📡',
        'liquidos_penetrantes': '🧪',
        'particulas_magnetizables': '🧲'
    };
    if (fallbackEmojis[key]) {
        return `<div class="cert-icono ${extraClase}">${fallbackEmojis[key]}</div>`;
    }
    return `<div class="cert-icono ${extraClase}">${iconoKeyOString}</div>`;
}

// Definición de las Familias y Subcategorías del sistema
const FAMILIAS_CONFIG = {
    "END": {
        nombre: "END (Ensayos No Destructivos)",
        icono: "end",
        iconoTexto: "🔬",
        descripcion: "Control de calidad de materiales y métodos de inspección no destructiva.",
        subcategorias: [
            { id: "Ultrasonido", nombre: "Ultrasonido (UT)", icono: "ultrasonido", iconoTexto: "📡", desc: "Inspección ultrasónica en ejes, ruedas y rieles." },
            { id: "Líquidos Penetrantes", nombre: "Líquidos Penetrantes (LP)", icono: "liquidos_penetrantes", iconoTexto: "🧪", desc: "Detección de discontinuidades superficiales." },
            { id: "Partículas Magnetizables", nombre: "Partículas Magnetizables (PM)", icono: "particulas_magnetizables", iconoTexto: "🧲", desc: "Inspección superficial y subsuperficial con campo magnético." }
        ]
    },
    "Soldadores": {
        nombre: "Soldadores",
        icono: "soldadores",
        iconoTexto: "👨‍🏭",
        descripcion: "Calificaciones de procedimientos y homologaciones de soldadores.",
        subcategorias: [
            { id: "Soldadura SMAW", nombre: "Soldadura SMAW", icono: "smaw", iconoTexto: "🛡️", desc: "Electrodo revestido en estructuras y componentes pesados." },
            { id: "Soldadura Aluminotérmica", nombre: "Soldadura Aluminotérmica", icono: "aluminotermica", iconoTexto: "⚡", desc: "Unión y reparación continua de rieles en vía con crisol." }
        ]
    },
    "Equipos de Izaje": {
        nombre: "Equipos de Izaje",
        icono: "equipos_izaje",
        iconoTexto: "🏗️",
        descripcion: "Habilitaciones para operación segura de grúas y equipos de elevación.",
        subcategorias: [
            { id: "Hidrogrúa", nombre: "Hidrogrúa", icono: "hidrogrua", iconoTexto: "🚛", desc: "Operación de grúas móviles articuladas y auxilio operativo." },
            { id: "Puente Grúa", nombre: "Puente Grúa", icono: "puente_grua", iconoTexto: "🏭", desc: "Manejo de puente grúa en naves y talleres principales." }
        ]
    }
};

// Inicialización robusta del módulo de certificaciones
let _certificacionesInicializado = false;
async function inicializarModuloCertificaciones() {
    if (_certificacionesInicializado) return;
    _certificacionesInicializado = true;

    cargarDatosDesdeDB();
    configurarEventosUI();
    renderizarVista();

    // Si IndexedDB termina de cargar de forma asíncrona, refrescar los datos y la vista
    if (!window._SIGA_DB_IS_READY) {
        window.addEventListener('siga_db_ready', () => {
            cargarDatosDesdeDB();
            renderizarVista();
        }, { once: true });
        // Timeout de seguridad por si el evento ya disparó
        setTimeout(() => {
            cargarDatosDesdeDB();
            renderizarVista();
        }, 300);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", inicializarModuloCertificaciones);
} else {
    inicializarModuloCertificaciones();
}

function cargarDatosDesdeDB() {
    try {
        let datos = [];
        let dot = [];
        let provs = [];

        if (window.dbLocal && window.dbLocal.raw) {
            datos = window.dbLocal.raw.leerTabla('certificaciones_externas') || [];
            dot = window.dbLocal.raw.leerTabla('dotacion') || [];
            provs = window.dbLocal.raw.leerTabla('proveedores') || [];
        } else {
            const raw = localStorage.getItem('SIGA_DB_certificaciones_externas');
            datos = raw ? JSON.parse(raw) : [];
            const rawDot = localStorage.getItem('SIGA_DB_dotacion');
            dot = rawDot ? JSON.parse(rawDot) : [];
            const rawProvs = localStorage.getItem('SIGA_DB_proveedores');
            provs = rawProvs ? JSON.parse(rawProvs) : [];
        }

        // Fallback de contingencia: si la tabla está vacía en este entorno local, usar semillas
        if ((!datos || datos.length === 0) && window.SIGA_DATOS_INICIALES && Array.isArray(window.SIGA_DATOS_INICIALES.certificaciones_externas)) {
            datos = [...window.SIGA_DATOS_INICIALES.certificaciones_externas];
            if (window.dbLocal && window.dbLocal.raw && typeof window.dbLocal.raw.guardarTablaAsync === 'function') {
                window.dbLocal.raw.guardarTablaAsync('certificaciones_externas', datos);
            }
        }

        if ((!provs || provs.length === 0) && window.SIGA_DATOS_INICIALES && Array.isArray(window.SIGA_DATOS_INICIALES.proveedores)) {
            provs = [...window.SIGA_DATOS_INICIALES.proveedores];
        }

        CertificacionesState.certificados = Array.isArray(datos) ? datos : [];
        CertificacionesState.dotacion = Array.isArray(dot) ? dot : [];
        CertificacionesState.proveedores = Array.isArray(provs) ? provs : [];
    } catch (e) {
        console.error("Error al leer certificaciones:", e);
        if (CertificacionesState.certificados.length === 0 && window.SIGA_DATOS_INICIALES && Array.isArray(window.SIGA_DATOS_INICIALES.certificaciones_externas)) {
            CertificacionesState.certificados = [...window.SIGA_DATOS_INICIALES.certificaciones_externas];
        }
    }
}

async function guardarCertificadosEnDB() {
    try {
        if (window.dbLocal && window.dbLocal.raw) {
            if (typeof window.dbLocal.raw.guardarTablaAsync === 'function') {
                await window.dbLocal.raw.guardarTablaAsync('certificaciones_externas', CertificacionesState.certificados);
            } else if (typeof window.dbLocal.raw.escribirTabla === 'function') {
                window.dbLocal.raw.escribirTabla('certificaciones_externas', CertificacionesState.certificados);
            }
        }
        try {
            localStorage.setItem('SIGA_DB_certificaciones_externas', JSON.stringify(CertificacionesState.certificados));
        } catch (e) {
            console.warn("localStorage saturated (handled safely via IndexedDB):", e);
        }
    } catch (e) {
        console.error("Error al guardar certificados:", e);
    }
}

// Configuración de eventos de UI
function configurarEventosUI() {
    // Dropzone de PDF (Registro / Edición)
    const dropZone = document.getElementById("pdfDropZone");
    const fileInput = document.getElementById("inputCertPdf");

    if (dropZone && fileInput) {
        dropZone.addEventListener("click", () => fileInput.click());
        
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                procesarArchivoPDF(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                procesarArchivoPDF(e.target.files[0]);
            }
        });
    }

    // Dropzone de PDF (Renovación de Certificado)
    const dropZoneRenovar = document.getElementById("pdfDropZoneRenovar");
    const fileInputRenovar = document.getElementById("inputRenovarPdf");

    if (dropZoneRenovar && fileInputRenovar) {
        dropZoneRenovar.addEventListener("click", () => fileInputRenovar.click());
        
        dropZoneRenovar.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZoneRenovar.classList.add("dragover");
        });

        dropZoneRenovar.addEventListener("dragleave", () => {
            dropZoneRenovar.classList.remove("dragover");
        });

        dropZoneRenovar.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZoneRenovar.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                procesarArchivoPDFRenovar(e.dataTransfer.files[0]);
            }
        });

        fileInputRenovar.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                procesarArchivoPDFRenovar(e.target.files[0]);
            }
        });
    }

    // Inicializar Buscador de Colaboradores en Modal
    inicializarBuscadorColaboradorModal();

    // Toggle de vencimiento
    const chkTieneVenc = document.getElementById("formTieneVencimiento");
    const grupoFechaVenc = document.getElementById("grupoFechaVencimiento");
    if (chkTieneVenc && grupoFechaVenc) {
        chkTieneVenc.addEventListener("change", (e) => {
            grupoFechaVenc.style.display = e.target.checked ? "flex" : "none";
        });
    }
}

// ----------------------------------------------------
// BUSCADOR INTELIGENTE DE COLABORADORES (MODAL)
// ----------------------------------------------------
function inicializarBuscadorColaboradorModal() {
    const inputBuscar = document.getElementById("inputBuscarEmpleadoModal");
    const btnBuscar = document.getElementById("btnBuscarColaboradorModal");
    const dropdown = document.getElementById("dropdownResultadosEmpleados");
    const btnCambiar = document.getElementById("btnCambiarColaborador");

    if (!inputBuscar || !dropdown) return;

    let debounceTimer = null;

    const ejecutarBusqueda = () => {
        const query = inputBuscar.value.trim();
        if (query.length === 0) {
            dropdown.style.display = "none";
            dropdown.innerHTML = "";
            return;
        }
        const resultados = buscarColaboradoresEnDotacion(query);
        renderizarResultadosColaboradores(resultados);
    };

    inputBuscar.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(ejecutarBusqueda, 180);
    });

    inputBuscar.addEventListener("focus", () => {
        if (inputBuscar.value.trim().length > 0) {
            ejecutarBusqueda();
        }
    });

    inputBuscar.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const primerResultado = dropdown.querySelector(".item-resultado-empleado:not(.no-results)");
            if (primerResultado) {
                primerResultado.click();
            } else {
                ejecutarBusqueda();
            }
        } else if (e.key === "Escape") {
            dropdown.style.display = "none";
        }
    });

    if (btnBuscar) {
        btnBuscar.addEventListener("click", ejecutarBusqueda);
    }

    if (btnCambiar) {
        btnCambiar.addEventListener("click", resetearBuscadorColaboradorModal);
    }

    // Cerrar dropdown al hacer clic afuera
    document.addEventListener("click", (e) => {
        const contenedor = document.querySelector(".buscador-empleado-container");
        if (contenedor && !contenedor.contains(e.target)) {
            dropdown.style.display = "none";
        }
    });
}

function buscarColaboradoresEnDotacion(query) {
    if (!query) return [];
    const term = query.toLowerCase().trim();
    const dotacion = CertificacionesState.dotacion || [];

    const resultados = [];
    for (let i = 0; i < dotacion.length; i++) {
        const d = dotacion[i];
        const leg = String(d.LEGAJO || d.legajo || '').trim();
        const ape = String(d.APELLIDO || d.apellido || '').trim();
        const nom = String(d.NOMBRE || d.nombre || '').trim();
        const puesto = String(d.PUESTO || d.puesto || '').trim();
        const area = String(d.JEFATURA || d.jefatura || d.GERENCIA || d.gerencia || d.DIRECCION || d.direccion || '').trim();
        const nombreCompleto = `${ape} ${nom}`.trim();

        // Coincidencia por legajo exacto o parcial, o por nombre/apellido
        if (
            leg.toLowerCase().includes(term) ||
            nombreCompleto.toLowerCase().includes(term) ||
            puesto.toLowerCase().includes(term)
        ) {
            resultados.push({
                legajo: leg,
                apellido: ape,
                nombre: nom,
                nombreCompleto: `${ape}, ${nom}`.trim(),
                puesto: puesto,
                area: area
            });
            if (resultados.length >= 20) break; // Límite de 20 resultados para fluidez máxima
        }
    }
    return resultados;
}

function renderizarResultadosColaboradores(lista) {
    const dropdown = document.getElementById("dropdownResultadosEmpleados");
    if (!dropdown) return;

    dropdown.innerHTML = "";

    if (!lista || lista.length === 0) {
        dropdown.innerHTML = `
            <div class="item-resultado-empleado no-results">
                🔍 No se encontraron colaboradores con ese legajo o nombre.
            </div>
        `;
        dropdown.style.display = "block";
        return;
    }

    lista.forEach(colab => {
        const div = document.createElement("div");
        div.className = "item-resultado-empleado";
        div.innerHTML = `
            <span class="colab-badge-legajo">Leg. ${colab.legajo}</span>
            <div class="colab-info-text">
                <strong>${colab.nombreCompleto || colab.legajo}</strong>
                <span>${colab.puesto || 'Puesto no asignado'} ${colab.area ? '• ' + colab.area : ''}</span>
            </div>
        `;
        div.addEventListener("click", () => {
            seleccionarColaboradorEnModal(colab);
        });
        dropdown.appendChild(div);
    });

    dropdown.style.display = "block";
}

function seleccionarColaboradorEnModal(colab) {
    const hiddenLegajo = document.getElementById("formCertLegajo");
    const wrapInput = document.getElementById("wrapInputBuscarEmpleado");
    const dropdown = document.getElementById("dropdownResultadosEmpleados");
    const card = document.getElementById("cardColaboradorSeleccionado");
    const badge = document.getElementById("colabBadgeLegajo");
    const nombreTxt = document.getElementById("colabNombreDisplay");
    const puestoTxt = document.getElementById("colabPuestoDisplay");

    if (hiddenLegajo) hiddenLegajo.value = colab.legajo;
    if (badge) badge.textContent = `Legajo: ${colab.legajo}`;
    if (nombreTxt) nombreTxt.textContent = colab.nombreCompleto || `${colab.apellido || ''} ${colab.nombre || ''}`.trim() || `Legajo ${colab.legajo}`;
    if (puestoTxt) puestoTxt.textContent = `${colab.puesto || ''} ${colab.area ? '• ' + colab.area : ''}`.trim();

    // Autocompletar campos del formulario
    document.getElementById("formCertNombre").value = colab.nombreCompleto || `${colab.apellido || ''} ${colab.nombre || ''}`.trim();
    document.getElementById("formCertPuesto").value = colab.puesto || "";
    document.getElementById("formCertArea").value = colab.area || "";

    if (dropdown) dropdown.style.display = "none";
    if (wrapInput) wrapInput.style.display = "none";
    if (card) card.style.display = "flex";
}

function mostrarColaboradorSeleccionadoCard(legajo, nombreFallback, puestoFallback, areaFallback) {
    const hiddenLegajo = document.getElementById("formCertLegajo");
    const wrapInput = document.getElementById("wrapInputBuscarEmpleado");
    const dropdown = document.getElementById("dropdownResultadosEmpleados");
    const card = document.getElementById("cardColaboradorSeleccionado");
    const badge = document.getElementById("colabBadgeLegajo");
    const nombreTxt = document.getElementById("colabNombreDisplay");
    const puestoTxt = document.getElementById("colabPuestoDisplay");

    if (!legajo) {
        resetearBuscadorColaboradorModal();
        return;
    }

    // Buscar en dotación
    const emp = (CertificacionesState.dotacion || []).find(d => String(d.LEGAJO || d.legajo).trim() === String(legajo).trim());
    const nomCompleto = emp ? `${emp.APELLIDO || emp.apellido || ''}, ${emp.NOMBRE || emp.nombre || ''}`.trim() : nombreFallback || `Legajo ${legajo}`;
    const puesto = emp ? (emp.PUESTO || emp.puesto || '') : (puestoFallback || '');
    const area = emp ? (emp.JEFATURA || emp.jefatura || emp.GERENCIA || emp.gerencia || emp.DIRECCION || emp.direccion || '') : (areaFallback || '');

    if (hiddenLegajo) hiddenLegajo.value = legajo;
    if (badge) badge.textContent = `Legajo: ${legajo}`;
    if (nombreTxt) nombreTxt.textContent = nomCompleto;
    if (puestoTxt) puestoTxt.textContent = `${puesto} ${area ? '• ' + area : ''}`.trim();

    if (dropdown) dropdown.style.display = "none";
    if (wrapInput) wrapInput.style.display = "none";
    if (card) card.style.display = "flex";
}

function resetearBuscadorColaboradorModal() {
    const hiddenLegajo = document.getElementById("formCertLegajo");
    const inputBuscar = document.getElementById("inputBuscarEmpleadoModal");
    const wrapInput = document.getElementById("wrapInputBuscarEmpleado");
    const dropdown = document.getElementById("dropdownResultadosEmpleados");
    const card = document.getElementById("cardColaboradorSeleccionado");

    if (hiddenLegajo) hiddenLegajo.value = "";
    if (inputBuscar) {
        inputBuscar.value = "";
    }
    if (dropdown) {
        dropdown.innerHTML = "";
        dropdown.style.display = "none";
    }
    if (card) card.style.display = "none";
    if (wrapInput) wrapInput.style.display = "flex";

    if (inputBuscar) {
        setTimeout(() => inputBuscar.focus(), 50);
    }
}

function procesarArchivoPDF(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        alert("Por favor seleccione un archivo en formato PDF.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        CertificacionesState.archivoPdfCargado = {
            nombre: file.name,
            dataUrl: e.target.result
        };
        const lbl = document.getElementById("pdfFileNameDisplay");
        if (lbl) {
            lbl.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            lbl.style.display = "block";
        }
    };
    reader.readAsDataURL(file);
}

let _pdfRenovarCargado = null;
function procesarArchivoPDFRenovar(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        alert("Por favor seleccione un archivo en formato PDF.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        _pdfRenovarCargado = {
            nombre: file.name,
            dataUrl: e.target.result
        };
        const lbl = document.getElementById("pdfRenovarFileNameDisplay");
        if (lbl) {
            lbl.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            lbl.style.display = "block";
        }
    };
    reader.readAsDataURL(file);
}

function autocompletarDatosEmpleado(legajo) {
    if (!legajo) {
        document.getElementById("formCertNombre").value = "";
        document.getElementById("formCertPuesto").value = "";
        document.getElementById("formCertArea").value = "";
        return;
    }

    const emp = CertificacionesState.dotacion.find(d => String(d.LEGAJO || d.legajo).trim() === String(legajo).trim());
    if (emp) {
        const nomCompleto = `${emp.APELLIDO || emp.apellido || ''}, ${emp.NOMBRE || emp.nombre || ''}`.trim();
        document.getElementById("formCertNombre").value = nomCompleto;
        document.getElementById("formCertPuesto").value = emp.PUESTO || emp.puesto || '';
        document.getElementById("formCertArea").value = emp.JEFATURA || emp.jefatura || emp.GERENCIA || emp.gerencia || emp.DIRECCION || emp.direccion || '';
    }
}

// ==========================================
// CÁLCULO DE VENCIMIENTOS Y ESTADOS
// ==========================================

function calcularEstadoCertificado(cert) {
    // Si ha sido renovado o marcado como histórico
    if (cert.es_historico || cert.estado_renovacion === 'historico') {
        const textoRenov = cert.renovado_por ? `Histórico (Renovado por ${cert.renovado_por})` : 'Histórico (Renovado)';
        return { estado: 'Histórico', claseBadge: 'badge-historico', texto: textoRenov };
    }

    if (!cert.tiene_vencimiento && cert.tiene_vencimiento !== undefined) {
        return { estado: 'Permanente', claseBadge: 'badge-permanente', texto: 'Sin Vencimiento' };
    }
    if (!cert.fecha_vencimiento) {
        return { estado: 'Permanente', claseBadge: 'badge-permanente', texto: 'Sin Vencimiento' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fVenc = parsearFechaAObj(cert.fecha_vencimiento);
    if (!fVenc) return { estado: 'Vigente', claseBadge: 'badge-vigente', texto: 'Vigente' };

    const diffMs = fVenc.getTime() - hoy.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
        return { estado: 'Vencido', claseBadge: 'badge-vencido', texto: 'Vencido', dias: diffDias };
    } else if (diffDias <= 60) {
        return { estado: 'Por Vencer', claseBadge: 'badge-por-vencer', texto: `Vence en ${diffDias}d`, dias: diffDias };
    } else {
        return { estado: 'Vigente', claseBadge: 'badge-vigente', texto: 'Vigente', dias: diffDias };
    }
}

function parsearFechaAObj(strFecha) {
    if (!strFecha) return null;
    if (strFecha.includes("-")) {
        const parts = strFecha.split("-");
        if (parts[0].length === 4) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    }
    if (strFecha.includes("/")) {
        const parts = strFecha.split("/");
        if (parts[2].length === 4) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }
    return new Date(strFecha);
}

function formatearFechaVisual(strFecha) {
    if (!strFecha) return "—";
    const d = parsearFechaAObj(strFecha);
    if (!d || isNaN(d.getTime())) return strFecha;
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

// Obtener el próximo vencimiento para una categoría o subcategoría
function obtenerProximoVencimiento(categoria, subcategoria = null) {
    let lista = CertificacionesState.certificados.filter(c => 
        c.categoria === categoria && 
        !c.es_historico && 
        c.estado_renovacion !== 'historico'
    );
    if (subcategoria) {
        lista = lista.filter(c => c.subcategoria === subcategoria);
    }

    const conVenc = lista
        .filter(c => c.fecha_vencimiento && (c.tiene_vencimiento !== false))
        .map(c => ({
            cert: c,
            fechaObj: parsearFechaAObj(c.fecha_vencimiento),
            infoEstado: calcularEstadoCertificado(c)
        }))
        .filter(item => item.fechaObj && !isNaN(item.fechaObj.getTime()))
        .sort((a, b) => a.fechaObj.getTime() - b.fechaObj.getTime());

    if (conVenc.length === 0) {
        return {
            textoFecha: "Sin Vencimientos",
            claseAlerta: ""
        };
    }

    const proximo = conVenc[0];
    let claseAlerta = "";
    if (proximo.infoEstado.estado === "Vencido") {
        claseAlerta = "alerta-vencido";
    } else if (proximo.infoEstado.estado === "Por Vencer") {
        claseAlerta = "alerta-proximo";
    }

    return {
        textoFecha: formatearFechaVisual(proximo.cert.fecha_vencimiento),
        claseAlerta: claseAlerta,
        colaborador: proximo.cert.apellido_nombre,
        totalVencidos: conVenc.filter(x => x.infoEstado.estado === "Vencido").length,
        totalPorVencer: conVenc.filter(x => x.infoEstado.estado === "Por Vencer").length
    };
}

// ==========================================
// RENDERIZADO DE VISTAS SEGÚN NIVEL
// ==========================================

function renderizarVista() {
    renderizarBreadcrumbs();

    const contenedor = document.getElementById("certMainContainer");
    if (!contenedor) return;

    if (CertificacionesState.nivel === 1) {
        renderizarNivel1(contenedor);
    } else if (CertificacionesState.nivel === 2) {
        renderizarNivel2(contenedor);
    } else if (CertificacionesState.nivel === 3) {
        renderizarNivel3(contenedor);
    } else if (CertificacionesState.nivel === 4) {
        renderizarNivel4(contenedor);
    }
}

// 1. Breadcrumbs
function renderizarBreadcrumbs() {
    const navWrap = document.getElementById("certBreadcrumbNav");
    if (!navWrap) return;

    let html = `
        <div class="breadcrumb-list">
            <span class="breadcrumb-item ${CertificacionesState.nivel === 1 ? 'active' : ''}" onclick="navegarA(1)">🏆 Certificaciones</span>
    `;

    if (CertificacionesState.nivel >= 2) {
        html += `
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-item ${CertificacionesState.nivel === 2 ? 'active' : ''}" onclick="navegarA(2)">🏢 Externas</span>
        `;
    }

    if (CertificacionesState.nivel >= 3 && CertificacionesState.categoriaSeleccionada) {
        const fam = FAMILIAS_CONFIG[CertificacionesState.categoriaSeleccionada];
        const iconTxt = fam ? (fam.iconoTexto || '') : '';
        html += `
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-item ${CertificacionesState.nivel === 3 ? 'active' : ''}" onclick="navegarA(3)">${iconTxt} ${fam ? fam.nombre : CertificacionesState.categoriaSeleccionada}</span>
        `;
    }

    if (CertificacionesState.nivel === 4 && CertificacionesState.subcategoriaSeleccionada) {
        const fam = FAMILIAS_CONFIG[CertificacionesState.categoriaSeleccionada];
        let subTxt = '';
        if (fam && fam.subcategorias) {
            const subObj = fam.subcategorias.find(s => s.id === CertificacionesState.subcategoriaSeleccionada);
            if (subObj && subObj.iconoTexto) subTxt = subObj.iconoTexto + ' ';
        }
        html += `
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-item active">${subTxt}${CertificacionesState.subcategoriaSeleccionada}</span>
        `;
    }

    html += `</div>`;

    if (CertificacionesState.nivel > 1) {
        const nivelAnterior = CertificacionesState.nivel - 1;
        html += `
            <button class="btn-volver-cert" onclick="navegarA(${nivelAnterior})">
                ⬅ Volver
            </button>
        `;
    }

    navWrap.innerHTML = html;
}

function navegarA(nivel) {
    if (nivel === 1) {
        CertificacionesState.nivel = 1;
        CertificacionesState.categoriaSeleccionada = null;
        CertificacionesState.subcategoriaSeleccionada = null;
    } else if (nivel === 2) {
        CertificacionesState.nivel = 2;
        CertificacionesState.subcategoriaSeleccionada = null;
    } else if (nivel === 3) {
        CertificacionesState.nivel = 3;
        CertificacionesState.subcategoriaSeleccionada = null;
    }
    renderizarVista();
}

// ----------------------------------------------------
// NIVEL 1: Entrada Principal (Internas vs Externas)
// ----------------------------------------------------
function renderizarNivel1(contenedor) {
    contenedor.innerHTML = `
        <div class="cert-cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
            <!-- Tarjeta 1: Internas (Estática) -->
            <div class="cert-card disabled" title="Módulo en desarrollo">
                <div class="cert-card-header">
                    <div class="cert-icono">🏛️</div>
                    <span class="badge-estado badge-permanente">Próximamente</span>
                </div>
                <div class="cert-card-body">
                    <h3>Certificaciones Internas</h3>
                    <p>Emisión y gestión de diplomas oficiales emitidos internamente por Academia / SIGA con correlatividad automática.</p>
                </div>
                <div class="cert-card-footer">
                    <span>Certificados Internos</span>
                    <span style="color: #94a3b8; font-weight: 600;">En desarrollo</span>
                </div>
            </div>

            <!-- Tarjeta 2: Externas (Activa) -->
            <div class="cert-card" onclick="seleccionarExternas()">
                <div class="cert-card-header">
                    <div class="cert-icono">🏢</div>
                    <span class="badge-estado badge-vigente">Módulo Activo</span>
                </div>
                <div class="cert-card-body">
                    <h3>Certificaciones Externas</h3>
                    <p>Registro, control de vencimientos y almacenamiento de certificados y matrículas técnicas emitidas por proveedores y entes externos.</p>
                </div>
                <div class="cert-card-footer">
                    <span style="font-weight: 700; color: var(--azul);">${CertificacionesState.certificados.length} Certificados Registrados</span>
                    <span style="color: var(--verde); font-weight: 700;">Ingresar ➔</span>
                </div>
            </div>
        </div>
    `;
}

function seleccionarExternas() {
    CertificacionesState.nivel = 2;
    renderizarVista();
}

// ----------------------------------------------------
// NIVEL 2: Familias de Certificaciones Externas (Foto 2)
// ----------------------------------------------------
function renderizarNivel2(contenedor) {
    const categorias = Object.keys(FAMILIAS_CONFIG);

    let htmlCards = '';
    categorias.forEach(catKey => {
        const config = FAMILIAS_CONFIG[catKey];
        const proxVenc = obtenerProximoVencimiento(catKey);
        const totalEnCat = CertificacionesState.certificados.filter(c => c.categoria === catKey).length;

        htmlCards += `
            <div class="cert-card" onclick="seleccionarCategoria('${catKey}')">
                <div class="cert-card-header">
                    ${obtenerIconoHTML(config.icono)}
                    <div class="prox-vencimiento-box ${proxVenc.claseAlerta}">
                        <span class="lbl-titulo">Próx. Vencimiento:</span>
                        <span class="lbl-fecha">${proxVenc.textoFecha}</span>
                    </div>
                </div>
                <div class="cert-card-body">
                    <h3>${config.nombre}</h3>
                    <p>${config.descripcion}</p>
                </div>
                <div class="cert-card-footer">
                    <span>${totalEnCat} colaboradores calificados</span>
                    <span style="color: var(--verde); font-weight: 700;">Ver Métodos ➔</span>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = `
        <div class="cert-cards-grid">
            ${htmlCards}
        </div>
    `;
}

function seleccionarCategoria(catKey) {
    CertificacionesState.categoriaSeleccionada = catKey;
    CertificacionesState.nivel = 3;
    renderizarVista();
}

// ----------------------------------------------------
// NIVEL 3: Detalle de Familia + Gráfico Mensual (Foto 3)
// ----------------------------------------------------
function cambiarAnioGrafico(nuevoAnio) {
    CertificacionesState.anioGraficoVencimientos = parseInt(nuevoAnio, 10);
    dibujarGraficoVencimientos(CertificacionesState.categoriaSeleccionada);
}
window.cambiarAnioGrafico = cambiarAnioGrafico;

function renderizarNivel3(contenedor) {
    const catKey = CertificacionesState.categoriaSeleccionada;
    const config = FAMILIAS_CONFIG[catKey];
    if (!config) return;

    const proxVenc = obtenerProximoVencimiento(catKey);
    const certsFamilia = CertificacionesState.certificados.filter(c => c.categoria === catKey);
    const certsActivosFamilia = certsFamilia.filter(c => !c.es_historico && c.estado_renovacion !== 'historico');

    // Calcular años disponibles en base a los vencimientos de la familia activa
    const aniosSet = new Set();
    const hoyAnio = new Date().getFullYear();
    aniosSet.add(hoyAnio);
    certsActivosFamilia.forEach(c => {
        if (c.fecha_vencimiento) {
            const d = parsearFechaAObj(c.fecha_vencimiento);
            if (d && !isNaN(d.getTime())) {
                aniosSet.add(d.getFullYear());
            }
        }
    });
    const listaAnios = Array.from(aniosSet).sort((a, b) => a - b);
    if (!CertificacionesState.anioGraficoVencimientos || !listaAnios.includes(CertificacionesState.anioGraficoVencimientos)) {
        CertificacionesState.anioGraficoVencimientos = hoyAnio;
    }

    let htmlSubcards = '';
    config.subcategorias.forEach(sub => {
        const proxSub = obtenerProximoVencimiento(catKey, sub.id);
        const totalSub = certsActivosFamilia.filter(c => c.subcategoria === sub.id).length;

        htmlSubcards += `
            <div class="cert-card" onclick="seleccionarSubcategoria('${sub.id}')">
                <div class="cert-card-header">
                    ${obtenerIconoHTML(sub.icono)}
                    <div class="prox-vencimiento-box ${proxSub.claseAlerta}">
                        <span class="lbl-titulo">Próx. Vencimiento:</span>
                        <span class="lbl-fecha">${proxSub.textoFecha}</span>
                    </div>
                </div>
                <div class="cert-card-body">
                    <h3>${sub.nombre}</h3>
                    <p>${sub.desc}</p>
                </div>
                <div class="cert-card-footer">
                    <span>${totalSub} activos</span>
                    <span style="color: var(--verde); font-weight: 700;">Ver Registro ➔</span>
                </div>
            </div>
        `;
    });

    const opcionesAniosHtml = listaAnios.map(a => 
        `<option value="${a}" ${a === CertificacionesState.anioGraficoVencimientos ? 'selected' : ''}>Año ${a}</option>`
    ).join('');

    contenedor.innerHTML = `
        <!-- SECCIÓN SUPERIOR: RESUMEN Y GRÁFICO MENSUAL DE VENCIMIENTOS -->
        <div class="nivel3-top-container">
            <div class="resumen-familia-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        ${obtenerIconoHTML(config.icono, 'cert-icono-large')}
                        <div class="prox-vencimiento-box ${proxVenc.claseAlerta}">
                            <span class="lbl-titulo">Próx. Vencimiento:</span>
                            <span class="lbl-fecha">${proxVenc.textoFecha}</span>
                        </div>
                    </div>
                    <h3 style="font-size: 22px; color: var(--azul); margin-bottom: 6px;">${config.nombre}</h3>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.4;">${config.descripcion}</p>
                </div>

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center;">
                        <span style="display:block; font-size: 11px; color: #64748b; font-weight: 700;">TOTAL ACTIVOS</span>
                        <span style="font-size: 20px; font-weight: 800; color: var(--azul);">${certsActivosFamilia.length}</span>
                    </div>
                    <div style="background: #fef2f2; padding: 10px; border-radius: 8px; text-align: center;">
                        <span style="display:block; font-size: 11px; color: #b91c1c; font-weight: 700;">EN ALERTA / VENCIDOS</span>
                        <span style="font-size: 20px; font-weight: 800; color: #dc2626;">${(proxVenc.totalVencidos || 0) + (proxVenc.totalPorVencer || 0)}</span>
                    </div>
                </div>
            </div>

            <!-- Gráfico Mensual de Vencimientos -->
            <div class="grafico-vencimientos-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="margin: 0; font-size: 15px; color: var(--azul);">📊 Vencimientos Programados por Mes</h4>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label for="selectAnioGraficoVenc" style="font-size: 12px; font-weight: 700; color: #64748b;">Año:</label>
                        <select id="selectAnioGraficoVenc" onchange="cambiarAnioGrafico(this.value)" style="padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700; color: var(--azul); font-size: 13px; background: #fff;">
                            ${opcionesAniosHtml}
                        </select>
                    </div>
                </div>
                <div class="chart-canvas-wrapper">
                    <canvas id="chartVencimientosMensuales"></canvas>
                </div>
            </div>
        </div>

        <!-- SECCIÓN INFERIOR: SUBCATEGORÍAS / MÉTODOS -->
        <h4 style="font-size: 17px; color: var(--azul); font-weight: 700; margin-bottom: 15px;">
            Especialidades y Métodos Específicos:
        </h4>
        <div class="cert-cards-grid">
            ${htmlSubcards}
        </div>
    `;

    // Renderizar gráfico de Chart.js
    setTimeout(() => {
        dibujarGraficoVencimientos(catKey);
    }, 50);
}

function dibujarGraficoVencimientos(catKey) {
    const canvas = document.getElementById("chartVencimientosMensuales");
    if (!canvas || typeof Chart === "undefined") return;

    if (CertificacionesState.chartInstance) {
        CertificacionesState.chartInstance.destroy();
    }

    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const datosVigentes = new Array(12).fill(0);
    const datosPorVencer = new Array(12).fill(0);
    const datosVencidos = new Array(12).fill(0);

    const anioSeleccionado = CertificacionesState.anioGraficoVencimientos || new Date().getFullYear();
    // Excluir certificados históricos (solo certificados de capacitación vigentes/activos)
    const certs = CertificacionesState.certificados.filter(c => 
        c.categoria === catKey && 
        !c.es_historico && 
        c.estado_renovacion !== 'historico'
    );

    certs.forEach(c => {
        if (!c.fecha_vencimiento) return;
        const d = parsearFechaAObj(c.fecha_vencimiento);
        if (!d || isNaN(d.getTime())) return;

        // FILTRADO ESTRICTO POR AÑO
        if (d.getFullYear() !== anioSeleccionado) return;

        const mesIdx = d.getMonth();
        const est = calcularEstadoCertificado(c);

        // MUTUA EXCLUSIVIDAD ESTRICTA:
        // Si el certificado está por vencer en este mes -> SÓLO suma a datosPorVencer (naranja).
        // NUNCA debe aparecer la barra verde a su lado.
        if (est.estado === "Vencido") {
            datosVencidos[mesIdx]++;
        } else if (est.estado === "Por Vencer") {
            datosPorVencer[mesIdx]++;
        } else if (est.estado === "Vigente") {
            datosVigentes[mesIdx]++;
        }
    });

    const ctx = canvas.getContext("2d");
    CertificacionesState.chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: meses,
            datasets: [
                {
                    label: "Vigentes",
                    data: datosVigentes,
                    backgroundColor: "#18C48F",
                    borderRadius: 4
                },
                {
                    label: "Próximos a Vencer (60d)",
                    data: datosPorVencer,
                    backgroundColor: "#f59e0b",
                    borderRadius: 4
                },
                {
                    label: "Vencidos",
                    data: datosVencidos,
                    backgroundColor: "#ef4444",
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 12,
                        font: { size: 12 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

function seleccionarSubcategoria(subId) {
    CertificacionesState.subcategoriaSeleccionada = subId;
    CertificacionesState.nivel = 4;
    renderizarVista();
}

// ----------------------------------------------------
// NIVEL 4: Grilla y Gestión de la Subcategoría
// ----------------------------------------------------
function renderizarNivel4(contenedor) {
    contenedor.innerHTML = `
        <!-- TOOLBAR DE GESTIÓN Y BÚSQUEDA -->
        <div class="cert-toolbar">
            <div class="cert-filtros-group">
                <div class="cert-search-box">
                    <input type="text" class="cert-input-search" id="inputSearchCert" placeholder="🔍 Buscar por nombre, legajo o N° cert..." value="${CertificacionesState.filtroTexto}">
                    <button type="button" class="btn-cert-search" id="btnEjecutarBusqueda" title="Buscar en registros">🔍 Buscar</button>
                    <button type="button" class="btn-cert-clear" id="btnLimpiarBusqueda" title="Limpiar búsqueda" style="${CertificacionesState.filtroTexto ? 'display:inline-block;' : 'display:none;'}">✕</button>
                </div>
                <select class="cert-select-filter" id="selectFilterTipoRegistro" title="Tipo de Registros">
                    <option value="activos" ${CertificacionesState.filtroTipoRegistro === 'activos' ? 'selected' : ''}>🟢 Certificados Activos</option>
                    <option value="historicos" ${CertificacionesState.filtroTipoRegistro === 'historicos' ? 'selected' : ''}>📜 Historial de Renovados</option>
                    <option value="todos" ${CertificacionesState.filtroTipoRegistro === 'todos' ? 'selected' : ''}>Todos los Registros</option>
                </select>
                <select class="cert-select-filter" id="selectFilterEstado">
                    <option value="todos" ${CertificacionesState.filtroEstado === 'todos' ? 'selected' : ''}>Todos los Estados</option>
                    <option value="vigente" ${CertificacionesState.filtroEstado === 'vigente' ? 'selected' : ''}>🟢 Vigentes</option>
                    <option value="por vencer" ${CertificacionesState.filtroEstado === 'por vencer' ? 'selected' : ''}>🟡 Próximos a Vencer (60d)</option>
                    <option value="vencido" ${CertificacionesState.filtroEstado === 'vencido' ? 'selected' : ''}>🔴 Vencidos</option>
                    <option value="histórico" ${CertificacionesState.filtroEstado === 'histórico' ? 'selected' : ''}>📜 Históricos</option>
                </select>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="btn-secondary-cert" onclick="abrirHistorialGeneralSubcategoria()" style="display:inline-flex; align-items:center; gap:6px; font-weight:600; font-size:13px; padding:9px 14px; border-radius:8px; border:1px solid #c7d2fe; background:#eef2ff; color:#4338ca; cursor:pointer;" title="Consultar todo el historial cronológico de renovaciones">
                    📜 Ver Historial Completo
                </button>
                <button class="btn-primary-cert" onclick="abrirModalNuevoCertificado()">
                    ➕ Registrar Certificación
                </button>
            </div>
        </div>

        <!-- TABLA DE CERTIFICADOS -->
        <div class="cert-table-container">
            <table class="cert-table">
                <thead>
                    <tr>
                        <th>N° Certificado</th>
                        <th>Alcance</th>
                        <th>Colaborador</th>
                        <th>Puesto / Área</th>
                        <th>Ente</th>
                        <th>Emisión</th>
                        <th>Vencimiento</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="tbodyCertificadosNivel4">
                </tbody>
            </table>
        </div>
    `;

    // Renderizar filas en tbody
    actualizarTablaNivel4();

    // Listeners para filtros
    const inputSearch = document.getElementById("inputSearchCert");
    const btnEjecutar = document.getElementById("btnEjecutarBusqueda");
    const btnLimpiar = document.getElementById("btnLimpiarBusqueda");
    const selectTipo = document.getElementById("selectFilterTipoRegistro");
    const selectEst = document.getElementById("selectFilterEstado");

    if (inputSearch) {
        inputSearch.addEventListener("input", (e) => {
            CertificacionesState.filtroTexto = e.target.value;
            if (btnLimpiar) {
                btnLimpiar.style.display = e.target.value.trim().length > 0 ? "inline-block" : "none";
            }
            actualizarTablaNivel4();
        });

        inputSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                CertificacionesState.filtroTexto = inputSearch.value;
                if (btnLimpiar) {
                    btnLimpiar.style.display = inputSearch.value.trim().length > 0 ? "inline-block" : "none";
                }
                actualizarTablaNivel4();
            }
        });
    }

    if (btnEjecutar && inputSearch) {
        btnEjecutar.addEventListener("click", () => {
            CertificacionesState.filtroTexto = inputSearch.value;
            if (btnLimpiar) {
                btnLimpiar.style.display = inputSearch.value.trim().length > 0 ? "inline-block" : "none";
            }
            actualizarTablaNivel4();
        });
    }

    if (btnLimpiar && inputSearch) {
        btnLimpiar.addEventListener("click", () => {
            inputSearch.value = "";
            CertificacionesState.filtroTexto = "";
            btnLimpiar.style.display = "none";
            actualizarTablaNivel4();
            inputSearch.focus();
        });
    }

    if (selectTipo) {
        selectTipo.addEventListener("change", (e) => {
            CertificacionesState.filtroTipoRegistro = e.target.value;
            actualizarTablaNivel4();
        });
    }

    if (selectEst) {
        selectEst.addEventListener("change", (e) => {
            CertificacionesState.filtroEstado = e.target.value;
            actualizarTablaNivel4();
        });
    }
}

function buscarCertificado(param) {
    if (param === null || param === undefined || param === '') return null;
    const str = String(param).trim();
    let strDecoded = str;
    try { strDecoded = decodeURIComponent(str); } catch (e) {}
    return CertificacionesState.certificados.find(c => 
        String(c.id) === str || 
        String(c.id) === strDecoded ||
        (c.codigo && (String(c.codigo).trim() === str || String(c.codigo).trim() === strDecoded))
    ) || null;
}

function actualizarTablaNivel4() {
    const tbody = document.getElementById("tbodyCertificadosNivel4");
    if (!tbody) return;

    const cat = CertificacionesState.categoriaSeleccionada;
    const sub = CertificacionesState.subcategoriaSeleccionada;

    let certsFiltrados = CertificacionesState.certificados.filter(c => c.categoria === cat && c.subcategoria === sub);

    // Filtro por tipo de registro (Activos vs Históricos de Renovación)
    if (CertificacionesState.filtroTipoRegistro === 'activos') {
        certsFiltrados = certsFiltrados.filter(c => !c.es_historico && c.estado_renovacion !== 'historico');
    } else if (CertificacionesState.filtroTipoRegistro === 'historicos') {
        certsFiltrados = certsFiltrados.filter(c => c.es_historico || c.estado_renovacion === 'historico');
    }

    // Filtro por texto (búsqueda por nombre, legajo, código, alcance, ente o puesto)
    if (CertificacionesState.filtroTexto.trim() !== '') {
        const t = CertificacionesState.filtroTexto.toLowerCase().trim();
        certsFiltrados = certsFiltrados.filter(c => 
            String(c.codigo || '').toLowerCase().includes(t) ||
            String(c.alcance || '').toLowerCase().includes(t) ||
            String(c.apellido_nombre || '').toLowerCase().includes(t) ||
            String(c.legajo || '').toLowerCase().includes(t) ||
            String(c.proveedor_ente || c.ente || '').toLowerCase().includes(t) ||
            String(c.puesto || '').toLowerCase().includes(t) ||
            String(c.area_jefatura || '').toLowerCase().includes(t)
        );
    }

    // Filtro por estado
    if (CertificacionesState.filtroEstado !== 'todos') {
        certsFiltrados = certsFiltrados.filter(c => {
            const st = calcularEstadoCertificado(c).estado.toLowerCase();
            return st === CertificacionesState.filtroEstado.toLowerCase();
        });
    }

    if (certsFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8;">
                    <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
                    No se encontraron certificados registrados para los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    let filasHtml = '';
    certsFiltrados.forEach(c => {
        const infoEst = calcularEstadoCertificado(c);
        const esHist = c.es_historico || c.estado_renovacion === 'historico';
        const rawId = c.id !== undefined && c.id !== null ? c.id : (c.codigo || 'CERT_' + Math.random().toString(36).substr(2, 7));
        c.id = rawId;
        const safeId = encodeURIComponent(String(rawId));

        filasHtml += `
            <tr style="${esHist ? 'background: #f8fafc; opacity: 0.9;' : ''}">
                <td>
                    <strong>${c.codigo || '—'}</strong>
                    ${c.renovado_por ? `<div style="font-size: 11px; color: #6d28d9; font-weight: 600;">➔ Renovado por: ${c.renovado_por}</div>` : ''}
                    ${c.certificado_anterior_codigo ? `<div style="font-size: 11px; color: #0284c7; font-weight: 600;">📌 Renovación de: ${c.certificado_anterior_codigo}</div>` : ''}
                </td>
                <td>
                    <span style="display: inline-block; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 6px; font-size: 13px; border: 1px solid #bae6fd;">
                        ${c.alcance || '—'}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--azul);">${c.apellido_nombre || '—'}</div>
                    <div style="font-size: 12px; color: #64748b;">Legajo: ${c.legajo || '—'}</div>
                </td>
                <td>
                    <div>${c.puesto || '—'}</div>
                    <div style="font-size: 12px; color: #94a3b8;">${c.area_jefatura || '—'}</div>
                </td>
                <td>
                    <span style="font-weight: 600; color: #334155;">${c.proveedor_ente || c.ente || '—'}</span>
                </td>
                <td>${formatearFechaVisual(c.fecha_emision)}</td>
                <td><strong>${formatearFechaVisual(c.fecha_vencimiento)}</strong></td>
                <td>
                    <span class="badge-estado ${infoEst.claseBadge}">${infoEst.texto}</span>
                </td>
                <td>
                    <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                        <button class="btn-accion-cert btn-accion-ver" onclick="abrirVisorPDF('${safeId}')" title="Ver Certificado PDF">
                            👁️ Ver
                        </button>
                        <button class="btn-accion-cert btn-accion-edit" onclick="abrirModalEditar('${safeId}')" title="Editar Datos del Certificado">
                            ✏️
                        </button>
                        ${!esHist ? `
                            <button class="btn-accion-cert btn-accion-renovar" onclick="abrirModalRenovar('${safeId}')" title="Renovar Certificado (Se guardará el actual como histórico)">
                                🔄 Renovar
                            </button>
                        ` : ''}
                        <button class="btn-accion-cert btn-accion-historial" onclick="abrirModalHistorial('${safeId}')" title="Ver Historial de Certificaciones de este Colaborador">
                            📜 Historial
                        </button>
                        <button class="btn-accion-cert btn-accion-delete" onclick="eliminarCertificado('${safeId}')" title="Eliminar Registro">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = filasHtml;
}

// ==========================================
// MODAL DE REGISTRO / EDICIÓN DE CERTIFICADO
// ==========================================

function abrirModalNuevoCertificado() {
    CertificacionesState.certEditandoId = null;
    CertificacionesState.archivoPdfCargado = null;

    document.getElementById("modalFormCertTitle").textContent = "➕ Registrar Nueva Certificación Externa";
    document.getElementById("formCertId").value = "";
    document.getElementById("formCertCodigo").value = "";
    document.getElementById("formCertCategoria").value = CertificacionesState.categoriaSeleccionada || "END";
    actualizarSelectSubcategoriasModal();
    document.getElementById("formCertSubcategoria").value = CertificacionesState.subcategoriaSeleccionada || "";
    
    // Proveedor, Ente y Alcance
    poblarSelectorProveedoresModal();
    const selProv = document.getElementById("formCertProveedorSelect");
    if (selProv) selProv.value = "";
    document.getElementById("formCertEnte").value = "";
    document.getElementById("formCertAlcance").value = "";

    // Resetear selector inteligente de colaboradores
    resetearBuscadorColaboradorModal();

    document.getElementById("formCertNombre").value = "";
    document.getElementById("formCertPuesto").value = "";
    document.getElementById("formCertArea").value = "";
    document.getElementById("formCertFechaEmision").value = new Date().toISOString().split("T")[0];
    document.getElementById("formTieneVencimiento").checked = true;
    document.getElementById("grupoFechaVencimiento").style.display = "flex";

    // Sugerir vencimiento a 2 años por defecto
    const fVencDef = new Date();
    fVencDef.setFullYear(fVencDef.getFullYear() + 2);
    document.getElementById("formCertFechaVencimiento").value = fVencDef.toISOString().split("T")[0];

    document.getElementById("formCertObservaciones").value = "";
    document.getElementById("pdfFileNameDisplay").style.display = "none";
    document.getElementById("inputCertPdf").value = "";

    document.getElementById("modalFormCertificado").style.display = "flex";
}

function abrirModalEditar(certId) {
    const cert = buscarCertificado(certId);
    if (!cert) {
        console.warn("[Certificaciones] No se encontró el certificado a editar:", certId);
        return;
    }

    CertificacionesState.certEditandoId = cert.id;
    CertificacionesState.archivoPdfCargado = cert.archivo_pdf_data ? { nombre: cert.archivo_pdf_nombre, dataUrl: cert.archivo_pdf_data } : null;

    document.getElementById("modalFormCertTitle").textContent = "✏️ Editar Certificación Externa";
    document.getElementById("formCertId").value = cert.id;
    document.getElementById("formCertCodigo").value = cert.codigo || "";
    document.getElementById("formCertCategoria").value = cert.categoria || "END";
    actualizarSelectSubcategoriasModal();
    document.getElementById("formCertSubcategoria").value = cert.subcategoria || "";

    // Proveedor, Ente y Alcance
    poblarSelectorProveedoresModal(cert.proveedor_id || cert.proveedor_ente || cert.ente);
    const selProv = document.getElementById("formCertProveedorSelect");
    if (selProv && !selProv.value && (cert.proveedor_ente || cert.ente)) {
        const enteBuscado = (cert.proveedor_ente || cert.ente).toLowerCase().trim();
        for (let i = 0; i < selProv.options.length; i++) {
            const opt = selProv.options[i];
            if ((opt.dataset.ente && opt.dataset.ente.toLowerCase().trim() === enteBuscado) ||
                (opt.dataset.nombre && opt.dataset.nombre.toLowerCase().trim().includes(enteBuscado))) {
                selProv.selectedIndex = i;
                break;
            }
        }
    }
    document.getElementById("formCertEnte").value = cert.proveedor_ente || cert.ente || "";
    document.getElementById("formCertAlcance").value = cert.alcance || "";

    // Cargar colaborador en el buscador/tarjeta
    mostrarColaboradorSeleccionadoCard(cert.legajo, cert.apellido_nombre, cert.puesto, cert.area_jefatura);

    document.getElementById("formCertNombre").value = cert.apellido_nombre || "";
    document.getElementById("formCertPuesto").value = cert.puesto || "";
    document.getElementById("formCertArea").value = cert.area_jefatura || "";
    document.getElementById("formCertFechaEmision").value = cert.fecha_emision || "";

    const tieneVenc = cert.tiene_vencimiento !== false;
    document.getElementById("formTieneVencimiento").checked = tieneVenc;
    document.getElementById("grupoFechaVencimiento").style.display = tieneVenc ? "flex" : "none";
    document.getElementById("formCertFechaVencimiento").value = cert.fecha_vencimiento || "";

    document.getElementById("formCertObservaciones").value = cert.observaciones || "";

    const lbl = document.getElementById("pdfFileNameDisplay");
    if (cert.archivo_pdf_nombre) {
        lbl.textContent = `📄 ${cert.archivo_pdf_nombre}`;
        lbl.style.display = "block";
    } else {
        lbl.style.display = "none";
    }

    document.getElementById("modalFormCertificado").style.display = "flex";
}

function cerrarModalFormCert() {
    document.getElementById("modalFormCertificado").style.display = "none";
}

function poblarSelectorProveedoresModal(proveedorSeleccionado = null) {
    const sel = document.getElementById("formCertProveedorSelect");
    if (!sel) return;

    // Asegurar lista fresca de proveedores
    let lista = CertificacionesState.proveedores || [];
    if (window.dbLocal && window.dbLocal.raw) {
        const provsDB = window.dbLocal.raw.leerTabla('proveedores');
        if (provsDB && provsDB.length > 0) lista = provsDB;
    }
    if ((!lista || lista.length === 0) && window.SIGA_DATOS_INICIALES && window.SIGA_DATOS_INICIALES.proveedores) {
        lista = window.SIGA_DATOS_INICIALES.proveedores;
    }

    sel.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
    lista.filter(p => (p.estado || 'Activo').toLowerCase() === 'activo').forEach(p => {
        const idVal = p.codigo_proveedor || p.codigo || p.id;
        const nombre = p.razon_social || p.nombre || idVal;
        const ente = p.ente || '';
        const opt = document.createElement("option");
        opt.value = idVal;
        opt.dataset.ente = ente;
        opt.dataset.nombre = nombre;
        opt.textContent = `${nombre} (Ente: ${ente || 'N/A'})`;

        if (proveedorSeleccionado && (
            String(proveedorSeleccionado).toLowerCase() === String(idVal).toLowerCase() ||
            String(proveedorSeleccionado).toLowerCase() === String(nombre).toLowerCase() ||
            String(proveedorSeleccionado).toLowerCase() === String(ente).toLowerCase() ||
            (p.id && String(proveedorSeleccionado) === String(p.id))
        )) {
            opt.selected = true;
        }
        sel.appendChild(opt);
    });
}

function onProveedorSeleccionado(provId) {
    const sel = document.getElementById("formCertProveedorSelect");
    const inputEnte = document.getElementById("formCertEnte");
    if (!inputEnte) return;

    if (!provId) {
        inputEnte.value = "";
        return;
    }

    if (sel && sel.selectedIndex >= 0) {
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.dataset && opt.dataset.ente) {
            inputEnte.value = opt.dataset.ente;
            return;
        }
    }

    let lista = CertificacionesState.proveedores || [];
    if (window.dbLocal && window.dbLocal.raw) {
        const provsDB = window.dbLocal.raw.leerTabla('proveedores');
        if (provsDB && provsDB.length > 0) lista = provsDB;
    }
    const prov = lista.find(p => String(p.codigo_proveedor || p.id) === String(provId));
    inputEnte.value = prov ? (prov.ente || prov.razon_social || "") : "";
}

function poblarSelectorEmpleadosModal() {
    const sel = document.getElementById("formCertLegajo");
    if (!sel) return;

    sel.innerHTML = '<option value="">Seleccione Colaborador...</option>';
    CertificacionesState.dotacion.forEach(d => {
        const leg = d.LEGAJO || d.legajo;
        const nom = `${d.APELLIDO || d.apellido || ''} ${d.NOMBRE || d.nombre || ''}`.trim();
        const opt = document.createElement("option");
        opt.value = leg;
        opt.textContent = `${leg} - ${nom}`;
        sel.appendChild(opt);
    });
}

function actualizarSelectSubcategoriasModal() {
    const cat = document.getElementById("formCertCategoria").value;
    const selSub = document.getElementById("formCertSubcategoria");
    if (!selSub) return;

    selSub.innerHTML = "";
    const fam = FAMILIAS_CONFIG[cat];
    if (fam && fam.subcategorias) {
        fam.subcategorias.forEach(sub => {
            const opt = document.createElement("option");
            opt.value = sub.id;
            opt.textContent = sub.nombre;
            selSub.appendChild(opt);
        });
    }
}

async function guardarCertificadoForm(e) {
    e.preventDefault();

    const codigo = document.getElementById("formCertCodigo").value.trim();
    const categoria = document.getElementById("formCertCategoria").value;
    const subcategoria = document.getElementById("formCertSubcategoria").value;
    const legajo = document.getElementById("formCertLegajo").value;
    const nombre = document.getElementById("formCertNombre").value.trim();
    const puesto = document.getElementById("formCertPuesto").value.trim();
    const area = document.getElementById("formCertArea").value.trim();
    
    const selProv = document.getElementById("formCertProveedorSelect");
    const proveedorId = selProv ? selProv.value : "";
    const ente = document.getElementById("formCertEnte").value.trim();
    const alcance = document.getElementById("formCertAlcance").value.trim();

    const fechaEmision = document.getElementById("formCertFechaEmision").value;
    const tieneVenc = document.getElementById("formTieneVencimiento").checked;
    const fechaVenc = tieneVenc ? document.getElementById("formCertFechaVencimiento").value : null;
    const obs = document.getElementById("formCertObservaciones").value.trim();

    if (!codigo || !legajo || !nombre || !ente || !alcance || !fechaEmision) {
        alert("Por favor complete todos los campos obligatorios (*).");
        return;
    }

    if (tieneVenc && !fechaVenc) {
        alert("Por favor ingrese la fecha de vencimiento.");
        return;
    }

    let certId = CertificacionesState.certEditandoId;

    if (certId) {
        // Modificar existente
        const idx = CertificacionesState.certificados.findIndex(c => c.id === certId);
        if (idx !== -1) {
            CertificacionesState.certificados[idx] = {
                ...CertificacionesState.certificados[idx],
                codigo,
                categoria,
                subcategoria,
                alcance,
                proveedor_id: proveedorId,
                proveedor_ente: ente,
                ente: ente,
                legajo: parseInt(legajo) || legajo,
                apellido_nombre: nombre,
                puesto,
                area_jefatura: area,
                fecha_emision: fechaEmision,
                fecha_vencimiento: fechaVenc,
                tiene_vencimiento: tieneVenc,
                observaciones: obs,
                archivo_pdf_nombre: CertificacionesState.archivoPdfCargado ? CertificacionesState.archivoPdfCargado.nombre : CertificacionesState.certificados[idx].archivo_pdf_nombre,
                archivo_pdf_data: CertificacionesState.archivoPdfCargado ? CertificacionesState.archivoPdfCargado.dataUrl : CertificacionesState.certificados[idx].archivo_pdf_data
            };
        }
    } else {
        // Nuevo registro
        const maxId = CertificacionesState.certificados.reduce((acc, curr) => Math.max(acc, curr.id || 0), 0);
        const nuevoCert = {
            id: maxId + 1,
            codigo,
            categoria,
            subcategoria,
            alcance,
            proveedor_id: proveedorId,
            proveedor_ente: ente,
            ente: ente,
            legajo: parseInt(legajo) || legajo,
            apellido_nombre: nombre,
            puesto,
            area_jefatura: area,
            fecha_emision: fechaEmision,
            fecha_vencimiento: fechaVenc,
            tiene_vencimiento: tieneVenc,
            observaciones: obs,
            archivo_pdf_nombre: CertificacionesState.archivoPdfCargado ? CertificacionesState.archivoPdfCargado.nombre : `Certificado_${codigo}.pdf`,
            archivo_pdf_data: CertificacionesState.archivoPdfCargado ? CertificacionesState.archivoPdfCargado.dataUrl : null
        };
        CertificacionesState.certificados.push(nuevoCert);
    }

    await guardarCertificadosEnDB();
    cerrarModalFormCert();
    renderizarVista();
}

async function eliminarCertificado(certId) {
    const cert = buscarCertificado(certId);
    if (!cert) {
        console.warn("[Certificaciones] No se encontró el certificado a eliminar:", certId);
        return;
    }

    if (confirm(`¿Está seguro de eliminar el certificado "${cert.codigo || ''}" de ${cert.apellido_nombre || ''}?`)) {
        CertificacionesState.certificados = CertificacionesState.certificados.filter(c => c !== cert && String(c.id) !== String(cert.id));
        await guardarCertificadosEnDB();
        renderizarVista();
    }
}

// ==========================================
// VISOR DE PDF INTEGRADO
// ==========================================

function abrirVisorPDF(certId) {
    const cert = buscarCertificado(certId);
    if (!cert) {
        console.warn("[Certificaciones] No se encontró el certificado para visor:", certId);
        return;
    }

    const modal = document.getElementById("modalVisorPDF");
    const titulo = document.getElementById("modalVisorTitle");
    const frameWrap = document.getElementById("pdfViewerContainer");

    titulo.textContent = `📄 Certificado N° ${cert.codigo || ''} - ${cert.apellido_nombre || ''}`;

    if (cert.archivo_pdf_data && cert.archivo_pdf_data.startsWith("data:application/pdf")) {
        frameWrap.innerHTML = `
            <iframe class="pdf-viewer-frame" src="${cert.archivo_pdf_data}#toolbar=1&navpanes=0"></iframe>
        `;
    } else {
        // Generador de Vista Previa de Certificado Digital Vectorial
        const infoEst = calcularEstadoCertificado(cert);
        frameWrap.innerHTML = `
            <div class="digital-cert-preview">
                <div style="font-size: 40px; margin-bottom: 10px;">🏆</div>
                <h2>CERTIFICADO OFICIAL DE CALIFICACIÓN</h2>
                <div class="cert-org">${cert.proveedor_ente || 'ENTE CALIFICADOR HOMOLOGADO'}</div>
                
                <p class="cert-to">Se deja constancia de que:</p>
                <div class="cert-name">${cert.apellido_nombre}</div>
                <div style="font-weight: 700; color: #475569; margin-bottom: 15px;">Legajo N° ${cert.legajo} — ${cert.puesto}</div>

                <div class="cert-detail">
                    Ha cumplido y aprobado satisfactoriamente todas las exigencias teóricas y prácticas requeridas para la certificación en:<br>
                    <strong style="font-size: 18px; color: var(--azul); display: block; margin-top: 6px;">
                        ${cert.categoria} — ${cert.subcategoria}
                    </strong>
                    ${cert.alcance ? `<div style="font-size: 15px; color: #0284c7; font-weight: 700; margin-top: 6px;">Alcance / Calificación: ${cert.alcance}</div>` : ''}
                </div>

                <div class="cert-footer-grid">
                    <div>
                        <strong>N° Certificado:</strong> ${cert.codigo}<br>
                        <strong>Fecha Emisión:</strong> ${formatearFechaVisual(cert.fecha_emision)}
                    </div>
                    <div>
                        <strong>Vencimiento:</strong> ${formatearFechaVisual(cert.fecha_vencimiento)}<br>
                        <strong>Estado:</strong> <span class="badge-estado ${infoEst.claseBadge}">${infoEst.texto}</span>
                    </div>
                </div>

                <div style="margin-top: 25px; padding: 10px; background: #f8fafc; border-radius: 8px; font-size: 12px; color: #64748b;">
                    ${cert.observaciones || 'Acreditación técnica en conformidad con normativas de seguridad y aseguramiento de calidad vigentes.'}
                </div>
            </div>
        `;
    }

    modal.style.display = "flex";
}

function cerrarModalVisorPDF() {
    document.getElementById("modalVisorPDF").style.display = "none";
}

function imprimirCertificadoActual() {
    const contenido = document.getElementById("pdfViewerContainer").innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
            <head>
                <title>Imprimir Certificado</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; }
                    .digital-cert-preview { border: 8px double #1F2A44; padding: 40px; text-align: center; }
                    .cert-org { color: #0d9488; font-weight: 700; font-size: 18px; margin-bottom: 20px; }
                    .cert-name { font-size: 26px; font-weight: 800; text-decoration: underline; margin: 15px 0; }
                    .cert-footer-grid { display: flex; justify-content: space-around; margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
                    .badge-estado { padding: 4px 10px; border-radius: 12px; font-weight: 700; }
                </style>
            </head>
            <body>
                ${contenido}
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
        </html>
    `);
    ventana.document.close();
}

// ==========================================
// FLUJO DE RENOVACIÓN DE CERTIFICACIONES
// ==========================================

function abrirModalRenovar(certId) {
    const cert = buscarCertificado(certId);
    if (!cert) {
        alert("No se encontró el registro seleccionado para renovar.");
        return;
    }

    _pdfRenovarCargado = null;

    document.getElementById("renovarCertIdAnterior").value = cert.id;
    document.getElementById("renovarColaboradorNombre").textContent = cert.apellido_nombre || '—';
    document.getElementById("renovarColaboradorLegajo").textContent = `Legajo: ${cert.legajo || '—'} • ${cert.puesto || ''}`;
    document.getElementById("renovarCodigoAnterior").textContent = cert.codigo || '—';
    document.getElementById("renovarAlcanceAnterior").textContent = `Alcance: ${cert.alcance || '—'}`;
    document.getElementById("renovarEnteAnterior").textContent = cert.proveedor_ente || cert.ente || '—';
    document.getElementById("renovarVencimientoAnterior").textContent = `Vencimiento previo: ${formatearFechaVisual(cert.fecha_vencimiento)}`;

    // Sugerencia inteligente de nuevo código de renovación
    let nuevoCodigoSugerido = '';
    const cod = String(cert.codigo || '').trim();
    const matchNum = cod.match(/^(.*?)(\d+)$/);
    if (matchNum) {
        const prefix = matchNum[1];
        const num = parseInt(matchNum[2], 10);
        const len = matchNum[2].length;
        nuevoCodigoSugerido = `${prefix}${String(num + 1).padStart(len, '0')}`;
    } else {
        nuevoCodigoSugerido = `${cod}-R2`;
    }
    document.getElementById("renovarNuevoCodigo").value = nuevoCodigoSugerido;

    // Poblar selector de proveedores
    poblarSelectorProveedoresRenovar(cert.proveedor_id || cert.proveedor_ente || cert.ente);
    document.getElementById("renovarEnte").value = cert.proveedor_ente || cert.ente || "";
    document.getElementById("renovarAlcance").value = cert.alcance || "";

    // Fechas por defecto
    const hoyStr = new Date().toISOString().split("T")[0];
    document.getElementById("renovarFechaEmision").value = hoyStr;

    // Vencimiento + 2 años por defecto
    const fVenc = new Date();
    fVenc.setFullYear(fVenc.getFullYear() + 2);
    document.getElementById("renovarFechaVencimiento").value = fVenc.toISOString().split("T")[0];

    document.getElementById("renovarObservaciones").value = `Renovación periódica de calificación técnica (Certificado anterior N° ${cert.codigo}).`;

    // Limpiar visualización de PDF
    const lblPdf = document.getElementById("pdfRenovarFileNameDisplay");
    if (lblPdf) {
        lblPdf.textContent = "";
        lblPdf.style.display = "none";
    }
    const inputPdf = document.getElementById("inputRenovarPdf");
    if (inputPdf) inputPdf.value = "";

    document.getElementById("modalRenovarCertificado").style.display = "flex";
}

function cerrarModalRenovar() {
    document.getElementById("modalRenovarCertificado").style.display = "none";
}

function poblarSelectorProveedoresRenovar(proveedorSeleccionado = null) {
    const sel = document.getElementById("renovarProveedorSelect");
    if (!sel) return;

    let lista = CertificacionesState.proveedores || [];
    if (window.dbLocal && window.dbLocal.raw) {
        const provsDB = window.dbLocal.raw.leerTabla('proveedores');
        if (provsDB && provsDB.length > 0) lista = provsDB;
    }
    if ((!lista || lista.length === 0) && window.SIGA_DATOS_INICIALES && window.SIGA_DATOS_INICIALES.proveedores) {
        lista = window.SIGA_DATOS_INICIALES.proveedores;
    }

    sel.innerHTML = '<option value="">-- Seleccionar Proveedor / Ente --</option>';
    lista.filter(p => (p.estado || 'Activo').toLowerCase() === 'activo').forEach(p => {
        const idVal = p.codigo_proveedor || p.codigo || p.id;
        const nombre = p.razon_social || p.nombre || idVal;
        const ente = p.ente || '';
        const opt = document.createElement("option");
        opt.value = idVal;
        opt.dataset.ente = ente;
        opt.dataset.nombre = nombre;
        opt.textContent = `${nombre} (Ente: ${ente || 'N/A'})`;

        if (proveedorSeleccionado && (
            String(proveedorSeleccionado).toLowerCase() === String(idVal).toLowerCase() ||
            String(proveedorSeleccionado).toLowerCase() === String(nombre).toLowerCase() ||
            String(proveedorSeleccionado).toLowerCase() === String(ente).toLowerCase() ||
            (p.id && String(proveedorSeleccionado) === String(p.id))
        )) {
            opt.selected = true;
        }
        sel.appendChild(opt);
    });
}

function onRenovarProveedorSeleccionado(provId) {
    const sel = document.getElementById("renovarProveedorSelect");
    const inputEnte = document.getElementById("renovarEnte");
    if (!inputEnte) return;

    if (!provId) {
        inputEnte.value = "";
        return;
    }

    if (sel && sel.selectedIndex >= 0) {
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.dataset && opt.dataset.ente) {
            inputEnte.value = opt.dataset.ente;
            return;
        }
    }

    let lista = CertificacionesState.proveedores || [];
    if (window.dbLocal && window.dbLocal.raw) {
        const provsDB = window.dbLocal.raw.leerTabla('proveedores');
        if (provsDB && provsDB.length > 0) lista = provsDB;
    }
    const prov = lista.find(p => String(p.codigo_proveedor || p.id) === String(provId));
    inputEnte.value = prov ? (prov.ente || prov.razon_social || "") : "";
}

async function guardarRenovacionCertificado(e) {
    e.preventDefault();

    const certIdAnterior = parseInt(document.getElementById("renovarCertIdAnterior").value, 10);
    const certAnterior = CertificacionesState.certificados.find(c => c.id === certIdAnterior);
    if (!certAnterior) {
        alert("No se encontró el certificado previo para renovar.");
        return;
    }

    const nuevoCodigo = document.getElementById("renovarNuevoCodigo").value.trim();
    const selProv = document.getElementById("renovarProveedorSelect");
    const proveedorId = selProv ? selProv.value : "";
    const ente = document.getElementById("renovarEnte").value.trim();
    const alcance = document.getElementById("renovarAlcance").value.trim();
    const fechaEmision = document.getElementById("renovarFechaEmision").value;
    const fechaVencimiento = document.getElementById("renovarFechaVencimiento").value;
    const obs = document.getElementById("renovarObservaciones").value.trim();

    if (!nuevoCodigo || !ente || !alcance || !fechaEmision || !fechaVencimiento) {
        alert("Por favor complete todos los campos requeridos (*).");
        return;
    }

    // 1. MARCAR CERTIFICADO PREVIO COMO HISTÓRICO (PRESERVA HISTORIAL DE CAPACITACIÓN)
    certAnterior.es_historico = true;
    certAnterior.estado_renovacion = 'historico';
    certAnterior.renovado_por = nuevoCodigo;
    certAnterior.fecha_renovacion = fechaEmision;

    // 2. CREAR NUEVO CERTIFICADO RENOVADO VIGENTE
    const maxId = CertificacionesState.certificados.reduce((acc, curr) => Math.max(acc, curr.id || 0), 0);
    const nuevoCert = {
        id: maxId + 1,
        codigo: nuevoCodigo,
        categoria: certAnterior.categoria,
        subcategoria: certAnterior.subcategoria,
        alcance: alcance,
        proveedor_id: proveedorId || certAnterior.proveedor_id || "",
        proveedor_ente: ente,
        ente: ente,
        legajo: certAnterior.legajo,
        apellido_nombre: certAnterior.apellido_nombre,
        puesto: certAnterior.puesto,
        area_jefatura: certAnterior.area_jefatura,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        tiene_vencimiento: true,
        observaciones: obs,
        certificado_anterior_id: certAnterior.id,
        certificado_anterior_codigo: certAnterior.codigo,
        es_historico: false,
        archivo_pdf_nombre: _pdfRenovarCargado ? _pdfRenovarCargado.nombre : `Certificado_${nuevoCodigo}.pdf`,
        archivo_pdf_data: _pdfRenovarCargado ? _pdfRenovarCargado.dataUrl : (certAnterior.archivo_pdf_data || null)
    };

    CertificacionesState.certificados.push(nuevoCert);

    await guardarCertificadosEnDB();
    cerrarModalRenovar();
    renderizarVista();
    alert(`✅ Certificado renovado exitosamente como N° ${nuevoCodigo}.\nEl certificado N° ${certAnterior.codigo} ha quedado guardado como histórico de capacitación.`);
}

// ==========================================
// MODAL: HISTORIAL DE CAPACITACIONES
// ==========================================

function abrirModalHistorial(param) {
    let legajo = null;
    let certInicial = buscarCertificado(param);

    if (certInicial) {
        legajo = certInicial.legajo;
    } else {
        legajo = param;
        if (typeof legajo === 'string') {
            try { legajo = decodeURIComponent(legajo); } catch (e) {}
        }
    }

    // Obtener todas las certificaciones del colaborador (vigentes e históricas)
    let certsColab = CertificacionesState.certificados.filter(c => 
        (legajo && String(c.legajo).trim() === String(legajo).trim()) ||
        (certInicial && c.apellido_nombre && c.apellido_nombre.toLowerCase().trim() === certInicial.apellido_nombre.toLowerCase().trim())
    );

    if (certsColab.length === 0 && certInicial) {
        certsColab = [certInicial];
    }

    // Ordenar cronológicamente (más recientes primero)
    certsColab.sort((a, b) => {
        const fa = parsearFechaAObj(a.fecha_emision) || new Date(0);
        const fb = parsearFechaAObj(b.fecha_emision) || new Date(0);
        return fb.getTime() - fa.getTime();
    });

    const titular = certsColab[0] || {};
    const contenedorFicha = document.getElementById("historialFichaColaborador");
    const timeline = document.getElementById("historialTimelineContainer");

    if (contenedorFicha) {
        contenedorFicha.innerHTML = `
            <div>
                <strong style="font-size: 1.05rem; color: #1e1b4b;">👤 ${titular.apellido_nombre || 'Colaborador'}</strong>
                <div style="font-size: 0.85rem; color: #4338ca; margin-top: 2px;">
                    Legajo: <strong>${titular.legajo || '—'}</strong> • ${titular.puesto || ''} (${titular.area_jefatura || ''})
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span style="background: #ffffff; padding: 4px 12px; border-radius: 6px; font-weight: 700; color: #3730a3; font-size: 0.82rem; border: 1px solid #c7d2fe;">
                    Total Acreditaciones Registradas: ${certsColab.length}
                </span>
            </div>
        `;
    }

    if (timeline) {
        if (certsColab.length === 0) {
            timeline.innerHTML = '<div style="text-align: center; color: #64748b; padding: 30px;">No se encontraron certificaciones históricas registradas.</div>';
        } else {
            let html = '<div style="margin-top: 10px;">';
            certsColab.forEach(c => {
                const esHist = c.es_historico || c.estado_renovacion === 'historico';
                const infoEst = calcularEstadoCertificado(c);
                const esActivo = !esHist && (infoEst.estado === 'Vigente' || infoEst.estado === 'Por Vencer');
                const rawId = c.id !== undefined && c.id !== null ? c.id : (c.codigo || 'CERT_' + Math.random().toString(36).substr(2, 7));
                c.id = rawId;
                const safeId = encodeURIComponent(String(rawId));

                html += `
                    <div class="timeline-cert-card ${esActivo ? 'active-cert' : ''}" style="background: #ffffff; border: 1px solid ${esActivo ? '#10b981' : '#cbd5e1'}; border-radius: 10px; padding: 14px 18px; margin-bottom: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
                            <div>
                                <span style="font-size: 0.75rem; font-weight: 700; color: ${esActivo ? '#059669' : '#64748b'}; text-transform: uppercase;">
                                    ${esActivo ? '🟢 Certificación Vigente Actual' : '📜 Histórico de Capacitación (Renovado)'}
                                </span>
                                <div style="font-size: 1.05rem; font-weight: 800; color: var(--azul);">
                                    N° ${c.codigo} 
                                    <span style="font-size: 0.8rem; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 4px; margin-left: 6px;">
                                        ${c.alcance || 'Calificación'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <span class="badge-estado ${infoEst.claseBadge}">${infoEst.texto}</span>
                            </div>
                        </div>

                        <div style="font-size: 0.85rem; color: #475569; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-top: 8px; background: #f8fafc; padding: 10px; border-radius: 6px;">
                            <div><strong>Método:</strong> ${c.categoria} - ${c.subcategoria}</div>
                            <div><strong>Ente / Emisor:</strong> ${c.proveedor_ente || c.ente || '—'}</div>
                            <div><strong>Emisión:</strong> ${formatearFechaVisual(c.fecha_emision)}</div>
                            <div><strong>Vencimiento:</strong> ${formatearFechaVisual(c.fecha_vencimiento)}</div>
                            ${c.renovado_por ? `<div style="grid-column: 1 / -1; color: #6d28d9; font-weight: 600;">🔄 Renovado por posterior Certificado N°: <strong>${c.renovado_por}</strong></div>` : ''}
                            ${c.certificado_anterior_codigo ? `<div style="grid-column: 1 / -1; color: #0284c7; font-weight: 600;">📌 Proviene de la renovación del Certificado N°: <strong>${c.certificado_anterior_codigo}</strong></div>` : ''}
                            ${c.observaciones ? `<div style="grid-column: 1 / -1; color: #64748b;"><strong>Obs:</strong> ${c.observaciones}</div>` : ''}
                        </div>

                        <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;">
                            <button class="btn-accion-cert btn-accion-ver" onclick="abrirVisorPDF('${safeId}')">
                                👁️ Ver PDF
                            </button>
                            ${!esHist ? `
                                <button class="btn-accion-cert btn-accion-renovar" onclick="abrirModalRenovar('${safeId}')">
                                    🔄 Renovar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            timeline.innerHTML = html;
        }
    }

    document.getElementById("modalHistorialCertificados").style.display = "flex";
}

function cerrarModalHistorial() {
    document.getElementById("modalHistorialCertificados").style.display = "none";
}

function abrirHistorialGeneralSubcategoria() {
    const cat = CertificacionesState.categoriaSeleccionada;
    const sub = CertificacionesState.subcategoriaSeleccionada;

    const certsSub = CertificacionesState.certificados.filter(c => c.categoria === cat && c.subcategoria === sub);
    const primerCert = certsSub[0];

    if (!primerCert) {
        alert("No hay registros en esta subcategoría para consultar el historial.");
        return;
    }

    // Si hay varios colaboradores, abrimos la vista con el filtro activado a 'historicos' o 'todos'
    CertificacionesState.filtroTipoRegistro = 'todos';
    renderizarVista();
}

// Exportar globalmente para eventos onclick en HTML
window.seleccionarExternas = seleccionarExternas;
window.seleccionarCategoria = seleccionarCategoria;
window.seleccionarSubcategoria = seleccionarSubcategoria;
window.navegarA = navegarA;
window.abrirModalNuevoCertificado = abrirModalNuevoCertificado;
window.abrirModalEditar = abrirModalEditar;
window.cerrarModalFormCert = cerrarModalFormCert;
window.guardarCertificadoForm = guardarCertificadoForm;
window.eliminarCertificado = eliminarCertificado;
window.abrirVisorPDF = abrirVisorPDF;
window.cerrarModalVisorPDF = cerrarModalVisorPDF;
window.imprimirCertificadoActual = imprimirCertificadoActual;
window.actualizarSelectSubcategoriasModal = actualizarSelectSubcategoriasModal;
window.onProveedorSeleccionado = onProveedorSeleccionado;
window.poblarSelectorProveedoresModal = poblarSelectorProveedoresModal;
window.abrirModalRenovar = abrirModalRenovar;
window.cerrarModalRenovar = cerrarModalRenovar;
window.poblarSelectorProveedoresRenovar = poblarSelectorProveedoresRenovar;
window.onRenovarProveedorSeleccionado = onRenovarProveedorSeleccionado;
window.guardarRenovacionCertificado = guardarRenovacionCertificado;
window.abrirModalHistorial = abrirModalHistorial;
window.cerrarModalHistorial = cerrarModalHistorial;
window.abrirHistorialGeneralSubcategoria = abrirHistorialGeneralSubcategoria;
window.buscarCertificado = buscarCertificado;
