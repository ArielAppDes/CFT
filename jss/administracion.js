// ===================================================
// SIGA_APP - LÓGICA DE ADMINISTRACIÓN, CATÁLOGOS Y USUARIOS
// ===================================================

let catalogoActual = 'programas';
let idSeleccionado = null; 
let itemSeleccionadoOriginal = null;
let modoEdicion = false;
let datosCatalogoActual = []; // Cache local para el buscador dinámico

document.addEventListener('DOMContentLoaded', () => {
    conectarEventosMenu();
    const params = new URLSearchParams(window.location.search);
    const catInicial = params.get('cat') || 'programas';
    cambiarCatalogo(catInicial);
});

function obtenerDB() {
    return window.supabaseClient || window.supabase || window.dbLocal || null;
}

// 1. EVENTOS MENÚ LATERAL
function conectarEventosMenu() {
    const mapaBotones = {
        'btn-cat-programas': 'programas',
        'btn-cat-cursos': 'cursos',
        'btn-cat-instructores': 'instructores',
        'btn-cat-proveedores': 'proveedores',
        'btn-cat-dotacion': 'dotacion',
        'btn-cat-usuarios': 'usuarios',
        'btn-cat-bases': 'bases'
    };

    Object.keys(mapaBotones).forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.onclick = (e) => {
                if (e) e.preventDefault();
                cambiarCatalogo(mapaBotones[id]);
            };
        }
    });
}

// 2. CONMUTADOR DE PANELES
async function cambiarCatalogo(catalogo) {
    catalogoActual = catalogo;
    idSeleccionado = null;
    itemSeleccionadoOriginal = null;
    modoEdicion = false;
    ocultarFormulario();

    const inputBusqueda = document.getElementById('inputBuscarCatalogo');
    if (inputBusqueda) inputBusqueda.value = '';

    document.querySelectorAll('.menu-admin ul li').forEach(li => li.classList.remove('activo'));
    const btnActivo = document.getElementById(`btn-cat-${catalogo}`);
    if (btnActivo) btnActivo.classList.add('activo');

    const panelGenerico = document.getElementById('panelGenerico');
    const panelDotacion = document.getElementById('panelDotacion');
    const panelBases = document.getElementById('panelBases');

    if (panelGenerico) panelGenerico.style.display = 'none';
    if (panelDotacion) panelDotacion.style.display = 'none';
    if (panelBases) panelBases.style.display = 'none';

    if (catalogo === 'dotacion') {
        if (panelDotacion) panelDotacion.style.display = 'block';
        if (typeof window.actualizarFechaDotacionUI === 'function') {
            window.actualizarFechaDotacionUI();
        }
        return;
    }
    if (catalogo === 'bases') {
        if (panelBases) panelBases.style.display = 'block';
        return;
    }

    if (panelGenerico) panelGenerico.style.display = 'block';

    const btnDocProv = document.getElementById('btnDocumentosProveedor');
    if (btnDocProv) {
        btnDocProv.style.display = (catalogo === 'proveedores') ? 'inline-block' : 'none';
    }

    const tituloCatalogo = document.getElementById('tituloCatalogo');
    const colCodigo = document.getElementById('colCodigo');
    const colNombre = document.getElementById('colNombre');
    const colEstado = document.getElementById('colEstado');

    const formProgramas = document.getElementById('form-programas');
    const formCursos = document.getElementById('form-cursos');
    const formInstructores = document.getElementById('form-instructores');
    const formProveedores = document.getElementById('form-proveedores');
    const formUsuarios = document.getElementById('form-usuarios');

    if (formProgramas) formProgramas.style.display = 'none';
    if (formCursos) formCursos.style.display = 'none';
    if (formInstructores) formInstructores.style.display = 'none';
    if (formProveedores) formProveedores.style.display = 'none';
    if (formUsuarios) formUsuarios.style.display = 'none';

    // Limpiar tabla inmediatamente para no mostrar datos del catálogo anterior
    const tbody = document.getElementById('tablaCatalogo');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #64748b;">⏳ Cargando catálogo...</td></tr>';
    }

    if (catalogo === 'programas') {
        if (tituloCatalogo) tituloCatalogo.textContent = 'Programas';
        if (colCodigo) colCodigo.textContent = 'Código';
        if (colNombre) colNombre.textContent = 'Programa';
        if (colEstado) colEstado.textContent = 'Estado';
        if (formProgramas) formProgramas.style.display = 'block';
        try {
            await cargarProgramas();
        } catch (err) {
            console.error('Error al cargar programas:', err);
        }
    } else if (catalogo === 'cursos') {
        if (tituloCatalogo) tituloCatalogo.textContent = 'Cursos';
        if (colCodigo) colCodigo.textContent = 'Código';
        if (colNombre) colNombre.textContent = 'Curso';
        if (colEstado) colEstado.textContent = 'Estado';
        if (formCursos) formCursos.style.display = 'block';
        try {
            await cargarCursos();
        } catch (err) {
            console.error('Error al cargar cursos:', err);
        }
    } else if (catalogo === 'instructores') {
        if (tituloCatalogo) tituloCatalogo.textContent = 'Instructores';
        if (colCodigo) colCodigo.textContent = 'Código';
        if (colNombre) colNombre.textContent = 'Instructor';
        if (colEstado) colEstado.textContent = 'Estado';
        if (formInstructores) formInstructores.style.display = 'block';
        try {
            await cargarInstructores();
        } catch (err) {
            console.error('Error al cargar instructores:', err);
        }
    } else if (catalogo === 'proveedores') {
        if (tituloCatalogo) tituloCatalogo.textContent = 'Proveedores / Entes Certificadores';
        if (colCodigo) colCodigo.textContent = 'Código';
        if (colNombre) colNombre.textContent = 'Razón Social / Ente Certificador';
        if (colEstado) colEstado.textContent = 'Estado';
        if (formProveedores) formProveedores.style.display = 'block';
        try {
            await cargarProveedores();
        } catch (err) {
            console.error('Error al cargar proveedores:', err);
        }
    } else if (catalogo === 'usuarios') {
        if (tituloCatalogo) tituloCatalogo.textContent = 'Catálogo de Usuarios y Permisos';
        if (colCodigo) colCodigo.textContent = 'Usuario';
        if (colNombre) colNombre.textContent = 'Nombre y Apellido / Rol';
        if (colEstado) colEstado.textContent = 'Estado';
        if (formUsuarios) formUsuarios.style.display = 'block';
        try {
            await cargarUsuarios();
        } catch (err) {
            console.error('Error al cargar usuarios:', err);
        }
    }
}
window.cambiarCatalogo = cambiarCatalogo;

// 3. CONSULTAS Y NORMALIZACIÓN DE TABLAS
async function cargarProgramas() {
    await asegurarCargasAuxiliaresProgramas();
    let progs = [];
    if (window.dbLocal && window.dbLocal.raw) {
        progs = window.dbLocal.raw.leerTabla('programas') || [];
    } else {
        const db = obtenerDB();
        if (db) {
            const { data } = await db.from('programas').select('*').order('codigo_programa', { ascending: true });
            if (data) progs = data;
        }
    }

    // Normalizar y reparar registros sin código o con valor "undefined"
    let huboCambio = false;
    progs = progs.filter(p => p && (p.nombre || p.codigo_programa || p.id));
    progs.forEach((p, idx) => {
        let cod = p.codigo_programa;
        if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
            cod = p.codigo || (p.id ? `PRO-${String(p.id).padStart(3, '0')}` : `PRO-${String(idx + 1).padStart(3, '0')}`);
            p.codigo_programa = cod;
            huboCambio = true;
        }
        if (!p.id) {
            p.id = idx + 1;
            huboCambio = true;
        }
        if (!p.estado) {
            p.estado = 'Activo';
            huboCambio = true;
        }
    });

    if (huboCambio && window.dbLocal && window.dbLocal.raw) {
        window.dbLocal.raw.escribirTabla('programas', progs);
    }

    datosCatalogoActual = progs;
    renderizarTabla(datosCatalogoActual);
}

async function cargarCursos() {
    let cursos = [];
    if (window.dbLocal && window.dbLocal.raw) {
        cursos = window.dbLocal.raw.leerTabla('cursos') || [];
    } else {
        const db = obtenerDB();
        if (db) {
            const { data } = await db.from('cursos').select('*').order('codigo_curso', { ascending: true });
            if (data) cursos = data;
        }
    }

    // Normalizar y reparar registros
    let huboCambio = false;
    cursos = cursos.filter(c => c && (c.nombre || c.codigo_curso || c.id));
    cursos.forEach((c, idx) => {
        let cod = c.codigo_curso;
        if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
            cod = c.codigo || (c.id ? `CUR-${String(c.id).padStart(3, '0')}` : `CUR-${String(idx + 1).padStart(3, '0')}`);
            c.codigo_curso = cod;
            huboCambio = true;
        }
        if (!c.id) {
            c.id = idx + 1;
            huboCambio = true;
        }
        if (!c.estado) {
            c.estado = 'Activo';
            huboCambio = true;
        }
        if (c.hs_totales === undefined || c.hs_totales === null) {
            c.hs_totales = (parseFloat(c.hs_teoria) || 0) + (parseFloat(c.hs_practica) || 0);
            huboCambio = true;
        }
    });

    if (huboCambio && window.dbLocal && window.dbLocal.raw) {
        window.dbLocal.raw.escribirTabla('cursos', cursos);
    }

    cacheCursosProg = cursos;
    window.cacheCursosProg = cursos;
    datosCatalogoActual = cursos;
    renderizarTabla(datosCatalogoActual);
}

async function cargarInstructores() {
    let insts = [];
    if (window.dbLocal && window.dbLocal.raw) {
        insts = window.dbLocal.raw.leerTabla('instructores') || [];
    } else {
        const db = obtenerDB();
        if (db) {
            const { data } = await db.from('instructores').select('*').order('codigo_instructor', { ascending: true });
            if (data) insts = data;
        }
    }

    // Normalizar y reparar registros
    let huboCambio = false;
    insts = insts.filter(i => i && (i.nombre || i.apellido || i.codigo_instructor || i.id));
    insts.forEach((i, idx) => {
        let cod = i.codigo_instructor;
        if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
            cod = i.codigo || (i.id ? `INS-${String(i.id).padStart(3, '0')}` : `INS-${String(idx + 1).padStart(3, '0')}`);
            i.codigo_instructor = cod;
            huboCambio = true;
        }
        if (!i.id) {
            i.id = idx + 1;
            huboCambio = true;
        }
        if (!i.estado) {
            i.estado = 'Activo';
            huboCambio = true;
        }
    });

    if (huboCambio && window.dbLocal && window.dbLocal.raw) {
        window.dbLocal.raw.escribirTabla('instructores', insts);
    }

    datosCatalogoActual = insts;
    renderizarTabla(datosCatalogoActual);
}

async function cargarProveedores() {
    let provs = [];
    if (window.dbLocal && typeof window.dbLocal.ready === 'function') {
        try {
            await window.dbLocal.ready();
        } catch (e) {
            console.warn('[Proveedores] Esperando dbLocal:', e);
        }
    }

    if (window.dbLocal && window.dbLocal.raw) {
        provs = window.dbLocal.raw.leerTabla('proveedores') || [];
    } else {
        const db = obtenerDB();
        if (db) {
            try {
                const { data } = await db.from('proveedores').select('*').order('codigo_proveedor', { ascending: true });
                if (data) provs = data;
            } catch (e) {
                console.warn('[Proveedores] Error consulta Supabase:', e);
            }
        }
    }

    // Si la lista está vacía, recuperar siempre desde SIGA_DATOS_INICIALES
    if (!provs || !Array.isArray(provs) || provs.length === 0) {
        if (window.SIGA_DATOS_INICIALES && Array.isArray(window.SIGA_DATOS_INICIALES['proveedores'])) {
            provs = JSON.parse(JSON.stringify(window.SIGA_DATOS_INICIALES['proveedores']));
            if (window.dbLocal && window.dbLocal.raw) {
                window.dbLocal.raw.escribirTabla('proveedores', provs);
            }
        }
    }
    localStorage.setItem('SIGA_DB_proveedores_inicializado', 'true');

    // Normalizar y reparar registros sin perder códigos ni carpetas de seguimiento
    let huboCambio = false;
    provs = (provs || []).filter(p => p && (p.razon_social || p.ente || p.codigo_proveedor || p.id));
    provs.forEach((p, idx) => {
        let cod = p.codigo_proveedor;
        if (!cod || cod === 'undefined' || cod === 'null' || String(cod).trim() === '') {
            cod = p.codigo || `PRV-${String(idx + 1).padStart(3, '0')}`;
            p.codigo_proveedor = cod;
            huboCambio = true;
        }
        if (!p.razon_social && p.nombre) {
            p.razon_social = p.nombre;
            huboCambio = true;
        }
        if (!p.ente) {
            p.ente = p.razon_social || p.nombre || 'ENTE';
            huboCambio = true;
        }
        if (!p.id) {
            p.id = idx + 1;
            huboCambio = true;
        }
        if (!p.estado) {
            p.estado = 'Activo';
            huboCambio = true;
        }
        if (!p.carpetas_seguimiento || !Array.isArray(p.carpetas_seguimiento)) {
            p.carpetas_seguimiento = [];
            huboCambio = true;
        }
    });

    if (huboCambio && window.dbLocal && window.dbLocal.raw) {
        window.dbLocal.raw.escribirTabla('proveedores', provs);
    }

    datosCatalogoActual = provs;
    renderizarTabla(datosCatalogoActual);
}

async function cargarUsuarios() {
    const db = obtenerDB();
    let usuarios = [];
    if (db) {
        const { data } = await db.from('profiles').select('*');
        if (data && data.length > 0) {
            usuarios = data;
        }
    }
    if (usuarios.length === 0) {
        try {
            const raw = localStorage.getItem('SIGA_DB_profiles');
            if (raw) usuarios = JSON.parse(raw);
        } catch (e) {}
    }
    if (!usuarios || usuarios.length === 0) {
        usuarios = [
            { id: 1, usuario: "Admin", clave: "CFT2026", nombre: "Ariel Pizzutto", email: "ariel.pizzutto@alumnos.udemm.edu.ar", rol: "Administrador", estado: "Activo" },
            { id: 2, usuario: "Operador", clave: "CFT2026", nombre: "Operador Capacitación", email: "capacitacion@empresa.com", rol: "Operador", estado: "Activo" },
            { id: 3, usuario: "Auditor", clave: "CFT2026", nombre: "Consulta Reportes", email: "reportes@empresa.com", rol: "Reportes", estado: "Activo" }
        ];
    }
    datosCatalogoActual = usuarios;
    renderizarTabla(datosCatalogoActual);
}

// 4. RENDERIZADO Y BÚSQUEDA DINÁMICA
function renderizarTabla(lista) {
    const tbody = document.getElementById('tablaCatalogo');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px;">No se encontraron registros.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((item, idx) => {
        let codigo = item.codigo_proveedor || item.codigo_programa || item.codigo_curso || item.codigo_instructor || item.usuario || item.codigo || item.id;
        
        // Garantizar que no aparezca el texto "undefined"
        if (!codigo || codigo === 'undefined' || codigo === 'null') {
            if (catalogoActual === 'programas') codigo = `PRO-${String(idx + 1).padStart(3, '0')}`;
            else if (catalogoActual === 'cursos') codigo = `CUR-${String(idx + 1).padStart(3, '0')}`;
            else if (catalogoActual === 'instructores') codigo = `INS-${String(idx + 1).padStart(3, '0')}`;
            else if (catalogoActual === 'proveedores') codigo = `PRV-${String(idx + 1).padStart(3, '0')}`;
            else codigo = `ID-${idx + 1}`;
        }

        let nombre = item.nombre;
        
        if (catalogoActual === 'instructores') {
            const ape = item.apellido || '';
            const nom = item.nombre || '';
            nombre = (ape || nom) ? `${ape}, ${nom}`.replace(/^,\s*|\s*,$/g, '') : '-';
        } else if (catalogoActual === 'proveedores') {
            const cantCarpetas = (item.carpetas_seguimiento && Array.isArray(item.carpetas_seguimiento)) ? item.carpetas_seguimiento.length : 0;
            const cantArchivos = (item.carpetas_seguimiento && Array.isArray(item.carpetas_seguimiento))
                ? item.carpetas_seguimiento.reduce((acc, c) => acc + ((c && c.archivos && Array.isArray(c.archivos)) ? c.archivos.length : 0), 0)
                : 0;

            const safeCodigo = String(codigo).replace(/'/g, "\\'");
            const badgeCarpetas = `<button type="button" onclick="event.stopPropagation(); abrirModalDocumentosProveedor('${safeCodigo}')" style="background:#0284c7; color:#fff; border:none; padding:3px 9px; border-radius:6px; font-size:0.75rem; font-weight:600; cursor:pointer; margin-left:8px;" title="Ver Carpetas de Seguimiento (Facturas, OS y Presupuestos)">📁 ${cantCarpetas} seguimiento(s) (${cantArchivos} arch.)</button>`;

            const enteBadge = `<span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; margin-left:6px; font-weight:700;">ENTE: ${item.ente || '-'}</span>`;
            nombre = `<strong>${item.razon_social || item.nombre || '-'}</strong> ${enteBadge} ${badgeCarpetas} <br><span style="font-size:0.8rem; color:#64748b;">${item.rubro ? item.rubro + ' | ' : ''}${item.contacto || ''} ${item.telefono ? '(' + item.telefono + ')' : ''}</span>`;
        } else if (catalogoActual === 'usuarios') {
            const badgeRol = `<span style="font-size:0.75rem; background:#e2e8f0; color:#1e293b; padding:2px 8px; border-radius:10px; margin-left:6px; font-weight:600;">${item.rol || 'Operador'}</span>`;
            nombre = `<strong>${item.nombre || item.usuario}</strong> ${badgeRol} <br><span style="font-size:0.8rem; color:#64748b;">${item.email || 'Sin correo registrado'}</span>`;
        } else if (catalogoActual === 'programas') {
            const safeCodigo = String(codigo).replace(/'/g, "\\'");
            const cantCursos = (item.cursos_asignados && Array.isArray(item.cursos_asignados)) ? item.cursos_asignados.length : 0;
            const metricas = typeof calcularMetricasProgramaRapidas === 'function' ? calcularMetricasProgramaRapidas(item) : { totalTarget: 0, totalCumplidos: 0, porcentaje: 0, empleadosUnicos: 0 };
            
            const badgeCursos = `<span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-weight:700;">📚 ${cantCursos} curso(s)</span>`;
            const badgeDest = `<span style="font-size:0.75rem; background:#f1f5f9; color:#334155; padding:2px 8px; border-radius:10px; font-weight:600;">👥 ${metricas.totalTarget} cursadas obj. (${metricas.empleadosUnicos} pers.)</span>`;
            const colorProg = metricas.porcentaje >= 75 ? '#16a34a' : (metricas.porcentaje >= 40 ? '#d97706' : '#64748b');
            const bgProg = metricas.porcentaje >= 75 ? '#dcfce7' : (metricas.porcentaje >= 40 ? '#fef3c7' : '#f1f5f9');
            const badgeCumplimiento = `<span style="font-size:0.75rem; background:${bgProg}; color:${colorProg}; padding:2px 8px; border-radius:10px; font-weight:700;">📈 ${metricas.porcentaje}% (${metricas.totalCumplidos}/${metricas.totalTarget})</span>`;
            const btnDetalle = `<button type="button" onclick="event.stopPropagation(); abrirModalDetallePrograma('${safeCodigo}')" style="background:#0284c7; color:#fff; border:none; padding:3px 10px; border-radius:6px; font-size:0.75rem; font-weight:600; cursor:pointer; margin-left:6px;" title="Ver detalle de cursos, público asignado y avance de cumplimiento">📊 Seguimiento y Detalle</button>`;

            nombre = `<strong>${item.nombre || '-'}</strong> ${btnDetalle} <br><div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">${badgeCursos} ${badgeDest} ${badgeCumplimiento}</div>${item.descripcion ? `<span style="font-size:0.8rem; color:#64748b; display:block; margin-top:3px;">${item.descripcion}</span>` : ''}`;
        }

        // Normalizar estado
        const estadoTexto = (item.estado || 'Activo').trim();
        const esActivo = estadoTexto.toLowerCase() === 'activo';
        const colorBg = esActivo ? '#27ae60' : '#e74c3c';

        const identificadorFila = String(codigo);

        return `
            <tr onclick="seleccionarFila('${identificadorFila}', ${idx})" style="cursor: pointer;" id="fila-${identificadorFila}" class="fila-catalogo">
                <td style="padding: 10px;"><strong>${codigo}</strong></td>
                <td style="padding: 10px;">${nombre || '-'}</td>
                <td style="padding: 10px;">
                    <span style="background:${colorBg}; color:#fff; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight: 500;">
                        ${estadoTexto}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    if (idSeleccionado) marcarFilaSeleccionada(idSeleccionado);
}

function filtrarTablaCatalogo() {
    const texto = document.getElementById('inputBuscarCatalogo')?.value.toLowerCase().trim() || '';
    if (!texto) {
        renderizarTabla(datosCatalogoActual);
        return;
    }

    const filtrados = datosCatalogoActual.filter(item => {
        const cod = String(item.codigo_proveedor || item.codigo_programa || item.codigo_curso || item.codigo_instructor || item.usuario || item.codigo || item.id || '').toLowerCase();
        const nom = String(item.nombre || item.razon_social || '').toLowerCase();
        const ente = String(item.ente || '').toLowerCase();
        const ape = String(item.apellido || '').toLowerCase();
        const rol = String(item.rol || '').toLowerCase();
        const mail = String(item.email || '').toLowerCase();
        return cod.includes(texto) || nom.includes(texto) || ente.includes(texto) || ape.includes(texto) || rol.includes(texto) || mail.includes(texto);
    });

    renderizarTabla(filtrados);
}

// 5. SELECCIÓN DE FILAS Y MANEJO DEL FORMULARIO
function seleccionarFila(codigo, index) {
    idSeleccionado = codigo;
    if (typeof index === 'number' && datosCatalogoActual && datosCatalogoActual[index]) {
        itemSeleccionadoOriginal = JSON.parse(JSON.stringify(datosCatalogoActual[index]));
    } else {
        itemSeleccionadoOriginal = datosCatalogoActual.find(it => {
            const cod = it.codigo_proveedor || it.codigo_programa || it.codigo_curso || it.codigo_instructor || it.usuario || it.codigo || it.id;
            return String(cod).trim().toLowerCase() === String(codigo).trim().toLowerCase();
        }) || null;
    }
    marcarFilaSeleccionada(codigo);
}
window.seleccionarFila = seleccionarFila;

function marcarFilaSeleccionada(codigo) {
    document.querySelectorAll('#tablaCatalogo tr').forEach(tr => tr.style.backgroundColor = '');
    const fila = document.getElementById(`fila-${codigo}`);
    if (fila) fila.style.backgroundColor = '#d1e7dd';
}

async function abrirFormularioNuevo() {
    modoEdicion = false;
    idSeleccionado = null;
    itemSeleccionadoOriginal = null;
    document.querySelectorAll('#tablaCatalogo tr').forEach(tr => tr.style.backgroundColor = '');
    
    document.getElementById('contenedorFormulario').style.display = 'block';
    document.getElementById('tituloFormulario').textContent = `Nuevo Registro en ${catalogoActual.toUpperCase()}`;

    if (catalogoActual === 'programas') {
        const codigo = await obtenerProximoCodigo('programas', 'codigo_programa', 'PRO');
        document.getElementById('pro_codigo').value = codigo;
        document.getElementById('pro_nombre').value = '';
        document.getElementById('pro_descripcion').value = '';
        document.getElementById('pro_estado').value = 'Activo';
        if (typeof inicializarFormularioCursosPrograma === 'function') {
            await inicializarFormularioCursosPrograma([]);
        }
    } else if (catalogoActual === 'cursos') {
        const codigo = await obtenerProximoCodigo('cursos', 'codigo_curso', 'CUR');
        document.getElementById('curso_codigo').value = codigo;
        document.getElementById('curso_nombre').value = '';
        document.getElementById('curso_modalidad').value = 'Presencial';
        document.getElementById('curso_teoria').value = 0;
        document.getElementById('curso_practica').value = 0;
        document.getElementById('curso_carga').value = 0;
        document.getElementById('curso_contenido').value = '';
        document.getElementById('curso_estado').value = 'Activo';
    } else if (catalogoActual === 'instructores') {
        const codigo = await obtenerProximoCodigo('instructores', 'codigo_instructor', 'INS');
        document.getElementById('ins_codigo').value = codigo;
        document.getElementById('ins_nombre').value = '';
        document.getElementById('ins_apellido').value = '';
        document.getElementById('ins_dni').value = '';
        document.getElementById('ins_email').value = '';
        document.getElementById('ins_especialidad').value = '';
        document.getElementById('ins_tipo').value = 'Interno';
        document.getElementById('ins_estado').value = 'Activo';
    } else if (catalogoActual === 'proveedores') {
        const codigo = await obtenerProximoCodigo('proveedores', 'codigo_proveedor', 'PRV');
        document.getElementById('prv_codigo').value = codigo;
        document.getElementById('prv_razon_social').value = '';
        document.getElementById('prv_ente').value = '';
        document.getElementById('prv_rubro').value = '';
        document.getElementById('prv_contacto').value = '';
        document.getElementById('prv_telefono').value = '';
        document.getElementById('prv_email').value = '';
        document.getElementById('prv_estado').value = 'Activo';
    } else if (catalogoActual === 'usuarios') {
        document.getElementById('usr_id').value = '';
        document.getElementById('usr_usuario').value = '';
        document.getElementById('usr_usuario').readOnly = false;
        document.getElementById('usr_clave').value = 'CFT2026';
        document.getElementById('usr_nombre').value = '';
        document.getElementById('usr_email').value = '';
        document.getElementById('usr_rol').value = 'Operador';
        document.getElementById('usr_estado').value = 'Activo';
    }

    document.getElementById('contenedorFormulario').scrollIntoView({ behavior: 'smooth' });
}
window.abrirFormularioNuevo = abrirFormularioNuevo;

async function abrirFormularioEditar() {
    if (!idSeleccionado && !itemSeleccionadoOriginal) {
        return alert('Por favor, seleccioná un registro de la lista para editar.');
    }

    modoEdicion = true;
    document.getElementById('contenedorFormulario').style.display = 'block';

    const item = itemSeleccionadoOriginal || datosCatalogoActual.find(it => {
        const cod = it.codigo_proveedor || it.codigo_programa || it.codigo_curso || it.codigo_instructor || it.usuario || it.codigo || it.id;
        return String(cod).trim().toLowerCase() === String(idSeleccionado).trim().toLowerCase();
    }) || {};

    let codActual = '';
    if (catalogoActual === 'proveedores') {
        codActual = item.codigo_proveedor || item.codigo || idSeleccionado || `PRV-${String(item.id || 1).padStart(3, '0')}`;
    } else {
        codActual = item.codigo_programa || item.codigo_curso || item.codigo_instructor || item.usuario || item.codigo || item.id || idSeleccionado;
    }

    document.getElementById('tituloFormulario').textContent = `Editar Registro: ${codActual}`;

    if (catalogoActual === 'programas') {
        document.getElementById('pro_codigo').value = codActual;
        document.getElementById('pro_nombre').value = item.nombre || '';
        document.getElementById('pro_descripcion').value = item.descripcion || '';
        document.getElementById('pro_estado').value = item.estado || 'Activo';
        if (typeof inicializarFormularioCursosPrograma === 'function') {
            await inicializarFormularioCursosPrograma(item.cursos_asignados || []);
        }
    } else if (catalogoActual === 'cursos') {
        document.getElementById('curso_codigo').value = codActual;
        document.getElementById('curso_nombre').value = item.nombre || '';
        document.getElementById('curso_modalidad').value = item.modalidad || 'Presencial';
        document.getElementById('curso_teoria').value = item.hs_teoria !== undefined ? item.hs_teoria : 0;
        document.getElementById('curso_practica').value = item.hs_practica !== undefined ? item.hs_practica : 0;
        document.getElementById('curso_carga').value = item.hs_totales !== undefined ? item.hs_totales : ((parseFloat(item.hs_teoria) || 0) + (parseFloat(item.hs_practica) || 0));
        document.getElementById('curso_contenido').value = item.contenido || '';
        document.getElementById('curso_estado').value = item.estado || 'Activo';
    } else if (catalogoActual === 'instructores') {
        document.getElementById('ins_codigo').value = codActual;
        document.getElementById('ins_nombre').value = item.nombre || '';
        document.getElementById('ins_apellido').value = item.apellido || '';
        document.getElementById('ins_dni').value = item.dni || '';
        document.getElementById('ins_email').value = item.email || '';
        document.getElementById('ins_especialidad').value = item.especialidad || '';
        document.getElementById('ins_tipo').value = item.tipo || 'Interno';
        document.getElementById('ins_estado').value = item.estado || 'Activo';
    } else if (catalogoActual === 'proveedores') {
        document.getElementById('prv_codigo').value = codActual;
        document.getElementById('prv_razon_social').value = item.razon_social || item.nombre || '';
        document.getElementById('prv_ente').value = item.ente || '';
        document.getElementById('prv_rubro').value = item.rubro || '';
        document.getElementById('prv_contacto').value = item.contacto || '';
        document.getElementById('prv_telefono').value = item.telefono || '';
        document.getElementById('prv_email').value = item.email || '';
        document.getElementById('prv_estado').value = item.estado || 'Activo';
    } else if (catalogoActual === 'usuarios') {
        document.getElementById('usr_id').value = item.id || '';
        document.getElementById('usr_usuario').value = item.usuario || '';
        document.getElementById('usr_usuario').readOnly = true;
        document.getElementById('usr_clave').value = item.clave || 'CFT2026';
        document.getElementById('usr_nombre').value = item.nombre || '';
        document.getElementById('usr_email').value = item.email || '';
        document.getElementById('usr_rol').value = item.rol || 'Operador';
        document.getElementById('usr_estado').value = item.estado || 'Activo';
    }

    document.getElementById('contenedorFormulario').scrollIntoView({ behavior: 'smooth' });
}
window.abrirFormularioEditar = abrirFormularioEditar;

function ocultarFormulario() {
    modoEdicion = false;
    const form = document.getElementById('contenedorFormulario');
    if (form) form.style.display = 'none';
}
window.ocultarFormulario = ocultarFormulario;

// 6. CÁLCULO DE HORAS DE CURSOS
function sumarHorasCurso() {
    const teoria = parseFloat(document.getElementById('curso_teoria')?.value) || 0;
    const practica = parseFloat(document.getElementById('curso_practica')?.value) || 0;
    const inputCarga = document.getElementById('curso_carga');
    if (inputCarga) inputCarga.value = teoria + practica;
}
window.sumarHorasCurso = sumarHorasCurso;

// 7. CORRELATIVO AUTOMÁTICO
async function obtenerProximoCodigo(tabla, columnaPK, prefijo) {
    const db = obtenerDB();
    const anioActual = new Date().getFullYear();
    const formatoPrefijo = `${prefijo}-${anioActual}`;

    let datos = [];
    if (window.dbLocal && window.dbLocal.raw) {
        datos = window.dbLocal.raw.leerTabla(tabla) || [];
    } else if (db) {
        try {
            const { data } = await db.from(tabla).select(columnaPK);
            if (data) datos = data;
        } catch (e) {}
    }

    if (!datos || datos.length === 0) return `${formatoPrefijo}-001`;

    let maxNum = 0;
    datos.forEach(item => {
        const val = item[columnaPK] || item.codigo;
        if (val) {
            const strVal = String(val);
            const partes = strVal.split('-');
            if (partes.length >= 3) {
                const num = parseInt(partes[2], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            } else if (partes.length === 2) {
                const num = parseInt(partes[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        }
        if (item.id && !isNaN(Number(item.id))) {
            const numId = Number(item.id);
            if (numId > maxNum && maxNum === 0) maxNum = numId;
        }
    });

    return `${formatoPrefijo}-${String(maxNum + 1).padStart(3, '0')}`;
}

// 8. GUARDAR Y PROCESAR
async function guardarRegistro() {
    const db = obtenerDB();
    if (!db) return;

    if (catalogoActual === 'programas') {
        let codigo = document.getElementById('pro_codigo').value.trim();
        const nombre = document.getElementById('pro_nombre').value.trim();
        if (!nombre) return alert('Ingresá el nombre del programa.');

        // Mantener código original si estamos en modo edición
        if (!codigo || codigo === 'undefined') {
            if (modoEdicion && itemSeleccionadoOriginal) {
                codigo = itemSeleccionadoOriginal.codigo_programa || itemSeleccionadoOriginal.codigo || itemSeleccionadoOriginal.id;
            }
            if (!codigo || codigo === 'undefined') {
                codigo = await obtenerProximoCodigo('programas', 'codigo_programa', 'PRO');
            }
        }

        const metricasProg = typeof calcularMetricasProgramaRapidas === 'function' 
            ? calcularMetricasProgramaRapidas({ cursos_asignados: cursosAsignadosPrograma }) 
            : { totalTarget: 0, totalCumplidos: 0, porcentaje: 0 };

        const payload = {
            codigo_programa: codigo,
            nombre: nombre,
            descripcion: document.getElementById('pro_descripcion').value.trim(),
            estado: document.getElementById('pro_estado').value,
            cursos_asignados: cursosAsignadosPrograma || [],
            total_cursos: (cursosAsignadosPrograma || []).length,
            total_destinatarios: metricasProg.totalTarget,
            total_cumplidos: metricasProg.totalCumplidos,
            porcentaje_cumplimiento: metricasProg.porcentaje
        };

        await procesarGuardado('programas', 'codigo_programa', payload, cargarProgramas);

    } else if (catalogoActual === 'cursos') {
        let codigo = document.getElementById('curso_codigo').value.trim();
        const nombre = document.getElementById('curso_nombre').value.trim();
        if (!nombre) return alert('Ingresá el nombre del curso.');

        if (!codigo || codigo === 'undefined') {
            if (modoEdicion && itemSeleccionadoOriginal) {
                codigo = itemSeleccionadoOriginal.codigo_curso || itemSeleccionadoOriginal.codigo || itemSeleccionadoOriginal.id;
            }
            if (!codigo || codigo === 'undefined') {
                codigo = await obtenerProximoCodigo('cursos', 'codigo_curso', 'CUR');
            }
        }

        const payload = {
            codigo_curso: codigo,
            nombre: nombre,
            modalidad: document.getElementById('curso_modalidad').value,
            hs_teoria: parseFloat(document.getElementById('curso_teoria').value) || 0,
            hs_practica: parseFloat(document.getElementById('curso_practica').value) || 0,
            hs_totales: parseFloat(document.getElementById('curso_carga').value) || 0,
            contenido: document.getElementById('curso_contenido').value.trim(),
            estado: document.getElementById('curso_estado').value
        };

        await procesarGuardado('cursos', 'codigo_curso', payload, cargarCursos);

    } else if (catalogoActual === 'instructores') {
        let codigo = document.getElementById('ins_codigo').value.trim();
        const nombre = document.getElementById('ins_nombre').value.trim();
        const apellido = document.getElementById('ins_apellido').value.trim();
        if (!nombre || !apellido) return alert('Ingresá nombre y apellido del instructor.');

        if (!codigo || codigo === 'undefined') {
            if (modoEdicion && itemSeleccionadoOriginal) {
                codigo = itemSeleccionadoOriginal.codigo_instructor || itemSeleccionadoOriginal.codigo || itemSeleccionadoOriginal.id;
            }
            if (!codigo || codigo === 'undefined') {
                codigo = await obtenerProximoCodigo('instructores', 'codigo_instructor', 'INS');
            }
        }

        const payload = {
            codigo_instructor: codigo,
            nombre: nombre,
            apellido: apellido,
            dni: document.getElementById('ins_dni').value.trim(),
            email: document.getElementById('ins_email').value.trim(),
            especialidad: document.getElementById('ins_especialidad').value.trim(),
            tipo: document.getElementById('ins_tipo').value,
            estado: document.getElementById('ins_estado').value
        };

        await procesarGuardado('instructores', 'codigo_instructor', payload, cargarInstructores);

    } else if (catalogoActual === 'proveedores') {
        let codigo = document.getElementById('prv_codigo').value.trim();
        const razonSocial = document.getElementById('prv_razon_social').value.trim();
        const enteVal = document.getElementById('prv_ente').value.trim();
        if (!razonSocial) return alert('Por favor ingresá la Razón Social del proveedor.');
        if (!enteVal) return alert('Por favor ingresá el Ente certificador asociado.');

        if (!codigo || codigo === 'undefined') {
            if (modoEdicion && itemSeleccionadoOriginal) {
                codigo = itemSeleccionadoOriginal.codigo_proveedor || itemSeleccionadoOriginal.codigo || itemSeleccionadoOriginal.id;
            }
            if (!codigo || codigo === 'undefined') {
                codigo = await obtenerProximoCodigo('proveedores', 'codigo_proveedor', 'PRV');
            }
        }

        const payload = {
            codigo_proveedor: codigo,
            razon_social: razonSocial,
            ente: enteVal,
            rubro: document.getElementById('prv_rubro').value.trim(),
            contacto: document.getElementById('prv_contacto').value.trim(),
            telefono: document.getElementById('prv_telefono').value.trim(),
            email: document.getElementById('prv_email').value.trim(),
            estado: document.getElementById('prv_estado').value,
            carpetas_seguimiento: (modoEdicion && itemSeleccionadoOriginal && itemSeleccionadoOriginal.carpetas_seguimiento) ? itemSeleccionadoOriginal.carpetas_seguimiento : []
        };

        await procesarGuardado('proveedores', 'codigo_proveedor', payload, cargarProveedores);

    } else if (catalogoActual === 'usuarios') {
        const usuarioVal = document.getElementById('usr_usuario').value.trim();
        const claveVal = document.getElementById('usr_clave').value.trim();
        const nombreVal = document.getElementById('usr_nombre').value.trim();
        const emailVal = document.getElementById('usr_email').value.trim();
        const rolVal = document.getElementById('usr_rol').value;
        const estadoVal = document.getElementById('usr_estado').value;

        if (!usuarioVal) return alert('Por favor ingresá el nombre de usuario para el login.');
        if (!claveVal) return alert('Por favor ingresá una contraseña.');
        if (!nombreVal) return alert('Por favor ingresá el nombre y apellido.');

        const payload = {
            usuario: usuarioVal,
            clave: claveVal,
            nombre: nombreVal,
            email: emailVal,
            rol: rolVal,
            estado: estadoVal
        };

        await procesarGuardado('profiles', 'usuario', payload, cargarUsuarios);
    }
}
window.guardarRegistro = guardarRegistro;

async function procesarGuardado(tabla, columnaPK, payload, funcionRecargar) {
    const valorPK = payload[columnaPK];

    // 1. Guardar en Base de Datos Local
    if (window.dbLocal && window.dbLocal.raw) {
        let items = window.dbLocal.raw.leerTabla(tabla) || [];
        
        let index = -1;
        if (modoEdicion && itemSeleccionadoOriginal) {
            const origPK = itemSeleccionadoOriginal[columnaPK] || itemSeleccionadoOriginal.codigo || itemSeleccionadoOriginal.id || itemSeleccionadoOriginal.usuario;
            index = items.findIndex(x => {
                const xPK = x[columnaPK] || x.codigo || x.id || x.usuario;
                if (origPK !== undefined && xPK !== undefined && String(xPK).trim().toLowerCase() === String(origPK).trim().toLowerCase()) return true;
                if (x[columnaPK] !== undefined && valorPK !== undefined && String(x[columnaPK]).trim().toLowerCase() === String(valorPK).trim().toLowerCase()) return true;
                if (x.id !== undefined && itemSeleccionadoOriginal.id !== undefined && String(x.id) === String(itemSeleccionadoOriginal.id)) return true;
                if (x.nombre && itemSeleccionadoOriginal.nombre && String(x.nombre).trim().toLowerCase() === String(itemSeleccionadoOriginal.nombre).trim().toLowerCase()) return true;
                return false;
            });
        } else {
            index = items.findIndex(x => {
                const xPK = x[columnaPK];
                return xPK !== undefined && valorPK !== undefined && String(xPK).trim().toLowerCase() === String(valorPK).trim().toLowerCase();
            });
        }

        if (index >= 0) {
            // Modificar registro existente manteniendo id original y código original
            items[index] = { ...items[index], ...payload };
        } else {
            // Agregar nuevo registro con id autoincremental
            const maxId = items.reduce((acc, curr) => Math.max(acc, Number(curr.id) || 0), 0);
            payload.id = maxId + 1;
            items.push(payload);
        }

        window.dbLocal.raw.escribirTabla(tabla, items);
        if (tabla === 'cursos') {
            cacheCursosProg = items;
            window.cacheCursosProg = items;
        }
    }

    // 2. Sincronizar en Supabase si está disponible
    try {
        let cloudDB = window.supabaseCloudClient;
        if (!cloudDB && typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
            cloudDB = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        }
        if (cloudDB) {
            await cloudDB.from(tabla).upsert([payload], { onConflict: columnaPK });
        }
    } catch (err) {
        console.warn("Aviso al sincronizar en la nube:", err);
    }

    const accionMsg = modoEdicion ? 'modificado' : 'guardado';
    alert(`Registro ${accionMsg} exitosamente.`);
    modoEdicion = false;
    idSeleccionado = null;
    itemSeleccionadoOriginal = null;
    ocultarFormulario();
    await funcionRecargar();
}

// 9. ELIMINAR REGISTRO
async function eliminarRegistro() {
    if (!idSeleccionado && !itemSeleccionadoOriginal) {
        return alert('Seleccioná un registro de la lista para eliminar.');
    }

    const itemAEliminar = itemSeleccionadoOriginal || datosCatalogoActual.find(it => {
        const cod = it.codigo_proveedor || it.codigo_programa || it.codigo_curso || it.codigo_instructor || it.usuario || it.codigo || it.id;
        return String(cod).trim().toLowerCase() === String(idSeleccionado).trim().toLowerCase();
    }) || {};

    const nombreMostrar = itemAEliminar.razon_social || itemAEliminar.nombre || itemAEliminar.usuario || idSeleccionado || 'seleccionado';
    if (!confirm(`¿Estás seguro de eliminar el registro '${nombreMostrar}'?`)) return;

    const db = obtenerDB();
    
    if (catalogoActual === 'usuarios') {
        const userTarget = itemAEliminar.usuario || idSeleccionado;
        if (userTarget && userTarget.toLowerCase() === 'admin') {
            return alert('No es posible eliminar al usuario Administrador principal del sistema.');
        }

        const sesionActual = JSON.parse(localStorage.getItem('siga_usuario_activo') || '{}');
        if (sesionActual.usuario && userTarget && sesionActual.usuario.toLowerCase() === userTarget.toLowerCase()) {
            return alert('No podés eliminar el usuario con el que tenés la sesión iniciada actualmente.');
        }

        if (window.dbLocal && window.dbLocal.raw) {
            let items = window.dbLocal.raw.leerTabla('profiles') || [];
            items = items.filter(u => String(u.usuario || '').toLowerCase() !== String(userTarget).toLowerCase());
            window.dbLocal.raw.escribirTabla('profiles', items);
            localStorage.setItem('SIGA_DB_profiles_inicializado', 'true');
        }

        try {
            if (db) await db.from('profiles').delete().eq('usuario', userTarget);
        } catch (e) {}

        alert('Usuario eliminado correctamente.');
        idSeleccionado = null;
        itemSeleccionadoOriginal = null;
        ocultarFormulario();
        await cargarUsuarios();
        return;
    }

    let columnaPK = 'codigo_programa';
    if (catalogoActual === 'cursos') columnaPK = 'codigo_curso';
    if (catalogoActual === 'instructores') columnaPK = 'codigo_instructor';
    if (catalogoActual === 'proveedores') columnaPK = 'codigo_proveedor';

    const codPK = itemAEliminar[columnaPK] || itemAEliminar.codigo || idSeleccionado;

    // 1. Borrar en dbLocal con coincidencia múltiple robusta
    if (window.dbLocal && window.dbLocal.raw) {
        let items = window.dbLocal.raw.leerTabla(catalogoActual) || [];
        const selLower = String(idSeleccionado || '').trim().toLowerCase();
        const codPKLower = String(codPK || '').trim().toLowerCase();
        const nomLower = String(itemAEliminar.nombre || itemAEliminar.razon_social || '').trim().toLowerCase();
        const idLower = itemAEliminar.id !== undefined ? String(itemAEliminar.id).trim().toLowerCase() : null;

        items = items.filter(it => {
            const itPK = String(it[columnaPK] || it.codigo || '').trim().toLowerCase();
            const itId = it.id !== undefined ? String(it.id).trim().toLowerCase() : null;
            const itNom = String(it.nombre || it.razon_social || '').trim().toLowerCase();

            // Si coincide el código principal
            if (codPKLower && codPKLower !== 'undefined' && itPK === codPKLower) return false;
            if (selLower && selLower !== 'undefined' && itPK === selLower) return false;
            // Si coincide el id numérico
            if (idLower && itId === idLower) return false;
            // Si coincide el nombre o razón social
            if (nomLower && itNom === nomLower && nomLower !== '') return false;
            return true;
        });

        window.dbLocal.raw.escribirTabla(catalogoActual, items);
        localStorage.setItem(`SIGA_DB_${catalogoActual}_inicializado`, 'true');
        if (catalogoActual === 'cursos') {
            cacheCursosProg = items;
            window.cacheCursosProg = items;
        }
    }

    // 2. Borrar en la nube si está disponible
    try {
        if (db && codPK && codPK !== 'undefined') {
            await db.from(catalogoActual).delete().eq(columnaPK, codPK);
        }
    } catch (e) {}

    alert('Registro eliminado correctamente.');
    idSeleccionado = null;
    itemSeleccionadoOriginal = null;
    ocultarFormulario();
    if (catalogoActual === 'programas') await cargarProgramas();
    if (catalogoActual === 'cursos') await cargarCursos();
    if (catalogoActual === 'instructores') await cargarInstructores();
    if (catalogoActual === 'proveedores') await cargarProveedores();
}
window.eliminarRegistro = eliminarRegistro;

//==============================================================================
// 10. GESTIÓN DOCUMENTAL Y SEGUIMIENTO DE PROVEEDORES (FACTURAS, OS Y PRESUPUESTOS)
//==============================================================================

let proveedorDocumentosActual = null;
let archivosTemporalesCarpeta = [];

function abrirModalDocumentosProveedor(codigoProv) {
    let prov = null;

    if (codigoProv) {
        prov = datosCatalogoActual.find(p => {
            const cod = p.codigo_proveedor || p.codigo || p.id;
            return String(cod).trim().toLowerCase() === String(codigoProv).trim().toLowerCase();
        });
    } else if (idSeleccionado || itemSeleccionadoOriginal) {
        prov = itemSeleccionadoOriginal || datosCatalogoActual.find(p => {
            const cod = p.codigo_proveedor || p.codigo || p.id;
            return String(cod).trim().toLowerCase() === String(idSeleccionado).trim().toLowerCase();
        });
    }

    if (!prov) {
        return alert('Por favor seleccioná un proveedor de la lista para gestionar sus facturas y órdenes de servicio.');
    }

    proveedorDocumentosActual = prov;
    if (!proveedorDocumentosActual.carpetas_seguimiento || !Array.isArray(proveedorDocumentosActual.carpetas_seguimiento)) {
        proveedorDocumentosActual.carpetas_seguimiento = [];
    }

    // Actualizar encabezado del modal
    const sub = document.getElementById('docProvSubtitulo');
    if (sub) {
        sub.innerHTML = `<strong>${prov.razon_social || prov.nombre || 'Proveedor'}</strong> &bull; Código: <span style="color:#38bdf8;">${prov.codigo_proveedor || prov.codigo || 'S/C'}</span> &bull; Ente: <strong>${prov.ente || '-'}</strong>`;
    }

    cancelarFormularioCarpeta();
    const inputBusqueda = document.getElementById('busquedaSeguimientoProv');
    if (inputBusqueda) inputBusqueda.value = '';

    renderizarCarpetasSeguimiento();

    const modal = document.getElementById('modalDocumentosProveedor');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalDocumentosProveedor = abrirModalDocumentosProveedor;

function cerrarModalDocumentosProveedor() {
    const modal = document.getElementById('modalDocumentosProveedor');
    if (modal) modal.style.display = 'none';
    proveedorDocumentosActual = null;
    archivosTemporalesCarpeta = [];
}
window.cerrarModalDocumentosProveedor = cerrarModalDocumentosProveedor;

function renderizarCarpetasSeguimiento(filtro = '') {
    const contenedor = document.getElementById('contenedorListaCarpetas');
    const resumen = document.getElementById('resumenCarpetasProv');
    if (!contenedor || !proveedorDocumentosActual) return;

    let carpetas = proveedorDocumentosActual.carpetas_seguimiento || [];

    if (filtro && filtro.trim() !== '') {
        const f = filtro.toLowerCase().trim();
        carpetas = carpetas.filter(c => {
            const desc = (c.descripcion || '').toLowerCase();
            const ref = (c.nroRef || '').toLowerCase();
            const fecha = (c.fecha || '').toLowerCase();
            const est = (c.estado || '').toLowerCase();
            const tieneArch = (c.archivos || []).some(a => (a.nombre || '').toLowerCase().includes(f) || (a.tipo || '').toLowerCase().includes(f) || (a.etiqueta || '').toLowerCase().includes(f));
            return desc.includes(f) || ref.includes(f) || fecha.includes(f) || est.includes(f) || tieneArch;
        });
    }

    if (resumen) {
        const total = (proveedorDocumentosActual.carpetas_seguimiento || []).length;
        resumen.textContent = `${total} carpeta(s) de actividad registrada(s)${filtro ? ` (filtradas: ${carpetas.length})` : ''}`;
    }

    if (carpetas.length === 0) {
        contenedor.innerHTML = `
            <div style="background:#f8fafc; border:2px dashed #cbd5e1; border-radius:10px; padding:36px 20px; text-align:center; color:#64748b;">
                <div style="font-size:2.2rem; margin-bottom:8px;">📁</div>
                <div style="font-weight:600; font-size:1rem; color:#334155; margin-bottom:4px;">No hay carpetas de seguimiento registradas</div>
                <div style="font-size:0.85rem;">Hacé clic en <strong>"➕ Nueva Carpeta de Actividad"</strong> para adjuntar presupuestos, facturas y órdenes de servicio asociadas.</div>
            </div>
        `;
        return;
    }

    // Ordenar por fecha descendente
    const carpetasOrdenadas = [...carpetas].reverse();

    contenedor.innerHTML = carpetasOrdenadas.map((c) => {
        const archivos = c.archivos || [];
        const cantPresupuestos = archivos.filter(a => a.tipo === 'Presupuesto').length;
        const cantFacturas = archivos.filter(a => a.tipo === 'Factura').length;
        const cantOS = archivos.filter(a => a.tipo.includes('OS') || a.tipo.includes('Orden')).length;
        const cantOtros = archivos.length - cantPresupuestos - cantFacturas - cantOS;

        let badgeEstado = '<span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">En Curso</span>';
        if (c.estado === 'Completado') {
            badgeEstado = '<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">✅ Completado / Aprobado</span>';
        } else if (c.estado === 'Pendiente OS') {
            badgeEstado = '<span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">⏳ Pendiente OS</span>';
        } else if (c.estado === 'Pendiente Factura') {
            badgeEstado = '<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">🧾 Pendiente Factura</span>';
        }

        const archivosHtml = archivos.length > 0 ? archivos.map(a => {
            let icono = '📄';
            let colorPill = '#475569';
            let bgPill = '#f1f5f9';
            if (a.tipo === 'Factura') { icono = '🧾'; colorPill = '#b91c1c'; bgPill = '#fee2e2'; }
            else if (a.tipo.includes('OS') || a.tipo.includes('Orden')) { icono = '📝'; colorPill = '#0369a1'; bgPill = '#e0f2fe'; }
            else if (a.tipo === 'Presupuesto') { icono = '💼'; colorPill = '#b45309'; bgPill = '#fef3c7'; }
            else if (a.tipo.includes('Certificado')) { icono = '🏆'; colorPill = '#15803d'; bgPill = '#dcfce7'; }

            return `
                <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 12px; font-size:0.83rem;">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                        <span style="font-size:1.1rem;">${icono}</span>
                        <span style="background:${bgPill}; color:${colorPill}; padding:2px 7px; border-radius:4px; font-size:0.72rem; font-weight:700; white-space:nowrap;">${a.tipo}</span>
                        <strong style="color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;" title="${a.nombre}">${a.nombre}</strong>
                        ${a.etiqueta ? `<span style="color:#64748b; font-size:0.75rem;">(${a.etiqueta})</span>` : ''}
                        <span style="color:#94a3b8; font-size:0.72rem;">${a.tamano || ''}</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button onclick="abrirVisorPDF('${encodeURIComponent(a.nombre)}', '${a.id}', '${c.id}')" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; font-weight:600;" title="Ver en visor">👁️ Ver</button>
                        <button onclick="descargarArchivoSeguimiento('${encodeURIComponent(a.nombre)}', '${a.id}', '${c.id}')" style="background:#475569; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; font-weight:600;" title="Descargar archivo">⬇️</button>
                    </div>
                </div>
            `;
        }).join('') : '<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">Sin archivos adjuntos en esta carpeta</div>';

        return `
            <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:1.15rem;">📁</span>
                            <strong style="font-size:1rem; color:#0f172a;">${c.descripcion}</strong>
                            ${badgeEstado}
                            ${c.nroRef ? `<span style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:600;">Ref: ${c.nroRef}</span>` : ''}
                        </div>
                        <div style="font-size:0.8rem; color:#64748b; margin-top:3px; display:flex; gap:12px; align-items:center;">
                            <span>📅 Fecha: <strong>${c.fecha || 'Sin fecha'}</strong></span>
                            <span>📎 Contenido: <strong>${cantPresupuestos} Presupuesto</strong> | <strong>${cantFacturas} Factura(s)</strong> | <strong>${cantOS} OS</strong>${cantOtros > 0 ? ` | <strong>${cantOtros} Otro(s)</strong>` : ''}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button onclick="editarCarpetaSeguimiento('${c.id}')" style="background:#e2e8f0; color:#1e293b; border:1px solid #cbd5e1; padding:5px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer; font-weight:600;">✏️ Editar</button>
                        <button onclick="eliminarCarpetaSeguimiento('${c.id}')" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:5px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer; font-weight:600;">🗑️ Eliminar</button>
                    </div>
                </div>

                <div style="background:#f8fafc; border-radius:8px; padding:10px; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:6px;">
                    <div style="font-size:0.78rem; font-weight:700; color:#475569; margin-bottom:2px;">Documentos Vinculados (${archivos.length})</div>
                    ${archivosHtml}
                </div>
            </div>
        `;
    }).join('');
}

function filtrarCarpetasSeguimiento() {
    const texto = document.getElementById('busquedaSeguimientoProv')?.value || '';
    renderizarCarpetasSeguimiento(texto);
}
window.filtrarCarpetasSeguimiento = filtrarCarpetasSeguimiento;

function mostrarFormularioNuevaCarpeta(idCarpetaEditar = null) {
    const contenedorForm = document.getElementById('formCarpetaActividad');
    if (!contenedorForm) return;

    contenedorForm.style.display = 'block';

    const editIdInput = document.getElementById('editCarpetaId');
    const tituloForm = document.getElementById('tituloFormCarpeta');
    const descInput = document.getElementById('carpetaDescripcion');
    const fechaInput = document.getElementById('carpetaFecha');
    const estadoInput = document.getElementById('carpetaEstado');
    const refInput = document.getElementById('carpetaNroRef');

    if (idCarpetaEditar) {
        const carpeta = (proveedorDocumentosActual.carpetas_seguimiento || []).find(c => c.id === idCarpetaEditar);
        if (carpeta) {
            editIdInput.value = carpeta.id;
            tituloForm.textContent = `✏️ Editar Carpeta: ${carpeta.descripcion}`;
            descInput.value = carpeta.descripcion || '';
            fechaInput.value = carpeta.fecha || '';
            estadoInput.value = carpeta.estado || 'Completado';
            refInput.value = carpeta.nroRef || '';
            archivosTemporalesCarpeta = JSON.parse(JSON.stringify(carpeta.archivos || []));
        }
    } else {
        editIdInput.value = '';
        tituloForm.textContent = '📁 Registrar Carpeta de Actividad (Presupuesto + Facturas + OS)';
        descInput.value = '';
        fechaInput.value = new Date().toISOString().split('T')[0];
        estadoInput.value = 'Completado';
        refInput.value = '';
        archivosTemporalesCarpeta = [];
    }

    renderizarListaArchivosTemporales();
    contenedorForm.scrollIntoView({ behavior: 'smooth' });
}
window.mostrarFormularioNuevaCarpeta = mostrarFormularioNuevaCarpeta;

function cancelarFormularioCarpeta() {
    const contenedorForm = document.getElementById('formCarpetaActividad');
    if (contenedorForm) contenedorForm.style.display = 'none';
    archivosTemporalesCarpeta = [];
}
window.cancelarFormularioCarpeta = cancelarFormularioCarpeta;

async function agregarArchivosACarpeta(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const tipo = document.getElementById('tipoArchivoNuevo')?.value || 'Factura';
    const etiqueta = document.getElementById('etiquetaArchivoNuevo')?.value.trim() || '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Calcular tamaño amigable
        let sizeStr = '';
        if (file.size < 1024 * 1024) {
            sizeStr = `${Math.round(file.size / 1024)} KB`;
        } else {
            sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        }

        try {
            const base64Data = await leerArchivoComoDataURL(file);
            archivosTemporalesCarpeta.push({
                id: 'ARCH-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
                nombre: file.name,
                tipo: tipo,
                etiqueta: etiqueta || (files.length > 1 ? `${tipo} ${i + 1}` : ''),
                tamano: sizeStr,
                tipoMime: file.type || 'application/pdf',
                contenido: base64Data
            });
        } catch (err) {
            console.error("Error al leer archivo:", err);
            alert(`No se pudo leer el archivo ${file.name}`);
        }
    }

    // Limpiar input file para permitir volver a cargar
    event.target.value = '';
    const etiqInput = document.getElementById('etiquetaArchivoNuevo');
    if (etiqInput) etiqInput.value = '';

    renderizarListaArchivosTemporales();
}
window.agregarArchivosACarpeta = agregarArchivosACarpeta;

function leerArchivoComoDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function eliminarArchivoTemporal(idArchivo) {
    archivosTemporalesCarpeta = archivosTemporalesCarpeta.filter(a => a.id !== idArchivo);
    renderizarListaArchivosTemporales();
}
window.eliminarArchivoTemporal = eliminarArchivoTemporal;

function renderizarListaArchivosTemporales() {
    const contenedor = document.getElementById('listaArchivosCarpeta');
    if (!contenedor) return;

    if (archivosTemporalesCarpeta.length === 0) {
        contenedor.innerHTML = '<span style="color:#94a3b8; font-size:0.8rem; font-style:italic;">No hay archivos adjuntos en esta carpeta aún. Podés agregar más de 2 archivos (presupuesto, facturas múltiples y OS múltiples).</span>';
        return;
    }

    contenedor.innerHTML = archivosTemporalesCarpeta.map(a => {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; font-size:0.82rem;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="background:#0284c7; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:700;">${a.tipo}</span>
                    <strong>${a.nombre}</strong>
                    ${a.etiqueta ? `<span style="color:#64748b;">(${a.etiqueta})</span>` : ''}
                    <span style="color:#94a3b8; font-size:0.72rem;">${a.tamano}</span>
                </div>
                <button type="button" onclick="eliminarArchivoTemporal('${a.id}')" style="background:#fee2e2; color:#b91c1c; border:none; padding:2px 7px; border-radius:4px; cursor:pointer; font-weight:bold;" title="Quitar archivo">✕</button>
            </div>
        `;
    }).join('');
}

async function guardarCarpetaSeguimiento() {
    if (!proveedorDocumentosActual) return;

    const desc = document.getElementById('carpetaDescripcion')?.value.trim();
    if (!desc) {
        return alert('Por favor ingresá una descripción para la actividad (ej: END US - 03/09/2026).');
    }

    const editId = document.getElementById('editCarpetaId')?.value;
    const fecha = document.getElementById('carpetaFecha')?.value || new Date().toISOString().split('T')[0];
    const estado = document.getElementById('carpetaEstado')?.value || 'Completado';
    const nroRef = document.getElementById('carpetaNroRef')?.value.trim() || '';

    if (!proveedorDocumentosActual.carpetas_seguimiento) {
        proveedorDocumentosActual.carpetas_seguimiento = [];
    }

    if (editId) {
        // Modificar carpeta existente
        const idx = proveedorDocumentosActual.carpetas_seguimiento.findIndex(c => c.id === editId);
        if (idx >= 0) {
            proveedorDocumentosActual.carpetas_seguimiento[idx] = {
                ...proveedorDocumentosActual.carpetas_seguimiento[idx],
                descripcion: desc,
                fecha: fecha,
                estado: estado,
                nroRef: nroRef,
                archivos: archivosTemporalesCarpeta
            };
        }
    } else {
        // Crear nueva carpeta de seguimiento
        const nuevaCarpeta = {
            id: 'CARP-' + Date.now(),
            descripcion: desc,
            fecha: fecha,
            estado: estado,
            nroRef: nroRef,
            archivos: archivosTemporalesCarpeta,
            fechaRegistro: new Date().toISOString()
        };
        proveedorDocumentosActual.carpetas_seguimiento.push(nuevaCarpeta);
    }

    // Persistir en Base de Datos Local
    if (window.dbLocal && window.dbLocal.raw) {
        let provs = window.dbLocal.raw.leerTabla('proveedores') || [];
        const provCod = proveedorDocumentosActual.codigo_proveedor || proveedorDocumentosActual.codigo || proveedorDocumentosActual.id;
        const pIdx = provs.findIndex(p => {
            const c = p.codigo_proveedor || p.codigo || p.id;
            return String(c).trim().toLowerCase() === String(provCod).trim().toLowerCase();
        });

        if (pIdx >= 0) {
            provs[pIdx].carpetas_seguimiento = proveedorDocumentosActual.carpetas_seguimiento;
            window.dbLocal.raw.escribirTabla('proveedores', provs);
        }
    }

    // Sincronizar en nube si está disponible
    try {
        const db = obtenerDB();
        const provCod = proveedorDocumentosActual.codigo_proveedor;
        if (db && provCod) {
            await db.from('proveedores').update({
                carpetas_seguimiento: proveedorDocumentosActual.carpetas_seguimiento
            }).eq('codigo_proveedor', provCod);
        }
    } catch (err) {
        console.warn("Aviso al sincronizar carpetas en la nube:", err);
    }

    alert('Carpeta de actividad y documentos guardados con éxito.');
    cancelarFormularioCarpeta();
    renderizarCarpetasSeguimiento();
    await cargarProveedores();
}
window.guardarCarpetaSeguimiento = guardarCarpetaSeguimiento;

function editarCarpetaSeguimiento(idCarpeta) {
    mostrarFormularioNuevaCarpeta(idCarpeta);
}
window.editarCarpetaSeguimiento = editarCarpetaSeguimiento;

async function eliminarCarpetaSeguimiento(idCarpeta) {
    if (!proveedorDocumentosActual) return;
    const carpeta = (proveedorDocumentosActual.carpetas_seguimiento || []).find(c => c.id === idCarpeta);
    if (!carpeta) return;

    if (!confirm(`¿Estás seguro de eliminar la carpeta '${carpeta.descripcion}' y todos sus archivos adjuntos?`)) return;

    proveedorDocumentosActual.carpetas_seguimiento = proveedorDocumentosActual.carpetas_seguimiento.filter(c => c.id !== idCarpeta);

    // Persistir
    if (window.dbLocal && window.dbLocal.raw) {
        let provs = window.dbLocal.raw.leerTabla('proveedores') || [];
        const provCod = proveedorDocumentosActual.codigo_proveedor || proveedorDocumentosActual.codigo || proveedorDocumentosActual.id;
        const pIdx = provs.findIndex(p => {
            const c = p.codigo_proveedor || p.codigo || p.id;
            return String(c).trim().toLowerCase() === String(provCod).trim().toLowerCase();
        });

        if (pIdx >= 0) {
            provs[pIdx].carpetas_seguimiento = proveedorDocumentosActual.carpetas_seguimiento;
            window.dbLocal.raw.escribirTabla('proveedores', provs);
        }
    }

    try {
        const db = obtenerDB();
        const provCod = proveedorDocumentosActual.codigo_proveedor;
        if (db && provCod) {
            await db.from('proveedores').update({
                carpetas_seguimiento: proveedorDocumentosActual.carpetas_seguimiento
            }).eq('codigo_proveedor', provCod);
        }
    } catch (e) {}

    alert('Carpeta eliminada correctamente.');
    renderizarCarpetasSeguimiento();
    await cargarProveedores();
}
window.eliminarCarpetaSeguimiento = eliminarCarpetaSeguimiento;

// Visor y Descarga de Archivos
let archivoActivoVisor = null;

function abrirVisorPDF(nombreEncoded, idArchivo, idCarpeta) {
    const nombre = decodeURIComponent(nombreEncoded);
    if (!proveedorDocumentosActual) return;
    const carpeta = (proveedorDocumentosActual.carpetas_seguimiento || []).find(c => c.id === idCarpeta);
    if (!carpeta) return;
    const archivo = (carpeta.archivos || []).find(a => a.id === idArchivo);
    if (!archivo || !archivo.contenido) {
        return alert('No se encontró el contenido del archivo.');
    }

    archivoActivoVisor = archivo;
    const modal = document.getElementById('modalVisorPDF');
    const iframe = document.getElementById('iframeVisorPDF');
    const titulo = document.getElementById('tituloVisorPDF');
    const btnDescargar = document.getElementById('btnDescargarVisorPDF');

    if (titulo) titulo.textContent = `${archivo.tipo}: ${archivo.nombre}`;
    if (iframe) iframe.src = archivo.contenido;
    if (btnDescargar) {
        btnDescargar.onclick = () => descargarArchivoSeguimiento(nombreEncoded, idArchivo, idCarpeta);
    }

    if (modal) modal.style.display = 'flex';
}
window.abrirVisorPDF = abrirVisorPDF;

function cerrarVisorPDF() {
    const modal = document.getElementById('modalVisorPDF');
    const iframe = document.getElementById('iframeVisorPDF');
    if (iframe) iframe.src = '';
    if (modal) modal.style.display = 'none';
    archivoActivoVisor = null;
}
window.cerrarVisorPDF = cerrarVisorPDF;

function descargarArchivoSeguimiento(nombreEncoded, idArchivo, idCarpeta) {
    const nombre = decodeURIComponent(nombreEncoded);
    if (!proveedorDocumentosActual) return;
    const carpeta = (proveedorDocumentosActual.carpetas_seguimiento || []).find(c => c.id === idCarpeta);
    if (!carpeta) return;
    const archivo = (carpeta.archivos || []).find(a => a.id === idArchivo);
    if (!archivo || !archivo.contenido) return alert('No se pudo descargar el archivo.');

    const enlace = document.createElement('a');
    enlace.href = archivo.contenido;
    enlace.download = archivo.nombre || nombre || 'documento.pdf';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}
window.descargarArchivoSeguimiento = descargarArchivoSeguimiento;

//==============================================================================
// 11. IMPORTACIÓN Y EXPORTACIÓN DEL CATÁLOGO (PROVEEDORES Y DEMÁS)
//==============================================================================

let archivoImportacionPendiente = null;
let registrosImportadosParseados = [];

function exportarCatalogoActual() {
    if (typeof XLSX === 'undefined') {
        return alert('La librería de exportación Excel no está disponible.');
    }

    const tabla = catalogoActual;
    let registros = [];
    if (window.dbLocal && window.dbLocal.raw) {
        registros = window.dbLocal.raw.leerTabla(tabla) || [];
    }
    if ((!registros || registros.length === 0) && datosCatalogoActual && datosCatalogoActual.length > 0) {
        registros = datosCatalogoActual;
    }

    if (!registros || registros.length === 0) {
        return alert(`No hay registros disponibles en el catálogo de ${tabla} para exportar.`);
    }

    // Sanitizar registros para exportación limpia
    const registrosSanitizados = registros.map(r => {
        const clon = { ...r };
        // Eliminar blobs pesados si los hubiera para un Excel liviano
        delete clon.carpetas_seguimiento;
        delete clon.archivos_adjuntos;
        return clon;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(registrosSanitizados);
    const nombreHoja = (tabla.charAt(0).toUpperCase() + tabla.slice(1)).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);

    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Catalogo_${tabla}_${fechaHoy}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
}
window.exportarCatalogoActual = exportarCatalogoActual;

function abrirModalImportarCatalogo() {
    const modal = document.getElementById('modalImportarCatalogo');
    const titulo = document.getElementById('tituloModalImportarCatalogo');
    const subtitulo = document.getElementById('subtituloModalImportarCatalogo');
    const input = document.getElementById('inputArchivoImportarCatalogo');
    const lblArchivo = document.getElementById('nombreArchivoImportarDisplay');
    const estado = document.getElementById('contenedorEstadoImportacion');
    const btnEjecutar = document.getElementById('btnEjecutarImportacion');

    archivoImportacionPendiente = null;
    registrosImportadosParseados = [];

    if (input) input.value = '';
    if (lblArchivo) {
        lblArchivo.style.display = 'none';
        lblArchivo.textContent = '';
    }
    if (estado) {
        estado.style.display = 'none';
        estado.innerHTML = '';
    }
    if (btnEjecutar) btnEjecutar.disabled = true;

    const nombresLegibles = {
        'proveedores': 'Proveedores / Entes',
        'programas': 'Programas',
        'cursos': 'Cursos',
        'instructores': 'Instructores',
        'usuarios': 'Usuarios y Permisos'
    };
    const nombreCat = nombresLegibles[catalogoActual] || catalogoActual;

    if (titulo) titulo.textContent = `📥 Importar Catálogo: ${nombreCat}`;
    if (subtitulo) subtitulo.textContent = `Carga masiva de registros a '${nombreCat}' desde Excel (.xlsx, .xls), CSV o JSON.`;

    if (modal) modal.style.display = 'flex';
}
window.abrirModalImportarCatalogo = abrirModalImportarCatalogo;

function cerrarModalImportarCatalogo() {
    const modal = document.getElementById('modalImportarCatalogo');
    if (modal) modal.style.display = 'none';
    archivoImportacionPendiente = null;
    registrosImportadosParseados = [];
}
window.cerrarModalImportarCatalogo = cerrarModalImportarCatalogo;

function onArchivoImportarSeleccionado(input) {
    if (!input || !input.files || input.files.length === 0) return;
    const archivo = input.files[0];
    archivoImportacionPendiente = archivo;

    const lbl = document.getElementById('nombreArchivoImportarDisplay');
    const estado = document.getElementById('contenedorEstadoImportacion');
    const btn = document.getElementById('btnEjecutarImportacion');

    if (lbl) {
        lbl.textContent = `📄 Archivo seleccionado: ${archivo.name} (${(archivo.size / 1024).toFixed(1)} KB)`;
        lbl.style.display = 'block';
    }

    if (estado) {
        estado.style.display = 'block';
        estado.style.background = '#eff6ff';
        estado.style.color = '#1e40af';
        estado.style.border = '1px solid #bfdbfe';
        estado.innerHTML = '⏳ Analizando estructura del archivo...';
    }

    const ext = archivo.name.split('.').pop().toLowerCase();
    const lector = new FileReader();

    lector.onload = function(e) {
        try {
            let datos = [];
            if (ext === 'json') {
                datos = JSON.parse(e.target.result);
                if (!Array.isArray(datos)) {
                    if (datos && Array.isArray(datos[catalogoActual])) {
                        datos = datos[catalogoActual];
                    } else {
                        datos = [datos];
                    }
                }
            } else {
                // Excel o CSV usando SheetJS
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const primerHoja = wb.SheetNames[0];
                const worksheet = wb.Sheets[primerHoja];
                datos = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            }

            if (!datos || datos.length === 0) {
                if (estado) {
                    estado.style.background = '#fef2f2';
                    estado.style.color = '#991b1b';
                    estado.style.border = '1px solid #fecaca';
                    estado.innerHTML = '⚠️ El archivo no contiene filas o registros legibles.';
                }
                if (btn) btn.disabled = true;
                return;
            }

            registrosImportadosParseados = normalizarRegistrosParaCatalogo(datos, catalogoActual);

            if (estado) {
                estado.style.background = '#ecfdf5';
                estado.style.color = '#065f46';
                estado.style.border = '1px solid #a7f3d0';
                estado.innerHTML = `✅ <strong>${registrosImportadosParseados.length} registros listos</strong> para importar a '${catalogoActual}'. Verificá el modo y hacé clic en "Importar y Guardar".`;
            }
            if (btn) btn.disabled = false;
        } catch (err) {
            console.error(err);
            if (estado) {
                estado.style.background = '#fef2f2';
                estado.style.color = '#991b1b';
                estado.style.border = '1px solid #fecaca';
                estado.innerHTML = `❌ Error al leer el archivo: ${err.message || 'Formato no soportado.'}`;
            }
            if (btn) btn.disabled = true;
        }
    };

    if (ext === 'json') {
        lector.readAsText(archivo);
    } else {
        lector.readAsArrayBuffer(archivo);
    }
}
window.onArchivoImportarSeleccionado = onArchivoImportarSeleccionado;

function normalizarRegistrosParaCatalogo(filas, catalogo) {
    return filas.map((fila, idx) => {
        const item = {};
        // Normalizar claves a minúsculas y sin tildes ni espacios extras
        Object.keys(fila).forEach(k => {
            const kNorm = k.toLowerCase().trim()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');
            item[kNorm] = fila[k];
        });

        if (catalogo === 'proveedores') {
            const razon = item.razon_social || item.razon || item.nombre || item.proveedor || item.empresa || `Proveedor ${idx + 1}`;
            const codigo = item.codigo_proveedor || item.codigo || item.id || `PRV-${String(idx + 1).padStart(3, '0')}`;
            const ente = item.ente || item.ente_certificador || item.institucion || item.organismo || '';
            const rubro = item.rubro || item.categoria || item.actividad || 'Certificación / Capacitación';
            const contacto = item.contacto || item.persona_contacto || '';
            const telefono = item.telefono || item.tel || item.celular || '';
            const email = item.email || item.correo || '';
            const estado = item.estado || 'Activo';

            return {
                codigo_proveedor: String(codigo).trim(),
                razon_social: String(razon).trim(),
                ente: String(ente).trim(),
                rubro: String(rubro).trim(),
                contacto: String(contacto).trim(),
                telefono: String(telefono).trim(),
                email: String(email).trim(),
                estado: String(estado).trim() || 'Activo'
            };
        } else if (catalogo === 'programas') {
            const cod = item.codigo_programa || item.codigo || `PRO-${String(idx + 1).padStart(3, '0')}`;
            const nom = item.nombre || item.programa || `Programa ${idx + 1}`;
            const desc = item.descripcion || item.desc || '';
            const est = item.estado || 'Activo';
            return {
                codigo_programa: String(cod).trim(),
                nombre: String(nom).trim(),
                descripcion: String(desc).trim(),
                estado: String(est).trim()
            };
        } else if (catalogo === 'cursos') {
            const cod = item.codigo_curso || item.codigo || `CUR-${String(idx + 1).padStart(3, '0')}`;
            const nom = item.nombre || item.curso || `Curso ${idx + 1}`;
            const mod = item.modalidad || 'Presencial';
            const teor = parseFloat(item.hs_teoria || item.teoria || 0) || 0;
            const prac = parseFloat(item.hs_practica || item.practica || 0) || 0;
            const tot = parseFloat(item.hs_totales || item.carga_horaria || item.horas || (teor + prac)) || 0;
            const cont = item.contenido || item.temario || '';
            const est = item.estado || 'Activo';
            return {
                codigo_curso: String(cod).trim(),
                nombre: String(nom).trim(),
                modalidad: String(mod).trim(),
                hs_teoria: teor,
                hs_practica: prac,
                hs_totales: tot,
                contenido: String(cont).trim(),
                estado: String(est).trim()
            };
        } else if (catalogo === 'instructores') {
            const cod = item.codigo_instructor || item.codigo || `INS-${String(idx + 1).padStart(3, '0')}`;
            const nom = item.nombre || '';
            const ape = item.apellido || '';
            const dni = item.dni || '';
            const email = item.email || '';
            const esp = item.especialidad || '';
            const tip = item.tipo || 'Interno';
            const est = item.estado || 'Activo';
            return {
                codigo_instructor: String(cod).trim(),
                nombre: String(nom).trim(),
                apellido: String(ape).trim(),
                dni: String(dni).trim(),
                email: String(email).trim(),
                especialidad: String(esp).trim(),
                tipo: String(tip).trim(),
                estado: String(est).trim()
            };
        }

        return fila;
    });
}

async function ejecutarImportacionCatalogo() {
    if (!registrosImportadosParseados || registrosImportadosParseados.length === 0) {
        return alert('No hay registros listos para importar.');
    }

    const modo = document.getElementById('selectModoImportacionCatalogo')?.value || 'fusionar';
    const tabla = catalogoActual;

    let columnaPK = 'codigo_programa';
    if (tabla === 'cursos') columnaPK = 'codigo_curso';
    if (tabla === 'instructores') columnaPK = 'codigo_instructor';
    if (tabla === 'proveedores') columnaPK = 'codigo_proveedor';

    let itemsExistentes = [];
    if (window.dbLocal && window.dbLocal.raw) {
        itemsExistentes = window.dbLocal.raw.leerTabla(tabla) || [];
    }

    let itemsFinales = [];

    if (modo === 'reemplazar') {
        if (!confirm(`⚠️ ATENCIÓN: Se borrarán todos los registros actuales de ${tabla} y se cargarán ${registrosImportadosParseados.length} registros del archivo. ¿Deseás continuar?`)) {
            return;
        }
        itemsFinales = registrosImportadosParseados.map((item, i) => ({
            id: i + 1,
            ...item
        }));
    } else {
        // MODO FUSIONAR
        itemsFinales = [...itemsExistentes];
        let maxId = itemsFinales.reduce((acc, curr) => Math.max(acc, Number(curr.id) || 0), 0);

        registrosImportadosParseados.forEach(nuevo => {
            const pkNuevo = String(nuevo[columnaPK] || nuevo.codigo || '').toLowerCase().trim();
            const nomNuevo = String(nuevo.razon_social || nuevo.nombre || '').toLowerCase().trim();

            const idxExistente = itemsFinales.findIndex(ex => {
                const pkEx = String(ex[columnaPK] || ex.codigo || '').toLowerCase().trim();
                const nomEx = String(ex.razon_social || ex.nombre || '').toLowerCase().trim();
                return (pkNuevo && pkEx === pkNuevo) || (nomNuevo && nomEx === nomNuevo && nomNuevo !== '');
            });

            if (idxExistente >= 0) {
                // Actualizar conservando id original y campos especiales como carpetas_seguimiento
                itemsFinales[idxExistente] = {
                    ...itemsFinales[idxExistente],
                    ...nuevo
                };
            } else {
                // Nuevo registro
                maxId++;
                itemsFinales.push({
                    id: maxId,
                    ...nuevo
                });
            }
        });
    }

    // Guardar en dbLocal
    if (window.dbLocal && window.dbLocal.raw) {
        window.dbLocal.raw.escribirTabla(tabla, itemsFinales);
        localStorage.setItem(`SIGA_DB_${tabla}_inicializado`, 'true');
    }

    // Sincronizar en Supabase si está activo
    try {
        let cloudDB = window.supabaseCloudClient;
        if (!cloudDB && typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
            cloudDB = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        }
        if (cloudDB) {
            await cloudDB.from(tabla).upsert(itemsFinales, { onConflict: columnaPK });
        }
    } catch (err) {
        console.warn("Aviso al sincronizar importación en nube:", err);
    }

    cerrarModalImportarCatalogo();

    // Recargar vista activa
    if (tabla === 'proveedores') await cargarProveedores();
    else if (tabla === 'programas') await cargarProgramas();
    else if (tabla === 'cursos') await cargarCursos();
    else if (tabla === 'instructores') await cargarInstructores();
    else if (tabla === 'usuarios') await cargarUsuarios();

    alert(`✅ Importación completada con éxito.\nCatálogo '${tabla}' actualizado con ${itemsFinales.length} registros totales.`);
}
window.ejecutarImportacionCatalogo = ejecutarImportacionCatalogo;

function descargarPlantillaExcelCatalogo() {
    if (typeof XLSX === 'undefined') {
        return alert('La librería XLSX no está disponible.');
    }

    const tabla = catalogoActual;
    let datosEjemplo = [];

    if (tabla === 'proveedores') {
        datosEjemplo = [
            {
                codigo_proveedor: 'PRV-001',
                razon_social: 'INTI - Instituto Nacional de Tecnología Industrial',
                ente: 'INTI',
                rubro: 'Ensayos No Destructivos (END / US / PM / LP)',
                contacto: 'Ing. Carlos Mendoza',
                telefono: '+54 11 4724-6200',
                email: 'capacitacion@inti.gob.ar',
                estado: 'Activo'
            },
            {
                codigo_proveedor: 'PRV-002',
                razon_social: 'IRAM - Instituto Argentino de Normalización',
                ente: 'IRAM',
                rubro: 'Normas ISO y Soldadura',
                contacto: 'Lic. Laura Benítez',
                telefono: '+54 11 4346-0600',
                email: 'certificaciones@iram.org.ar',
                estado: 'Activo'
            }
        ];
    } else if (tabla === 'programas') {
        datosEjemplo = [
            {
                codigo_programa: 'PRO-001',
                nombre: 'Programa de Integridad y Soldadura 2026',
                descripcion: 'Calificación técnica integral de operarios y supervisores',
                estado: 'Activo'
            }
        ];
    } else if (tabla === 'cursos') {
        datosEjemplo = [
            {
                codigo_curso: 'CUR-001',
                nombre: 'Ultrasonido Nivel 2 (END)',
                modalidad: 'Presencial',
                hs_teoria: 20,
                hs_practica: 20,
                hs_totales: 40,
                contenido: 'Discontinuidades, curvas DAC, calibración con palpadores angulares',
                estado: 'Activo'
            }
        ];
    } else {
        datosEjemplo = [
            {
                codigo: '001',
                nombre: 'Ejemplo de Registro',
                estado: 'Activo'
            }
        ];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Ejemplo');
    XLSX.writeFile(wb, `Plantilla_${tabla}.xlsx`);
}
window.descargarPlantillaExcelCatalogo = descargarPlantillaExcelCatalogo;

/* ========================================================================== */
/* MOTOR DE ASIGNACIÓN DE CURSOS, PÚBLICO OBJETIVO Y CUMPLIMIENTO EN PROGRAMAS */
/* ========================================================================== */

let cacheDotacionProg = null;
let cacheCursosProg = null;
let cacheAsistentesProg = null;
let cacheCapacitacionesProg = null;
let cursosAsignadosPrograma = [];
let vistaNominaAbierta = {};
let programaDetalleActivo = null;
let vistaNominaModalAbierta = {};

async function asegurarCargasAuxiliaresProgramas(forzarRecarga = false) {
    try {
        if (forzarRecarga || !cacheDotacionProg || cacheDotacionProg.length === 0) {
            if (window.dbLocal && window.dbLocal.raw) {
                cacheDotacionProg = window.dbLocal.raw.leerTabla('dotacion') || [];
            }
            if (!cacheDotacionProg || cacheDotacionProg.length === 0) {
                const raw = localStorage.getItem('SIGA_DB_dotacion');
                if (raw) {
                    try { cacheDotacionProg = JSON.parse(raw); } catch (e) {}
                }
            }
            if (!cacheDotacionProg || cacheDotacionProg.length === 0) {
                const resp = await fetch('data/dotacion.json');
                if (resp.ok) cacheDotacionProg = await resp.json();
            }
            cacheDotacionProg = Array.isArray(cacheDotacionProg) ? cacheDotacionProg : [];
        }

        // Cursos: sincronizar siempre con dbLocal si contiene cursos para reflejar inmediatamente altas/modificaciones
        let cursosDB = [];
        if (window.dbLocal && window.dbLocal.raw) {
            cursosDB = window.dbLocal.raw.leerTabla('cursos') || [];
        }
        if (Array.isArray(cursosDB) && cursosDB.length > 0) {
            cacheCursosProg = cursosDB;
            window.cacheCursosProg = cursosDB;
        } else if (forzarRecarga || !cacheCursosProg || cacheCursosProg.length === 0) {
            const resp = await fetch('data/cursos.json');
            if (resp.ok) cacheCursosProg = await resp.json();
            cacheCursosProg = Array.isArray(cacheCursosProg) ? cacheCursosProg : [];
            window.cacheCursosProg = cacheCursosProg;
        }

        if (forzarRecarga || !cacheAsistentesProg || cacheAsistentesProg.length === 0) {
            if (window.dbLocal && window.dbLocal.raw) {
                cacheAsistentesProg = window.dbLocal.raw.leerTabla('asistentes') || [];
            }
            if (!cacheAsistentesProg || cacheAsistentesProg.length === 0) {
                const resp = await fetch('data/asistentes.json');
                if (resp.ok) cacheAsistentesProg = await resp.json();
            }
            cacheAsistentesProg = Array.isArray(cacheAsistentesProg) ? cacheAsistentesProg : [];
        }

        if (forzarRecarga || !cacheCapacitacionesProg || cacheCapacitacionesProg.length === 0) {
            if (window.dbLocal && window.dbLocal.raw) {
                cacheCapacitacionesProg = window.dbLocal.raw.leerTabla('capacitaciones') || [];
            }
            if (!cacheCapacitacionesProg || cacheCapacitacionesProg.length === 0) {
                const resp = await fetch('data/capacitaciones.json');
                if (resp.ok) cacheCapacitacionesProg = await resp.json();
            }
            cacheCapacitacionesProg = Array.isArray(cacheCapacitacionesProg) ? cacheCapacitacionesProg : [];
        }
    } catch (err) {
        console.warn('Advertencia cargando datos auxiliares para programas:', err);
    }
}
window.asegurarCargasAuxiliaresProgramas = asegurarCargasAuxiliaresProgramas;

// 1. Normalización y cálculo de destinatarios con Multi-selección y Cascada a Legajos
function normalizarConfigCurso(c) {
    if (!c) return {};
    if (!c.filtros) c.filtros = {};
    const f = c.filtros;

    if (!Array.isArray(f.direcciones)) f.direcciones = f.direccion ? [f.direccion] : [];
    if (!Array.isArray(f.gerencias)) f.gerencias = f.gerencia ? [f.gerencia] : [];
    if (!Array.isArray(f.coordinaciones)) f.coordinaciones = f.coordinacion ? [f.coordinacion] : [];
    if (!Array.isArray(f.jefaturas)) f.jefaturas = f.jefatura ? [f.jefatura] : [];
    if (!Array.isArray(f.categorias)) f.categorias = f.categoria ? [f.categoria] : [];

    f.direcciones = f.direcciones.filter(x => x && x !== 'Todas' && x !== 'Todos');
    f.gerencias = f.gerencias.filter(x => x && x !== 'Todas' && x !== 'Todos');
    f.coordinaciones = f.coordinaciones.filter(x => x && x !== 'Todas' && x !== 'Todos');
    f.jefaturas = f.jefaturas.filter(x => x && x !== 'Todas' && x !== 'Todos');
    f.categorias = f.categorias.filter(x => x && x !== 'Todas' && x !== 'Todos');

    if (!c.modo_legajos) {
        c.modo_legajos = c.tipo_destinatario === 'legajos' ? 'especificos' : 'todos';
    }

    if (!Array.isArray(c.legajos_seleccionados)) {
        c.legajos_seleccionados = Array.isArray(c.legajos_asignados) ? [...c.legajos_asignados] : [];
    }

    return c;
}
window.normalizarConfigCurso = normalizarConfigCurso;

// Obtener dotación filtrada por la jerarquía (Dirección -> Gerencia -> Coord -> Jefatura -> Categorías)
function obtenerDotacionFiltradaPorJerarquia(cursoConfig, dotacion) {
    if (!dotacion || !Array.isArray(dotacion)) return [];
    normalizarConfigCurso(cursoConfig);

    const f = cursoConfig.filtros;
    const tieneFiltros = f.direcciones.length > 0 || f.gerencias.length > 0 || f.coordinaciones.length > 0 || f.jefaturas.length > 0 || f.categorias.length > 0;

    if (!tieneFiltros) {
        return dotacion;
    }

    const setDirs = new Set(f.direcciones.map(s => s.trim().toLowerCase()));
    const setGers = new Set(f.gerencias.map(s => s.trim().toLowerCase()));
    const setCoos = new Set(f.coordinaciones.map(s => s.trim().toLowerCase()));
    const setJefs = new Set(f.jefaturas.map(s => s.trim().toLowerCase()));
    const setCats = new Set(f.categorias.map(s => s.trim().toLowerCase()));

    return dotacion.filter(d => {
        const dDir = String(d.direccion || d.DIRECCION || '').trim().toLowerCase();
        const dGer = String(d.gerencia || d.GERENCIA || '').trim().toLowerCase();
        const dCoo = String(d.coordinacion || d.COORDINACION || '').trim().toLowerCase();
        const dJef = String(d.jefatura || d.JEFATURA || '').trim().toLowerCase();
        const dCat = String(d.categoria || d.CATEGORIA || d.puesto || '').trim().toLowerCase();

        if (setDirs.size > 0 && !setDirs.has(dDir)) return false;
        if (setGers.size > 0 && !setGers.has(dGer)) return false;
        if (setCoos.size > 0 && !setCoos.has(dCoo)) return false;
        if (setJefs.size > 0 && !setJefs.has(dJef)) return false;

        if (setCats.size > 0) {
            let matchCat = false;
            for (const cat of setCats) {
                if (dCat.includes(cat) || cat.includes(dCat)) {
                    matchCat = true;
                    break;
                }
            }
            if (!matchCat) return false;
        }

        return true;
    });
}
window.obtenerDotacionFiltradaPorJerarquia = obtenerDotacionFiltradaPorJerarquia;

function calcularDestinatariosCurso(cursoConfig, dotacion) {
    if (!dotacion || !Array.isArray(dotacion)) return [];
    normalizarConfigCurso(cursoConfig);

    const f = cursoConfig.filtros;
    const tieneFiltros = f.direcciones.length > 0 || f.gerencias.length > 0 || f.coordinaciones.length > 0 || f.jefaturas.length > 0 || f.categorias.length > 0;
    
    // Si no tiene filtros y está en modo todos, no asigna a ciegas a toda la empresa
    if (!tieneFiltros && cursoConfig.modo_legajos !== 'especificos') {
        return [];
    }

    const poolFiltrado = tieneFiltros ? obtenerDotacionFiltradaPorJerarquia(cursoConfig, dotacion) : dotacion;

    // Modo 1: Asignar a todos los empleados filtrados por jerarquía
    if (cursoConfig.modo_legajos === 'todos') {
        return poolFiltrado;
    }

    // Modo 2: Cascada a Legajos específicos dentro del grupo filtrado
    const legajosRaw = cursoConfig.legajos_seleccionados || [];
    if (!Array.isArray(legajosRaw) || legajosRaw.length === 0) {
        return [];
    }

    const setLegajos = new Set();
    legajosRaw.forEach(l => {
        const s = String(l).trim();
        if (s) {
            setLegajos.add(s.toLowerCase());
            if (!isNaN(Number(s))) {
                setLegajos.add(String(parseInt(s, 10)));
                if (s.length < 5) setLegajos.add(s.padStart(5, '0'));
            }
        }
    });

    return poolFiltrado.filter(d => {
        const leg = String(d.legajo || d.LEGAJO || '').trim().toLowerCase();
        if (!leg) return false;
        const legNum = !isNaN(Number(leg)) ? String(parseInt(leg, 10)) : '';
        return setLegajos.has(leg) || (legNum && setLegajos.has(legNum));
    });
}
window.calcularDestinatariosCurso = calcularDestinatariosCurso;

// 2. Cálculo de asistencias y cumplimiento para un curso
function calcularCumplimientoCurso(cursoConfig, destinatarios, capacitaciones, asistentes) {
    const totalTarget = (destinatarios || []).length;
    if (totalTarget === 0) {
        return { totalTarget: 0, cumplidosTotal: 0, porcentaje: 0, listaConEstado: [] };
    }

    const codCurso = String(cursoConfig.codigo_curso || '').trim().toLowerCase();
    const nomCurso = String(cursoConfig.nombre_curso || cursoConfig.nombre || '').trim().toLowerCase();

    const capsIdsCurso = new Set();
    (capacitaciones || []).forEach(c => {
        const cCod = String(c.codigo_curso || '').trim().toLowerCase();
        const cNom = String(c.nombre_curso || c.curso || '').trim().toLowerCase();
        if ((codCurso && cCod && cCod === codCurso) || (nomCurso && cNom && (cNom === nomCurso || cNom.includes(nomCurso) || nomCurso.includes(cNom)))) {
            if (c.id_cap) capsIdsCurso.add(String(c.id_cap).trim());
        }
    });

    const legajosCumplidos = new Set();
    (asistentes || []).forEach(a => {
        const aIdCap = String(a.id_cap || '').trim();
        if (capsIdsCurso.has(aIdCap)) {
            const leg = String(a.legajo || a.LEGAJO || '').trim().toLowerCase();
            if (leg) {
                legajosCumplidos.add(leg);
                if (!isNaN(Number(leg))) legajosCumplidos.add(String(parseInt(leg, 10)));
            }
        }
    });

    let cumplidosTotal = 0;
    const listaConEstado = (destinatarios || []).map(emp => {
        const leg = String(emp.legajo || emp.LEGAJO || '').trim().toLowerCase();
        const legNum = !isNaN(Number(leg)) ? String(parseInt(leg, 10)) : '';
        const completo = legajosCumplidos.has(leg) || (legNum && legajosCumplidos.has(legNum));
        if (completo) cumplidosTotal++;

        return {
            legajo: emp.legajo || emp.LEGAJO || '-',
            apellido: emp.apellido || emp.APELLIDO || '',
            nombre: emp.nombre || emp.NOMBRE || '',
            puesto: emp.puesto || emp.PUESTO || '-',
            gerencia: emp.gerencia || emp.GERENCIA || '-',
            coordinacion: emp.coordinacion || emp.COORDINACION || '-',
            jefatura: emp.jefatura || emp.JEFATURA || '-',
            direccion: emp.direccion || emp.DIRECCION || '-',
            categoria: emp.categoria || emp.CATEGORIA || '-',
            completo: Boolean(completo)
        };
    });

    const porcentaje = totalTarget > 0 ? Math.round((cumplidosTotal / totalTarget) * 100) : 0;
    return {
        totalTarget,
        cumplidosTotal,
        porcentaje,
        listaConEstado
    };
}
window.calcularCumplimientoCurso = calcularCumplimientoCurso;

// 3. Métricas completas de un programa
function calcularMetricasProgramaRapidas(prog) {
    if (!prog || !prog.cursos_asignados || !Array.isArray(prog.cursos_asignados) || prog.cursos_asignados.length === 0) {
        return {
            totalCursos: 0,
            totalTarget: 0,
            totalCumplidos: 0,
            porcentaje: 0,
            empleadosUnicos: 0,
            cursosDetalle: []
        };
    }

    const dotacion = cacheDotacionProg || [];
    const caps = cacheCapacitacionesProg || [];
    const asists = cacheAsistentesProg || [];

    let totalTarget = 0;
    let totalCumplidos = 0;
    const todosLegajosUnicos = new Set();
    const cursosDetalle = [];

    prog.cursos_asignados.forEach(c => {
        normalizarConfigCurso(c);
        const dest = calcularDestinatariosCurso(c, dotacion);
        const cump = calcularCumplimientoCurso(c, dest, caps, asists);
        totalTarget += cump.totalTarget;
        totalCumplidos += cump.cumplidosTotal;
        dest.forEach(d => {
            const l = String(d.legajo || d.LEGAJO || '').trim();
            if (l) todosLegajosUnicos.add(l);
        });

        cursosDetalle.push({
            codigo_curso: c.codigo_curso,
            nombre_curso: c.nombre_curso,
            modalidad: c.modalidad || 'Presencial',
            hs_totales: c.hs_totales || 0,
            filtros: c.filtros || {},
            modo_legajos: c.modo_legajos || 'todos',
            legajos_seleccionados: c.legajos_seleccionados || [],
            totalTarget: cump.totalTarget,
            cumplidosTotal: cump.cumplidosTotal,
            porcentaje: cump.porcentaje,
            listaConEstado: cump.listaConEstado
        });
    });

    const porcentaje = totalTarget > 0 ? Math.round((totalCumplidos / totalTarget) * 100) : 0;

    return {
        totalCursos: prog.cursos_asignados.length,
        totalTarget,
        totalCumplidos,
        porcentaje,
        empleadosUnicos: todosLegajosUnicos.size,
        cursosDetalle
    };
}
window.calcularMetricasProgramaRapidas = calcularMetricasProgramaRapidas;

// 4. Inicialización del formulario de Cursos en Programas
async function inicializarFormularioCursosPrograma(cursosIniciales) {
    cursosAsignadosPrograma = JSON.parse(JSON.stringify(cursosIniciales || []));
    (cursosAsignadosPrograma || []).forEach(c => normalizarConfigCurso(c));
    vistaNominaAbierta = {};
    dropdownActivoProg = null;
    busquedaMultiProg = {};
    busquedaLegajoProg = {};
    await asegurarCargasAuxiliaresProgramas(true);
    popularSelectCursosDisponibles();
    renderizarCursosAsignadosFormulario();
}
window.inicializarFormularioCursosPrograma = inicializarFormularioCursosPrograma;

function popularSelectCursosDisponibles() {
    const sel = document.getElementById('pro_select_curso_agregar');
    if (!sel) return;

    // Asegurar carga fresca de la base de datos local
    if (window.dbLocal && window.dbLocal.raw) {
        const cursosDB = window.dbLocal.raw.leerTabla('cursos');
        if (Array.isArray(cursosDB) && cursosDB.length > 0) {
            cacheCursosProg = cursosDB;
            window.cacheCursosProg = cursosDB;
        }
    }

    sel.innerHTML = '<option value="">-- Seleccionar curso del catálogo --</option>';
    const cursos = (cacheCursosProg || []).filter(c => c && (c.nombre || c.codigo_curso || c.codigo));

    // Ordenar alfabéticamente por nombre
    cursos.sort((a, b) => {
        const nomA = (a.nombre || a.codigo_curso || '').toLowerCase();
        const nomB = (b.nombre || b.codigo_curso || '').toLowerCase();
        return nomA.localeCompare(nomB);
    });

    cursos.forEach(c => {
        const cod = c.codigo_curso || c.codigo || (c.id ? `CUR-${String(c.id).padStart(3, '0')}` : 'CUR-S/C');
        const nom = c.nombre || 'Sin nombre';
        const mod = c.modalidad || 'Presencial';
        const hs = c.hs_totales !== undefined ? c.hs_totales : ((parseFloat(c.hs_teoria) || 0) + (parseFloat(c.hs_practica) || 0));
        const opt = document.createElement('option');
        opt.value = cod;
        opt.textContent = `[${cod}] ${nom} (${mod} - ${hs} hs)`;
        sel.appendChild(opt);
    });
}
window.popularSelectCursosDisponibles = popularSelectCursosDisponibles;

function agregarCursoAPrograma() {
    const sel = document.getElementById('pro_select_curso_agregar');
    if (!sel || !sel.value) {
        return alert('Por favor seleccione un curso de la lista para asignarlo al programa.');
    }

    const codSeleccionado = String(sel.value).trim();
    const yaExiste = cursosAsignadosPrograma.some(c => String(c.codigo_curso || c.codigo).trim().toLowerCase() === codSeleccionado.toLowerCase());
    if (yaExiste) {
        return alert('Este curso ya se encuentra asignado a este programa. Puede ajustar sus destinatarios en la tarjeta correspondiente.');
    }

    const cItem = (cacheCursosProg || []).find(c => {
        const cCod = String(c.codigo_curso || c.codigo || (c.id ? `CUR-${String(c.id).padStart(3, '0')}` : '')).trim().toLowerCase();
        return cCod === codSeleccionado.toLowerCase();
    });

    const nom = cItem ? (cItem.nombre || '') : 'Curso';
    const mod = cItem ? (cItem.modalidad || 'Presencial') : 'Presencial';
    const hs = cItem ? (cItem.hs_totales !== undefined ? cItem.hs_totales : ((parseFloat(cItem.hs_teoria) || 0) + (parseFloat(cItem.hs_practica) || 0))) : 0;

    cursosAsignadosPrograma.push({
        codigo_curso: codSeleccionado,
        nombre_curso: nom,
        modalidad: mod,
        hs_totales: hs,
        filtros: {
            direcciones: [],
            gerencias: [],
            coordinaciones: [],
            jefaturas: [],
            categorias: []
        },
        modo_legajos: 'todos',
        legajos_seleccionados: [],
        total_destinatarios: 0
    });

    renderizarCursosAsignadosFormulario();
    sel.value = '';
}
window.agregarCursoAPrograma = agregarCursoAPrograma;

function quitarCursoDePrograma(idx) {
    if (confirm('¿Está seguro de quitar este curso del programa? Se eliminará la configuración de público asignado para este curso.')) {
        cursosAsignadosPrograma.splice(idx, 1);
        delete vistaNominaAbierta[idx];
        renderizarCursosAsignadosFormulario();
    }
}
window.quitarCursoDePrograma = quitarCursoDePrograma;

// Variables de estado para dropdowns y búsquedas interactivas
let dropdownActivoProg = null; // { idxCurso: number, campo: string }
let busquedaMultiProg = {};   // { '0_categorias': 'uta' }
let busquedaLegajoProg = {};  // { '0': 'gonzalez' }
let verPegarLegajosProg = {}; // { '0': boolean }

if (!window._progDropdownGlobalClickAttached) {
    document.addEventListener('click', (e) => {
        if (dropdownActivoProg && !e.target.closest('.prog-ms-container')) {
            dropdownActivoProg = null;
            renderizarCursosAsignadosFormulario();
        }
    });
    window._progDropdownGlobalClickAttached = true;
}

// Opciones disponibles en cascada para selección múltiple
function obtenerOpcionesJerarquicasMulti(filtrosActuales) {
    const dotacion = cacheDotacionProg || [];
    const f = filtrosActuales || {};
    const selDirs = f.direcciones || [];
    const selGers = f.gerencias || [];
    const selCoos = f.coordinaciones || [];

    const dirs = new Set();
    const gers = new Set();
    const coos = new Set();
    const jefs = new Set();
    const cats = new Set();

    dotacion.forEach(d => {
        const dir = String(d.direccion || d.DIRECCION || '').trim();
        const ger = String(d.gerencia || d.GERENCIA || '').trim();
        const coo = String(d.coordinacion || d.COORDINACION || '').trim();
        const jef = String(d.jefatura || d.JEFATURA || '').trim();
        const cat = String(d.categoria || d.CATEGORIA || d.puesto || '').trim();

        if (dir) dirs.add(dir);
        if (cat) cats.add(cat);

        const matchDir = selDirs.length === 0 || selDirs.includes(dir);
        if (matchDir && ger) gers.add(ger);

        const matchGer = matchDir && (selGers.length === 0 || selGers.includes(ger));
        if (matchGer && coo) coos.add(coo);

        const matchCoo = matchGer && (selCoos.length === 0 || selCoos.includes(coo));
        if (matchCoo && jef) jefs.add(jef);
    });

    return {
        direcciones: Array.from(dirs).sort(),
        gerencias: Array.from(gers).sort(),
        coordinaciones: Array.from(coos).sort(),
        jefaturas: Array.from(jefs).sort(),
        categorias: Array.from(cats).sort()
    };
}
window.obtenerOpcionesJerarquicasMulti = obtenerOpcionesJerarquicasMulti;

// Alternar apertura de dropdown con checkboxes
function toggleDropdownFiltro(idxCurso, campo, ev) {
    if (ev) ev.stopPropagation();
    if (dropdownActivoProg && dropdownActivoProg.idxCurso === idxCurso && dropdownActivoProg.campo === campo) {
        dropdownActivoProg = null;
    } else {
        dropdownActivoProg = { idxCurso, campo };
    }
    renderizarCursosAsignadosFormulario();
}
window.toggleDropdownFiltro = toggleDropdownFiltro;

if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.prog-ms-container') && dropdownActivoProg !== null) {
            dropdownActivoProg = null;
            renderizarCursosAsignadosFormulario();
        }
    });
}

function filtrarOpcionesDropdownDOM(idxCurso, campo, valor) {
    busquedaMultiProg[`${idxCurso}_${campo}`] = valor;
    const listEl = document.getElementById(`ms_list_${idxCurso}_${campo}`);
    if (!listEl) return;
    const term = (valor || '').toLowerCase().trim();
    const items = listEl.querySelectorAll('.prog-ms-item');
    items.forEach(it => {
        const text = (it.innerText || '').toLowerCase();
        it.style.display = (!term || text.includes(term)) ? 'flex' : 'none';
    });
}
window.filtrarOpcionesDropdownDOM = filtrarOpcionesDropdownDOM;

function toggleOpcionFiltro(idxCurso, campo, valor) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);

    const arr = c.filtros[campo] || [];
    const idx = arr.indexOf(valor);
    if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        arr.push(valor);
    }
    c.filtros[campo] = arr;

    // Cascada: si modificamos dirección o gerencia, validar coherencia en hijos
    const jerarquia = obtenerOpcionesJerarquicasMulti(c.filtros);
    if (campo === 'direcciones') {
        c.filtros.gerencias = (c.filtros.gerencias || []).filter(g => jerarquia.gerencias.includes(g));
        c.filtros.coordinaciones = (c.filtros.coordinaciones || []).filter(co => jerarquia.coordinaciones.includes(co));
        c.filtros.jefaturas = (c.filtros.jefaturas || []).filter(j => jerarquia.jefaturas.includes(j));
    } else if (campo === 'gerencias') {
        c.filtros.coordinaciones = (c.filtros.coordinaciones || []).filter(co => jerarquia.coordinaciones.includes(co));
        c.filtros.jefaturas = (c.filtros.jefaturas || []).filter(j => jerarquia.jefaturas.includes(j));
    } else if (campo === 'coordinaciones') {
        c.filtros.jefaturas = (c.filtros.jefaturas || []).filter(j => jerarquia.jefaturas.includes(j));
    }

    renderizarCursosAsignadosFormulario();
}
window.toggleOpcionFiltro = toggleOpcionFiltro;

function marcarTodasOpcionesFiltro(idxCurso, campo, opciones) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);
    c.filtros[campo] = [...opciones];
    renderizarCursosAsignadosFormulario();
}
window.marcarTodasOpcionesFiltro = marcarTodasOpcionesFiltro;

function limpiarOpcionesFiltro(idxCurso, campo) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);
    c.filtros[campo] = [];
    renderizarCursosAsignadosFormulario();
}
window.limpiarOpcionesFiltro = limpiarOpcionesFiltro;

// Manejo de cascada a legajos
function cambiarModoLegajos(idxCurso, modo) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);
    c.modo_legajos = modo;

    // Si pasa a específicos y aún no tiene legajos tildados, precargar con los filtrados por conveniencia
    if (modo === 'especificos' && (!c.legajos_seleccionados || c.legajos_seleccionados.length === 0)) {
        const dotacion = cacheDotacionProg || [];
        const pool = obtenerDotacionFiltradaPorJerarquia(c, dotacion);
        c.legajos_seleccionados = pool.map(d => String(d.legajo || d.LEGAJO || '').trim()).filter(Boolean);
    }

    renderizarCursosAsignadosFormulario();
}
window.cambiarModoLegajos = cambiarModoLegajos;

function toggleLegajoEnCurso(idxCurso, legajo) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);

    const legClean = String(legajo).trim();
    if (!Array.isArray(c.legajos_seleccionados)) c.legajos_seleccionados = [];
    const idx = c.legajos_seleccionados.indexOf(legClean);
    if (idx >= 0) {
        c.legajos_seleccionados.splice(idx, 1);
    } else {
        c.legajos_seleccionados.push(legClean);
    }
    renderizarCursosAsignadosFormulario();
}
window.toggleLegajoEnCurso = toggleLegajoEnCurso;

function marcarTodosLegajosFiltrados(idxCurso, listaLegajos) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);
    c.legajos_seleccionados = [...listaLegajos];
    renderizarCursosAsignadosFormulario();
}
window.marcarTodosLegajosFiltrados = marcarTodosLegajosFiltrados;

function desmarcarTodosLegajosFiltrados(idxCurso) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c) return;
    normalizarConfigCurso(c);
    c.legajos_seleccionados = [];
    renderizarCursosAsignadosFormulario();
}
window.desmarcarTodosLegajosFiltrados = desmarcarTodosLegajosFiltrados;

function togglePanelPegarLegajos(idxCurso) {
    verPegarLegajosProg[idxCurso] = !verPegarLegajosProg[idxCurso];
    renderizarCursosAsignadosFormulario();
}
window.togglePanelPegarLegajos = togglePanelPegarLegajos;

function agregarLegajosEnLote(idxCurso, texto) {
    const c = cursosAsignadosPrograma[idxCurso];
    if (!c || !texto) return;
    normalizarConfigCurso(c);

    const tokens = String(texto).split(/[\s,;\n\r]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) return;

    if (!Array.isArray(c.legajos_seleccionados)) c.legajos_seleccionados = [];
    tokens.forEach(tok => {
        if (!c.legajos_seleccionados.includes(tok)) {
            c.legajos_seleccionados.push(tok);
        }
    });

    renderizarCursosAsignadosFormulario();
}
window.agregarLegajosEnLote = agregarLegajosEnLote;

function filtrarLegajosDOM(idxCurso, val) {
    busquedaLegajoProg[idxCurso] = val;
    const cont = document.getElementById(`grid_legajos_${idxCurso}`);
    if (!cont) return;
    const term = (val || '').toLowerCase().trim();
    const rows = cont.querySelectorAll('.prog-legajo-row');
    rows.forEach(r => {
        const txt = (r.innerText || '').toLowerCase();
        r.style.display = (!term || txt.includes(term)) ? 'flex' : 'none';
    });
}
window.filtrarLegajosDOM = filtrarLegajosDOM;

function toggleVerNominaCurso(idx) {
    vistaNominaAbierta[idx] = !vistaNominaAbierta[idx];
    renderizarCursosAsignadosFormulario();
}
window.toggleVerNominaCurso = toggleVerNominaCurso;


// // 5. Renderizado visual de las tarjetas de cursos y público asignado en el formulario
function renderizarCursosAsignadosFormulario() {
    const cont = document.getElementById('pro_lista_cursos_asignados');
    const panelResumen = document.getElementById('pro_resumen_global_panel');
    if (!cont) return;

    if (!cursosAsignadosPrograma || cursosAsignadosPrograma.length === 0) {
        cont.innerHTML = `
            <div style="background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; padding:24px; text-align:center; color:#64748b;">
                <span style="font-size:2rem; display:block; margin-bottom:8px;">📚</span>
                <strong style="color:#334155; font-size:0.95rem;">No hay cursos asignados a este programa todavía</strong>
                <p style="margin:6px 0 0; font-size:0.83rem;">Seleccione un curso del menú desplegable superior y presione "➕ Asignar Curso" para agregarlo y configurar su público destinatario.</p>
            </div>
        `;
        if (panelResumen) panelResumen.style.display = 'none';
        return;
    }

    const dotacion = cacheDotacionProg || [];
    const caps = cacheCapacitacionesProg || [];
    const asists = cacheAsistentesProg || [];

    let html = '';
    let totalTargetGlobal = 0;
    let totalCumplidosGlobal = 0;
    const legajosUnicosGlobal = new Set();

    cursosAsignadosPrograma.forEach((c, idx) => {
        normalizarConfigCurso(c);
        const dest = calcularDestinatariosCurso(c, dotacion);
        const cump = calcularCumplimientoCurso(c, dest, caps, asists);
        c.total_destinatarios = cump.totalTarget;

        totalTargetGlobal += cump.totalTarget;
        totalCumplidosGlobal += cump.cumplidosTotal;
        dest.forEach(d => {
            const l = String(d.legajo || d.LEGAJO || '').trim();
            if (l) legajosUnicosGlobal.add(l);
        });

        // Jerarquía disponible para este curso y dotación filtrada previa
        const jerarquia = obtenerOpcionesJerarquicasMulti(c.filtros);
        const poolJerarquia = obtenerDotacionFiltradaPorJerarquia(c, dotacion);
        const esModoTodos = c.modo_legajos !== 'especificos';

        const colorProg = cump.porcentaje >= 75 ? '#16a34a' : (cump.porcentaje >= 40 ? '#d97706' : '#64748b');
        const bgProg = cump.porcentaje >= 75 ? '#dcfce7' : (cump.porcentaje >= 40 ? '#fef3c7' : '#f1f5f9');
        const estaAbiertaNomina = Boolean(vistaNominaAbierta[idx]);

        // Helper para renderizar cada dropdown multi-select
        const renderDropdown = (campo, etiqueta, placeholder, opciones, seleccionados) => {
            const estaAbierto = dropdownActivoProg && dropdownActivoProg.idxCurso === idx && dropdownActivoProg.campo === campo;
            const cantSel = seleccionados.length;
            let labelTrigger = placeholder;
            if (cantSel === 1) {
                labelTrigger = seleccionados[0];
            } else if (cantSel > 1) {
                labelTrigger = `${cantSel} seleccionadas`;
            }

            const jsonOpciones = JSON.stringify(opciones).replace(/"/g, '&quot;');

            return `
                <div class="prog-ms-container" style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px;">
                        ${etiqueta} ${cantSel > 0 ? `<span class="prog-ms-badge">${cantSel}</span>` : ''}
                    </label>
                    <button type="button" 
                            class="prog-ms-trigger ${cantSel > 0 ? 'active' : ''}" 
                            onclick="toggleDropdownFiltro(${idx}, '${campo}', event)">
                        <span class="prog-ms-trigger-text" title="${cantSel > 0 ? seleccionados.join(', ') : placeholder}">${labelTrigger}</span>
                        <span style="font-size:0.7rem; color:#64748b;">${estaAbierto ? '▲' : '▼'}</span>
                    </button>
                    ${estaAbierto ? `
                        <div class="prog-ms-menu" onclick="event.stopPropagation()">
                            <input type="text" 
                                   class="prog-ms-search" 
                                   placeholder="Buscar opción..." 
                                   oninput="filtrarOpcionesDropdownDOM(${idx}, '${campo}', this.value)"
                                   onclick="event.stopPropagation()">
                            <div class="prog-ms-actions">
                                <button type="button" onclick="marcarTodasOpcionesFiltro(${idx}, '${campo}', ${jsonOpciones})">✓ Todas (${opciones.length})</button>
                                <button type="button" onclick="limpiarOpcionesFiltro(${idx}, '${campo}')">✕ Limpiar</button>
                            </div>
                            <div class="prog-ms-list" id="ms_list_${idx}_${campo}">
                                ${opciones.length === 0 ? `
                                    <div style="padding:10px; font-size:0.78rem; color:#94a3b8; text-align:center;">Sin opciones disponibles en este nivel</div>
                                ` : opciones.map(op => {
                                    const checked = seleccionados.includes(op);
                                    return `
                                        <label class="prog-ms-item">
                                            <input type="checkbox" 
                                                   ${checked ? 'checked' : ''} 
                                                   onchange="toggleOpcionFiltro(${idx}, '${campo}', '${op.replace(/'/g, "\\'")}')">
                                            <span>${op}</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        };

        html += `
            <div class="card-curso-prog" id="card_curso_${idx}">
                <!-- Cabecera de Curso -->
                <div class="card-curso-prog-header">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span style="font-size:1.2rem;">📖</span>
                        <div>
                            <strong style="font-size:0.98rem; color:#0f172a;">[${c.codigo_curso}] ${c.nombre_curso}</strong>
                            <div style="display:flex; gap:6px; margin-top:3px; align-items:center; flex-wrap:wrap;">
                                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">${c.modalidad || 'Presencial'}</span>
                                <span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:600;">⏱️ ${c.hs_totales || 0} hs</span>
                                <span style="background:${bgProg}; color:${colorProg}; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">Cumplimiento: ${cump.porcentaje}% (${cump.cumplidosTotal}/${cump.totalTarget})</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <button type="button" class="btn" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:0.8rem; padding:5px 10px; border-radius:6px; font-weight:600;" onclick="quitarCursoDePrograma(${idx})">
                            🗑️ Quitar Curso
                        </button>
                    </div>
                </div>

                <!-- PASO 1: FILTROS JERÁRQUICOS CON MULTI-SELECCIÓN -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                        <div>
                            <strong style="font-size:0.85rem; color:#1e293b;">🏢 1° Filtros Jerárquicos de Dotación (Multi-selección)</strong>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                                Podés tildar varias opciones en cada nivel jerárquico. Las opciones se filtran automáticamente en cascada.
                            </div>
                        </div>
                        <div style="font-size:0.78rem; font-weight:700; color:#0369a1; background:#e0f2fe; padding:3px 10px; border-radius:12px;">
                            👥 Coincidentes: ${poolJerarquia.length} empleados
                        </div>
                    </div>

                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        ${renderDropdown('direcciones', '1° Dirección', 'Todas las Direcciones', jerarquia.direcciones, c.filtros.direcciones || [])}
                        ${renderDropdown('gerencias', '2° Gerencia', 'Todas las Gerencias', jerarquia.gerencias, c.filtros.gerencias || [])}
                        ${renderDropdown('coordinaciones', '3° Coordinación', 'Todas las Coordinaciones', jerarquia.coordinaciones, c.filtros.coordinaciones || [])}
                        ${renderDropdown('jefaturas', '4° Jefatura', 'Todas las Jefaturas', jerarquia.jefaturas, c.filtros.jefaturas || [])}
                        ${renderDropdown('categorias', '5° Categoría / Puesto', 'Todas las Categorías', jerarquia.categorias, c.filtros.categorias || [])}
                    </div>
                </div>

                <!-- PASO 2: CASCADA A LEGAJOS DE LA DOTACIÓN FILTRADA -->
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                        <div>
                            <strong style="font-size:0.85rem; color:#1e293b;">📋 2° Alcance de Empleados / Legajos en Cascada</strong>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:1px;">
                                La lista de legajos solo muestra el personal alcanzado por los filtros jerárquicos previos.
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" 
                                    style="padding:5px 12px; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer; border:1px solid ${esModoTodos ? '#0284c7' : '#cbd5e1'}; background:${esModoTodos ? '#e0f2fe' : '#ffffff'}; color:${esModoTodos ? '#0369a1' : '#475569'};"
                                    onclick="cambiarModoLegajos(${idx}, 'todos')">
                                🔘 Asignar a TODOS los ${poolJerarquia.length} empleados
                            </button>
                            <button type="button" 
                                    style="padding:5px 12px; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer; border:1px solid ${!esModoTodos ? '#0284c7' : '#cbd5e1'}; background:${!esModoTodos ? '#e0f2fe' : '#ffffff'}; color:${!esModoTodos ? '#0369a1' : '#475569'};"
                                    onclick="cambiarModoLegajos(${idx}, 'especificos')">
                                ☑️ Tildar Legajos Específicos (${(c.legajos_seleccionados || []).length})
                            </button>
                        </div>
                    </div>

                    ${!esModoTodos ? `
                        <div style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:10px;">
                            <!-- Barra de control de legajos -->
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:260px;">
                                    <input type="text" 
                                           placeholder="🔍 Buscar por legajo, apellido o puesto dentro del grupo..." 
                                           oninput="filtrarLegajosDOM(${idx}, this.value)"
                                           style="padding:5px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:0.8rem; width:100%; max-width:360px;">
                                </div>
                                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                                    <button type="button" class="btn" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; font-size:0.75rem; padding:4px 8px; border-radius:6px;"
                                            onclick="marcarTodosLegajosFiltrados(${idx}, ${JSON.stringify(poolJerarquia.map(d => String(d.legajo || d.LEGAJO || '').trim()).filter(Boolean)).replace(/"/g, '&quot;')})">
                                        ✓ Marcar todos (${poolJerarquia.length})
                                    </button>
                                    <button type="button" class="btn" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; font-size:0.75rem; padding:4px 8px; border-radius:6px;"
                                            onclick="desmarcarTodosLegajosFiltrados(${idx})">
                                        ✕ Desmarcar
                                    </button>
                                    <button type="button" class="btn" style="background:#f1f5f9; color:#0369a1; border:1px solid #bae6fd; font-size:0.75rem; padding:4px 8px; border-radius:6px;"
                                            onclick="togglePanelPegarLegajos(${idx})">
                                        📋 Pegar números de legajo
                                    </button>
                                </div>
                            </div>

                            <!-- Panel colapsable para pegar números en lote -->
                            ${verPegarLegajosProg[idx] ? `
                                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:8px; margin-bottom:8px;">
                                    <div style="font-size:0.75rem; color:#475569; margin-bottom:4px;">Pegá números de legajo separados por comas, espacios o saltos de línea:</div>
                                    <div style="display:flex; gap:6px;">
                                        <textarea id="txt_pegar_legajos_${idx}" rows="2" placeholder="01001, 01002, 15, 23..." style="flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:6px; font-size:0.8rem; font-family:monospace;"></textarea>
                                        <button type="button" class="btn" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.78rem; font-weight:600;"
                                                onclick="agregarLegajosEnLote(${idx}, document.getElementById('txt_pegar_legajos_${idx}').value)">
                                            ➕ Agregar
                                        </button>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Grilla de legajos con checkboxes -->
                            <div class="prog-legajos-list" id="grid_legajos_${idx}">
                                ${poolJerarquia.length === 0 ? `
                                    <div style="padding:16px; font-size:0.82rem; color:#94a3b8; text-align:center; grid-column:1/-1;">
                                        No hay empleados en la nómina que cumplan los filtros jerárquicos seleccionados arriba.
                                    </div>
                                ` : poolJerarquia.map(emp => {
                                    const leg = String(emp.legajo || emp.LEGAJO || '').trim();
                                    const ap = emp.apellido || emp.APELLIDO || '';
                                    const no = emp.nombre || emp.NOMBRE || '';
                                    const puesto = emp.puesto || emp.PUESTO || emp.categoria || '';
                                    const ger = emp.gerencia || emp.GERENCIA || '';
                                    const checked = (c.legajos_seleccionados || []).includes(leg);

                                    return `
                                        <label class="prog-legajo-row ${checked ? 'selected' : ''}">
                                            <input type="checkbox" 
                                                   ${checked ? 'checked' : ''} 
                                                   onchange="toggleLegajoEnCurso(${idx}, '${leg}')">
                                            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                <strong style="font-family:monospace; color:#0f172a;">[${leg}]</strong>
                                                <span style="font-weight:600; color:#1e293b;">${ap}, ${no}</span>
                                                <span style="font-size:0.72rem; color:#64748b; display:block; overflow:hidden; text-overflow:ellipsis;">${puesto} ${ger ? `• ${ger}` : ''}</span>
                                            </div>
                                        </label>
                                    `;
                                }).join('')}
                            </div>

                            <div style="font-size:0.75rem; color:#64748b; margin-top:6px; text-align:right;">
                                <strong>${cump.totalTarget}</strong> de <strong>${poolJerarquia.length}</strong> empleados tildados para este curso
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Barra de Estadísticas y Acción para Ver Empleados -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding-top:6px; border-top:1px solid #f1f5f9;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <span style="font-size:0.82rem; font-weight:700; color:#0f172a;">
                            👥 Personal objetivo asignado: <strong style="color:#0284c7;">${cump.totalTarget} empleados</strong>
                        </span>
                        <span style="font-size:0.82rem; font-weight:600; color:#64748b;">
                            | ✓ Cursadas cumplidas: <strong style="color:${colorProg};">${cump.cumplidosTotal}</strong> (${cump.porcentaje}%)
                        </span>
                    </div>
                    <div>
                        <button type="button" class="btn" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; font-size:0.78rem; padding:4px 10px; border-radius:6px; font-weight:600;" onclick="toggleVerNominaCurso(${idx})">
                            ${estaAbiertaNomina ? '▲ Ocultar nómina de empleados' : `▼ Ver nómina alcanzada (${cump.totalTarget})`}
                        </button>
                    </div>
                </div>

                <!-- Tabla Colapsable de Empleados con su Estado -->
                ${estaAbiertaNomina ? `
                    <div style="margin-top:12px; border-top:1px solid #e2e8f0; padding-top:10px; overflow-x:auto;">
                        ${cump.listaConEstado.length === 0 ? `
                            <p style="font-size:0.82rem; color:#94a3b8; margin:8px 0;">No se encontraron empleados asignados a este curso con la configuración actual.</p>
                        ` : `
                            <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                                <thead>
                                    <tr style="background:#f1f5f9; color:#475569; text-align:left;">
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Legajo</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Apellido y Nombre</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Puesto / Categoría</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Gerencia</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Jefatura</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0; text-align:center;">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${cump.listaConEstado.map(emp => `
                                        <tr style="border-bottom:1px solid #f8fafc;">
                                            <td style="padding:6px 8px; font-family:monospace; font-weight:700;">${emp.legajo}</td>
                                            <td style="padding:6px 8px;"><strong>${emp.apellido}</strong>, ${emp.nombre}</td>
                                            <td style="padding:6px 8px; color:#475569;">${emp.puesto}</td>
                                            <td style="padding:6px 8px; color:#475569;">${emp.gerencia}</td>
                                            <td style="padding:6px 8px; color:#475569;">${emp.jefatura}</td>
                                            <td style="padding:6px 8px; text-align:center;">
                                                ${emp.completo ? `
                                                    <span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.72rem;">✓ Cumplido</span>
                                                ` : `
                                                    <span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:10px; font-weight:600; font-size:0.72rem;">⏳ Pendiente</span>
                                                `}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                ` : ''}

            </div>
        `;
    });

    cont.innerHTML = html;

    // Actualizar panel de resumen métrico global
    if (panelResumen) {
        panelResumen.style.display = 'block';
        const porcGlobal = totalTargetGlobal > 0 ? Math.round((totalCumplidosGlobal / totalTargetGlobal) * 100) : 0;
        const colorP = porcGlobal >= 75 ? '#16a34a' : (porcGlobal >= 40 ? '#d97706' : '#64748b');

        panelResumen.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong style="color:#0f172a; font-size:0.92rem;">📊 Resumen Global del Programa:</strong>
                    <div style="font-size:0.8rem; color:#475569; margin-top:3px;">
                        <span>📚 <strong>${cursosAsignadosPrograma.length}</strong> cursos asignados</span> • 
                        <span>👥 <strong>${totalTargetGlobal}</strong> cursadas requeridas (${legajosUnicosGlobal.size} empleados únicos)</span> • 
                        <span>✓ <strong>${totalCumplidosGlobal}</strong> cursadas completadas</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:1.15rem; font-weight:800; color:${colorP};">${porcGlobal}% Cumplimiento</span>
                    <div class="prog-progress-wrap" style="width:160px; height:6px;">
                        <div class="prog-progress-fill" style="width:${porcGlobal}%; background:${colorP};"></div>
                    </div>
                </div>
            </div>
        `;
    }
}
window.renderizarCursosAsignadosFormulario = renderizarCursosAsignadosFormulario;

// 6. Modal de Seguimiento, Composición y Reporte Detallado del Programa
async function abrirModalDetallePrograma(codigo) {
    await asegurarCargasAuxiliaresProgramas();

    let prog = null;
    if (datosCatalogoActual && Array.isArray(datosCatalogoActual)) {
        prog = datosCatalogoActual.find(p => String(p.codigo_programa || p.codigo || p.id) === String(codigo));
    }
    if (!prog && window.dbLocal && window.dbLocal.raw) {
        const progs = window.dbLocal.raw.leerTabla('programas') || [];
        prog = progs.find(p => String(p.codigo_programa || p.codigo || p.id) === String(codigo));
    }

    if (!prog) {
        return alert('No se encontró el registro del programa solicitado.');
    }

    programaDetalleActivo = prog;
    vistaNominaModalAbierta = {};

    const metricas = calcularMetricasProgramaRapidas(prog);

    document.getElementById('det_prog_titulo').textContent = `${prog.codigo_programa || prog.codigo} - ${prog.nombre || 'Programa'}`;
    document.getElementById('det_prog_subtitulo').textContent = prog.descripcion || 'Estructura curricular de cursos y público destinatario asignado.';
    
    document.getElementById('det_kpi_cursos').textContent = metricas.totalCursos;
    document.getElementById('det_kpi_cursadas_obj').textContent = metricas.totalTarget;
    document.getElementById('det_kpi_empleados_unicos').textContent = `(${metricas.empleadosUnicos} personas únicas)`;
    document.getElementById('det_kpi_cursadas_cumplidas').textContent = metricas.totalCumplidos;
    document.getElementById('det_kpi_porcentaje_global').textContent = `${metricas.porcentaje}%`;
    document.getElementById('det_kpi_progress_bar').style.width = `${metricas.porcentaje}%`;

    const colorGlobal = metricas.porcentaje >= 75 ? '#16a34a' : (metricas.porcentaje >= 40 ? '#d97706' : '#64748b');
    document.getElementById('det_kpi_progress_bar').style.background = colorGlobal;

    // Calcular total de horas
    const totalHs = (prog.cursos_asignados || []).reduce((acc, c) => acc + (parseFloat(c.hs_totales) || 0), 0);
    document.getElementById('det_prog_total_horas').textContent = `⏱️ ${totalHs} hs totales de cursada`;

    renderizarCursosDetalleModal();

    const modal = document.getElementById('modalDetallePrograma');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalDetallePrograma = abrirModalDetallePrograma;

function cerrarModalDetallePrograma() {
    const modal = document.getElementById('modalDetallePrograma');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalDetallePrograma = cerrarModalDetallePrograma;

function toggleVerNominaCursoModal(idxCurso) {
    vistaNominaModalAbierta[idxCurso] = !vistaNominaModalAbierta[idxCurso];
    renderizarCursosDetalleModal();
}
window.toggleVerNominaCursoModal = toggleVerNominaCursoModal;

function renderizarCursosDetalleModal() {
    const cont = document.getElementById('det_prog_lista_cursos');
    if (!cont || !programaDetalleActivo) return;

    const cursos = programaDetalleActivo.cursos_asignados || [];
    if (cursos.length === 0) {
        cont.innerHTML = `
            <div style="background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; padding:20px; text-align:center; color:#64748b;">
                <p style="margin:0; font-size:0.9rem;">Este programa no tiene cursos asignados en este momento. Edite el programa desde la tabla para asignarle cursos y definir el público objetivo.</p>
            </div>
        `;
        return;
    }

    const dotacion = cacheDotacionProg || [];
    const caps = cacheCapacitacionesProg || [];
    const asists = cacheAsistentesProg || [];

    let html = '';

    cursos.forEach((c, idx) => {
        normalizarConfigCurso(c);
        const dest = calcularDestinatariosCurso(c, dotacion);
        const cump = calcularCumplimientoCurso(c, dest, caps, asists);
        const colorP = cump.porcentaje >= 75 ? '#16a34a' : (cump.porcentaje >= 40 ? '#d97706' : '#64748b');
        const bgP = cump.porcentaje >= 75 ? '#dcfce7' : (cump.porcentaje >= 40 ? '#fef3c7' : '#f1f5f9');
        const abierta = Boolean(vistaNominaModalAbierta[idx]);

        let descPublico = '';
        const f = c.filtros || {};
        const partesFiltros = [];
        if (f.direcciones && f.direcciones.length > 0) partesFiltros.push(`Dir: [${f.direcciones.join(', ')}]`);
        if (f.gerencias && f.gerencias.length > 0) partesFiltros.push(`Ger: [${f.gerencias.join(', ')}]`);
        if (f.coordinaciones && f.coordinaciones.length > 0) partesFiltros.push(`Coord: [${f.coordinaciones.join(', ')}]`);
        if (f.jefaturas && f.jefaturas.length > 0) partesFiltros.push(`Jef: [${f.jefaturas.join(', ')}]`);
        if (f.categorias && f.categorias.length > 0) partesFiltros.push(`Cat: [${f.categorias.join(', ')}]`);

        if (c.modo_legajos === 'especificos') {
            const cantLegs = (c.legajos_seleccionados || []).length;
            descPublico = `📋 <strong>Legajos Específicos:</strong> ${cantLegs} seleccionados ${partesFiltros.length > 0 ? `(dentro de: ${partesFiltros.join(' > ')})` : ''}`;
        } else {
            descPublico = `🏢 <strong>Filtros Jerárquicos:</strong> ${partesFiltros.length > 0 ? partesFiltros.join(' > ') : 'Toda la dotación'}`;
        }

        html += `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:1.1rem;">📘</span>
                            <strong style="font-size:1rem; color:#0f172a;">[${c.codigo_curso}] ${c.nombre_curso}</strong>
                            <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">${c.modalidad || 'Presencial'}</span>
                            <span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:600;">⏱️ ${c.hs_totales || 0} hs</span>
                        </div>
                        <div style="margin-top:6px; font-size:0.82rem; color:#475569;">
                            ${descPublico}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.95rem; font-weight:800; color:${colorP}; background:${bgP}; padding:3px 10px; border-radius:12px;">
                            ${cump.porcentaje}% (${cump.cumplidosTotal}/${cump.totalTarget})
                        </span>
                        <div class="prog-progress-wrap" style="width:140px; height:6px; margin-top:4px;">
                            <div class="prog-progress-fill" style="width:${cump.porcentaje}%; background:${colorP};"></div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:8px;">
                    <span style="font-size:0.8rem; color:#64748b;">
                        Público: <strong>${cump.totalTarget}</strong> alcanzados | Cumplidos: <strong style="color:${colorP};">${cump.cumplidosTotal}</strong> | Pendientes: <strong>${cump.totalTarget - cump.cumplidosTotal}</strong>
                    </span>
                    <button type="button" class="btn" style="background:#f8fafc; color:#334155; border:1px solid #cbd5e1; font-size:0.78rem; padding:4px 10px; border-radius:6px; font-weight:600;" onclick="toggleVerNominaCursoModal(${idx})">
                        ${abierta ? '▲ Ocultar nómina y estados' : `▼ Ver nómina y estados (${cump.totalTarget})`}
                    </button>
                </div>

                ${abierta ? `
                    <div style="margin-top:12px; border-top:1px solid #e2e8f0; padding-top:10px; overflow-x:auto;">
                        ${cump.listaConEstado.length === 0 ? `
                            <p style="font-size:0.82rem; color:#94a3b8; margin:6px 0;">No hay empleados alcanzados por la configuración de este curso.</p>
                        ` : `
                            <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                                <thead>
                                    <tr style="background:#f8fafc; color:#475569; text-align:left;">
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Legajo</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Apellido y Nombre</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Puesto</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Gerencia</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0;">Jefatura</th>
                                        <th style="padding:6px 8px; border-bottom:1px solid #e2e8f0; text-align:center;">Asistencia / Cumplimiento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${cump.listaConEstado.map(emp => `
                                        <tr style="border-bottom:1px solid #f8fafc;">
                                            <td style="padding:6px 8px; font-family:monospace; font-weight:700;">${emp.legajo}</td>
                                            <td style="padding:6px 8px;"><strong>${emp.apellido}</strong>, ${emp.nombre}</td>
                                            <td style="padding:6px 8px; color:#475569;">${emp.puesto}</td>
                                            <td style="padding:6px 8px; color:#475569;">${emp.gerencia}</td>
                                            <td style="padding:6px 8px; color:#475569;">${emp.jefatura}</td>
                                            <td style="padding:6px 8px; text-align:center;">
                                                ${emp.completo ? `
                                                    <span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.72rem;">✓ Cumplido</span>
                                                ` : `
                                                    <span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:10px; font-weight:600; font-size:0.72rem;">⏳ Pendiente</span>
                                                `}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                ` : ''}

            </div>
        `;
    });

    cont.innerHTML = html;
}

// 7. Exportación a Excel del Informe Detallado de Seguimiento del Programa
function exportarDetalleProgramaExcel() {
    if (!programaDetalleActivo) return;
    if (typeof XLSX === 'undefined') {
        return alert('La biblioteca XLSX no se encuentra disponible para exportar.');
    }

    const prog = programaDetalleActivo;
    const metricas = calcularMetricasProgramaRapidas(prog);
    const dotacion = cacheDotacionProg || [];
    const caps = cacheCapacitacionesProg || [];
    const asists = cacheAsistentesProg || [];

    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen General
    const resumenData = [
        { Propiedad: 'Código del Programa', Valor: prog.codigo_programa || prog.codigo },
        { Propiedad: 'Nombre del Programa', Valor: prog.nombre || '-' },
        { Propiedad: 'Descripción', Valor: prog.descripcion || '-' },
        { Propiedad: 'Estado', Valor: prog.estado || 'Activo' },
        { Propiedad: 'Total de Cursos Asignados', Valor: metricas.totalCursos },
        { Propiedad: 'Total de Cursadas Requeridas', Valor: metricas.totalTarget },
        { Propiedad: 'Total de Cursadas Cumplidas', Valor: metricas.totalCumplidos },
        { Propiedad: 'Porcentaje de Cumplimiento Global', Valor: `${metricas.porcentaje}%` },
        { Propiedad: 'Total de Empleados Únicos Involucrados', Valor: metricas.empleadosUnicos },
        { Propiedad: 'Fecha de Emisión del Reporte', Valor: new Date().toLocaleString() }
    ];
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Programa');

    // Hoja 2: Cursos y Criterios
    const cursosData = [];
    (prog.cursos_asignados || []).forEach(c => {
        normalizarConfigCurso(c);
        const dest = calcularDestinatariosCurso(c, dotacion);
        const cump = calcularCumplimientoCurso(c, dest, caps, asists);
        
        let criterioDesc = '';
        const f = c.filtros || {};
        const partesFiltros = [];
        if (f.direcciones && f.direcciones.length > 0) partesFiltros.push(`Dir=[${f.direcciones.join(', ')}]`);
        if (f.gerencias && f.gerencias.length > 0) partesFiltros.push(`Ger=[${f.gerencias.join(', ')}]`);
        if (f.coordinaciones && f.coordinaciones.length > 0) partesFiltros.push(`Coord=[${f.coordinaciones.join(', ')}]`);
        if (f.jefaturas && f.jefaturas.length > 0) partesFiltros.push(`Jef=[${f.jefaturas.join(', ')}]`);
        if (f.categorias && f.categorias.length > 0) partesFiltros.push(`Cat=[${f.categorias.join(', ')}]`);

        if (c.modo_legajos === 'especificos') {
            criterioDesc = `Legajos específicos (${(c.legajos_seleccionados || []).length}): ${(c.legajos_seleccionados || []).join(', ')}`;
            if (partesFiltros.length > 0) criterioDesc += ` | Filtros: ${partesFiltros.join(' > ')}`;
        } else {
            criterioDesc = partesFiltros.length > 0 ? `Filtros: ${partesFiltros.join(' > ')}` : 'Toda la dotación';
        }

        cursosData.push({
            'Código Curso': c.codigo_curso,
            'Nombre Curso': c.nombre_curso,
            'Modalidad': c.modalidad || 'Presencial',
            'Carga Horaria (hs)': c.hs_totales || 0,
            'Tipo Destinatario': c.modo_legajos === 'especificos' ? 'Legajos Específicos' : 'Filtros Jerárquicos',
            'Criterio de Público': criterioDesc,
            'Destinatarios Requeridos': cump.totalTarget,
            'Cursadas Cumplidas': cump.cumplidosTotal,
            'Cursadas Pendientes': cump.totalTarget - cump.cumplidosTotal,
            '% Cumplimiento': `${cump.porcentaje}%`
        });
    });
    const wsCursos = XLSX.utils.json_to_sheet(cursosData);
    XLSX.utils.book_append_sheet(wb, wsCursos, 'Cursos_y_Metas');

    // Hoja 3: Nómina Completa de Empleados y Cumplimiento
    const nominaData = [];
    (prog.cursos_asignados || []).forEach(c => {
        normalizarConfigCurso(c);
        const dest = calcularDestinatariosCurso(c, dotacion);
        const cump = calcularCumplimientoCurso(c, dest, caps, asists);

        cump.listaConEstado.forEach(emp => {
            nominaData.push({
                'Código Programa': prog.codigo_programa || prog.codigo,
                'Código Curso': c.codigo_curso,
                'Nombre Curso': c.nombre_curso,
                'Legajo': emp.legajo,
                'Apellido': emp.apellido,
                'Nombre': emp.nombre,
                'Puesto': emp.puesto,
                'Dirección': emp.direccion,
                'Gerencia': emp.gerencia,
                'Coordinación': emp.coordinacion,
                'Jefatura': emp.jefatura,
                'Categoría': emp.categoria,
                'Estado Cursada': emp.completo ? 'Cumplido' : 'Pendiente'
            });
        });
    });
    const wsNomina = XLSX.utils.json_to_sheet(nominaData);
    XLSX.utils.book_append_sheet(wb, wsNomina, 'Nomina_Detallada');

    const codFile = (prog.codigo_programa || prog.codigo || 'PRO').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Seguimiento_${codFile}.xlsx`);
}
window.exportarDetalleProgramaExcel = exportarDetalleProgramaExcel;

// =========================================================================
// 8. GENERADOR DE REPORTE DE ESTADO DE PROGRAMA EN PDF CON SELECCIÓN MODULAR
// =========================================================================

function abrirModalOpcionesPdfPrograma() {
    if (!programaDetalleActivo) {
        return alert('No hay ningún programa seleccionado para exportar.');
    }
    const cod = programaDetalleActivo.codigo_programa || programaDetalleActivo.codigo || 'PRO';
    const nom = programaDetalleActivo.nombre || 'Programa';
    const sub = document.getElementById('pdf_prog_subtitulo');
    if (sub) {
        sub.textContent = `Informe para: [${cod}] ${nom}`;
    }
    const msg = document.getElementById('pdfMensajeEstado');
    if (msg) msg.style.display = 'none';

    const modal = document.getElementById('modalOpcionesPdfPrograma');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalOpcionesPdfPrograma = abrirModalOpcionesPdfPrograma;

function cerrarModalOpcionesPdfPrograma() {
    const modal = document.getElementById('modalOpcionesPdfPrograma');
    if (modal) modal.style.display = 'none';
}
window.cerrarModalOpcionesPdfPrograma = cerrarModalOpcionesPdfPrograma;

function marcarTodosChecksPdf(marcar) {
    const ids = ['chkPdfSecGenerales', 'chkPdfSecHoraria', 'chkPdfSecOrigen', 'chkPdfSecTendencias', 'chkPdfSecNomina'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(marcar);
    });
}
window.marcarTodosChecksPdf = marcarTodosChecksPdf;

async function generarReporteEstadoProgramaPDF(soloImprimir = false) {
    if (!programaDetalleActivo) {
        return alert('No hay ningún programa seleccionado.');
    }

    const incGenerales = document.getElementById('chkPdfSecGenerales')?.checked;
    const incHoraria = document.getElementById('chkPdfSecHoraria')?.checked;
    const incOrigen = document.getElementById('chkPdfSecOrigen')?.checked;
    const incTendencias = document.getElementById('chkPdfSecTendencias')?.checked;
    const incNomina = document.getElementById('chkPdfSecNomina')?.checked;

    if (!incGenerales && !incHoraria && !incOrigen && !incTendencias && !incNomina) {
        return alert('Por favor seleccioná al menos una sección para incluir en el reporte PDF.');
    }

    const msg = document.getElementById('pdfMensajeEstado');
    const btnDescargar = document.getElementById('btnDescargarPdfPrograma');
    if (msg) {
        msg.style.display = 'block';
        msg.textContent = soloImprimir ? 'Preparando vista de impresión...' : 'Generando documento PDF... Aguarde unos segundos.';
    }
    if (btnDescargar) btnDescargar.disabled = true;

    try {
        const prog = programaDetalleActivo;
        const metricas = calcularMetricasProgramaRapidas(prog);
        const dotacion = cacheDotacionProg || [];
        const caps = cacheCapacitacionesProg || [];
        const asists = cacheAsistentesProg || [];
        const cursos = prog.cursos_asignados || [];

        // 1. Cálculos de Carga Horaria e Intensidad
        let hsTotalesPrograma = 0;
        let hhProyectadas = 0;
        let hhCumplidas = 0;
        let cursosPresenciales = 0;
        let cursosVirtuales = 0;
        let cursosHibridos = 0;

        const cursosProcesados = cursos.map(c => {
            normalizarConfigCurso(c);
            const dest = calcularDestinatariosCurso(c, dotacion);
            const cump = calcularCumplimientoCurso(c, dest, caps, asists);
            const hs = Number(c.hs_totales) || 0;
            const mod = (c.modalidad || 'Presencial').toLowerCase();

            hsTotalesPrograma += hs;
            hhProyectadas += (hs * cump.totalTarget);
            hhCumplidas += (hs * cump.cumplidosTotal);

            if (mod.includes('virt') || mod.includes('elearn') || mod.includes('onl')) {
                cursosVirtuales++;
            } else if (mod.includes('semi') || mod.includes('mixt') || mod.includes('hibr')) {
                cursosHibridos++;
            } else {
                cursosPresenciales++;
            }

            return {
                ...c,
                destinatariosTotal: cump.totalTarget,
                cumplidosTotal: cump.cumplidosTotal,
                porcentaje: cump.porcentaje,
                listaConEstado: cump.listaConEstado
            };
        });

        const totalCursos = cursos.length;
        const promedioHsCurso = totalCursos > 0 ? (hsTotalesPrograma / totalCursos).toFixed(1) : '0.0';
        const hsPerCapita = metricas.empleadosUnicos > 0 ? (hhCumplidas / metricas.empleadosUnicos).toFixed(1) : '0.0';
        const pctElearning = totalCursos > 0 ? Math.round((cursosVirtuales / totalCursos) * 100) : 0;

        // Formato fechas
        const ahora = new Date();
        const fechaEmision = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaEmision = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const codProg = prog.codigo_programa || prog.codigo || 'PRO-2026';
        const nomProg = prog.nombre || 'Programa de Capacitación';
        const descProg = prog.descripcion || 'Plan de formación continua y desarrollo de competencias.';
        const estadoProg = prog.estado || 'Activo';

        // Construir contenedor imprimible
        const wrap = document.createElement('div');
        wrap.id = 'pdfRenderWrapPrograma';
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

        let htmlContenido = `
            <!-- ENCABEZADO MEMBRETADO OFICIAL -->
            <div style="border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px;">
                        SIGA-AP • SISTEMA INTEGRAL DE GESTIÓN ACADÉMICA
                    </div>
                    <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">
                        INFORME DE ESTADO Y GESTIÓN DE PROGRAMA
                    </h1>
                    <div style="font-size: 13px; font-weight: 700; color: #334155;">
                        [${codProg}] ${nomProg}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 3px; max-width: 520px;">
                        ${descProg}
                    </div>
                </div>
                <div style="text-align: right; font-size: 10px; color: #64748b; line-height: 1.4;">
                    <div style="display: inline-block; background: ${estadoProg === 'Activo' ? '#dcfce7' : '#f1f5f9'}; color: ${estadoProg === 'Activo' ? '#15803d' : '#475569'}; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 10px; margin-bottom: 4px;">
                        ESTADO: ${estadoProg.toUpperCase()}
                    </div>
                    <div><strong>Fecha de emisión:</strong> ${fechaEmision} ${horaEmision} hs</div>
                    <div><strong>Usuario emisor:</strong> Ariel Pizzutto</div>
                    <div><strong>Referencia:</strong> SIGA-AUDIT-PROG</div>
                </div>
            </div>
        `;

        // 1. INDICADORES GENERALES DE GESTIÓN
        if (incGenerales) {
            const colorCumpl = metricas.porcentaje >= 75 ? '#16a34a' : (metricas.porcentaje >= 40 ? '#d97706' : '#dc2626');
            htmlContenido += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #0284c7; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        📊 Indicadores Generales de Gestión
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cursos Asignados</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 3px;">${metricas.totalCursos}</div>
                            <div style="font-size: 9px; color: #94a3b8;">en el programa</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #0284c7; text-transform: uppercase;">Cursadas Requeridas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 3px;">${metricas.totalTarget}</div>
                            <div style="font-size: 9px; color: #0284c7;">(${metricas.empleadosUnicos} pers. únicas)</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #16a34a; text-transform: uppercase;">Cursadas Cumplidas</div>
                            <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-top: 3px;">${metricas.totalCumplidos}</div>
                            <div style="font-size: 9px; color: #16a34a;">${metricas.totalTarget - metricas.totalCumplidos} pendientes</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: ${colorCumpl}; text-transform: uppercase;">Cumplimiento Global</div>
                            <div style="font-size: 18px; font-weight: 800; color: ${colorCumpl}; margin-top: 3px;">${metricas.porcentaje}%</div>
                            <div style="height: 5px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 4px;">
                                <div style="width: ${Math.min(100, metricas.porcentaje)}%; height: 100%; background: ${colorCumpl};"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. CARGA HORARIA E INTENSIDAD
        if (incHoraria) {
            htmlContenido += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #7c3aed; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        ⏱️ Carga Horaria e Intensidad
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Horas de Formación</div>
                            <div style="font-size: 18px; font-weight: 800; color: #7c3aed; margin-top: 3px;">${hsTotalesPrograma} hs</div>
                            <div style="font-size: 9px; color: #94a3b8;">suma de cursos</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Horas-Hombre</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 3px;">${hhCumplidas} hs</div>
                            <div style="font-size: 9px; color: #64748b;">de ${hhProyectadas} hs proyectadas</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Promedio Hs / Curso</div>
                            <div style="font-size: 18px; font-weight: 800; color: #d97706; margin-top: 3px;">${promedioHsCurso} hs</div>
                            <div style="font-size: 9px; color: #94a3b8;">intensidad media</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Hs Formación Per Cápita</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 3px;">${hsPerCapita} hs</div>
                            <div style="font-size: 9px; color: #94a3b8;">por empleado alcanzado</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 3. ORIGEN Y E-LEARNING
        if (incOrigen) {
            htmlContenido += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #059669; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        🏢 Origen y E-Learning
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cursos Presenciales</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 3px;">${cursosPresenciales}</div>
                            <div style="font-size: 9px; color: #64748b;">${totalCursos > 0 ? Math.round((cursosPresenciales / totalCursos) * 100) : 0}% del programa</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cursos Virtuales / E-Learning</div>
                            <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 3px;">${cursosVirtuales}</div>
                            <div style="font-size: 9px; color: #059669;">${cursosHibridos > 0 ? `+ ${cursosHibridos} semipresenciales` : 'modalidad online'}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">% Virtualidad (E-Learning)</div>
                            <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 3px;">${pctElearning}%</div>
                            <div style="font-size: 9px; color: #94a3b8;">adopción digital</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 4. ANÁLISIS DE TENDENCIAS Y DISTRIBUCIÓN (MATRIZ COMPARATIVA DE CURSOS)
        if (incTendencias) {
            htmlContenido += `
                <div style="margin-bottom: 18px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border-left: 4px solid #ea580c; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        📈 Análisis de Tendencias y Distribución por Curso
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                        <thead>
                            <tr style="background: #e2e8f0; color: #1e293b; text-align: left;">
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Código</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Nombre del Curso</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">Mod.</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Carga</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Meta</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Cumpl.</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">% Avance</th>
                                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cursosProcesados.map(c => {
                                const col = c.porcentaje >= 75 ? '#16a34a' : (c.porcentaje >= 40 ? '#d97706' : '#dc2626');
                                const bgCol = c.porcentaje >= 75 ? '#dcfce7' : (c.porcentaje >= 40 ? '#fef3c7' : '#fee2e2');
                                const estTxt = c.porcentaje >= 75 ? 'Óptimo' : (c.porcentaje >= 40 ? 'En Avance' : 'Crítico');
                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; border: 1px solid #e2e8f0;">${c.codigo_curso}</td>
                                        <td style="padding: 6px 8px; font-weight: 600; border: 1px solid #e2e8f0;">${c.nombre_curso}</td>
                                        <td style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0;">${c.modalidad || 'Presencial'}</td>
                                        <td style="padding: 6px 8px; text-align: right; border: 1px solid #e2e8f0;">${c.hs_totales || 0} hs</td>
                                        <td style="padding: 6px 8px; text-align: right; font-weight: 700; border: 1px solid #e2e8f0;">${c.destinatariosTotal}</td>
                                        <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #16a34a; border: 1px solid #e2e8f0;">${c.cumplidosTotal}</td>
                                        <td style="padding: 6px 8px; text-align: right; font-weight: 800; color: ${col}; border: 1px solid #e2e8f0;">${c.porcentaje}%</td>
                                        <td style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0;">
                                            <span style="display: inline-block; background: ${bgCol}; color: ${col}; font-weight: 800; font-size: 9.5px; padding: 2px 6px; border-radius: 4px;">
                                                ${estTxt}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // 5. ANEXO: NÓMINA DETALLADA DE PERSONAL Y ESTADOS
        if (incNomina) {
            const empleadosNomina = [];
            cursosProcesados.forEach(c => {
                (c.listaConEstado || []).forEach(emp => {
                    empleadosNomina.push({
                        curso: c.codigo_curso,
                        legajo: emp.legajo,
                        nombre: `${emp.apellido || ''}, ${emp.nombre || ''}`,
                        puesto: emp.puesto || '-',
                        gerencia: emp.gerencia || '-',
                        jefatura: emp.jefatura || '-',
                        completo: emp.completo
                    });
                });
            });

            htmlContenido += `
                <div style="margin-top: 18px;">
                    <div style="background: #f1f5f9; border-left: 4px solid #334155; padding: 6px 10px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase;">
                        📋 Anexo: Nómina Detallada de Personal y Estados (${empleadosNomina.length} registros)
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead>
                            <tr style="background: #e2e8f0; color: #1e293b; text-align: left;">
                                <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Curso</th>
                                <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Legajo</th>
                                <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Apellido y Nombre</th>
                                <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Puesto</th>
                                <th style="padding: 5px 6px; border: 1px solid #cbd5e1;">Gerencia / Área</th>
                                <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${empleadosNomina.map(emp => `
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 4px 6px; font-family: monospace; font-weight: 700; border: 1px solid #e2e8f0;">${emp.curso}</td>
                                    <td style="padding: 4px 6px; font-family: monospace; border: 1px solid #e2e8f0;">${emp.legajo}</td>
                                    <td style="padding: 4px 6px; font-weight: 600; border: 1px solid #e2e8f0;">${emp.nombre}</td>
                                    <td style="padding: 4px 6px; color: #475569; border: 1px solid #e2e8f0;">${emp.puesto}</td>
                                    <td style="padding: 4px 6px; color: #475569; border: 1px solid #e2e8f0;">${emp.gerencia}</td>
                                    <td style="padding: 4px 6px; text-align: center; border: 1px solid #e2e8f0;">
                                        ${emp.completo ? `
                                            <span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px;">✓ Cumplido</span>
                                        ` : `
                                            <span style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 9px;">⏳ Pendiente</span>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // PIE DE PÁGINA INSTITUCIONAL
        htmlContenido += `
            <div style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8;">
                <div>SIGA-AP • Dirección de Capacitación y Gestión de Talento</div>
                <div>Documento Oficial Generado Automáticamente</div>
            </div>
        `;

        wrap.innerHTML = htmlContenido;

        // ACCIÓN: O IMPRIMIR O DESCARGAR PDF CON HTML2PDF
        if (soloImprimir) {
            const ventana = window.open('', '_blank');
            if (ventana) {
                ventana.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Reporte_Programa_${codProg}</title>
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
            // Descargar mediante html2pdf
            if (typeof html2pdf === 'function') {
                const nombreLimpio = `Reporte_Estado_Programa_${codProg.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
                const opt = {
                    margin: [8, 8, 8, 8],
                    filename: nombreLimpio,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                await html2pdf().set(opt).from(wrap).save();
                if (msg) {
                    msg.style.background = '#dcfce7';
                    msg.style.color = '#15803d';
                    msg.textContent = '¡Reporte PDF descargado exitosamente!';
                    setTimeout(() => { cerrarModalOpcionesPdfPrograma(); }, 1600);
                }
            } else {
                // Si la librería no cargó, fallback directo a ventana de impresión
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
        console.error('Error generando reporte PDF de programa:', err);
        alert('Ocurrió un inconveniente al generar el reporte en PDF: ' + err.message);
    } finally {
        if (btnDescargar) btnDescargar.disabled = false;
    }
}
window.generarReporteEstadoProgramaPDF = generarReporteEstadoProgramaPDF;


