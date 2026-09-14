// ===================================================
// SIGA_APP - LÓGICA DE BÚSQUEDA DE DOTACIÓN (LOCAL)
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarEventosDotacion();
    actualizarFechaDotacionUI();
});

window.addEventListener('siga_db_ready', () => {
    actualizarFechaDotacionUI();
});

function obtenerBaseDotacionLocal() {
    if (window.dbLocal && window.dbLocal.raw) {
        const datos = window.dbLocal.raw.leerTabla('dotacion');
        if (Array.isArray(datos) && datos.length > 0) return datos;
    }
    
    try {
        const rawLocal = localStorage.getItem('SIGA_DB_dotacion');
        if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {}

    if (typeof empleadosData !== 'undefined' && Array.isArray(empleadosData) && empleadosData.length > 0) {
        return empleadosData;
    }

    if (typeof empleados !== 'undefined' && Array.isArray(empleados) && empleados.length > 0) {
        return empleados;
    }

    return [];
}

function actualizarFechaDotacionUI() {
    const lblFecha = document.getElementById('fechaDotacion');
    if (!lblFecha) return;

    const fechaGuardada = localStorage.getItem('fechaUltimaDotacion');
    const base = obtenerBaseDotacionLocal();

    if (fechaGuardada) {
        lblFecha.textContent = fechaGuardada;
    } else if (base.length > 0) {
        const hoy = new Date().toLocaleDateString('es-AR');
        lblFecha.textContent = `${hoy} (${base.length} empleados)`;
    } else {
        lblFecha.textContent = '--/--/---- (Sin base importada)';
    }
}

function normalizarTextoClave(txt) {
    if (!txt) return '';
    return String(txt)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quita tildes
        .replace(/[^a-z0-9]/g, ''); // Quita guiones, espacios, puntos
}

function obtenerValorCampo(emp, clavesPosibles, fallback = '') {
    if (!emp || typeof emp !== 'object') return fallback;

    const dc = emp.datos_completos || {};

    // 1. Buscar en propiedades de nivel raíz
    for (const clave of clavesPosibles) {
        const cNorm = normalizarTextoClave(clave);
        for (const [k, v] of Object.entries(emp)) {
            if (k === 'datos_completos') continue;
            if (normalizarTextoClave(k) === cNorm && v !== undefined && v !== null && String(v).trim() !== '') {
                return String(v).trim();
            }
        }
    }

    // 2. Buscar en datos_completos
    for (const clave of clavesPosibles) {
        const cNorm = normalizarTextoClave(clave);
        for (const [k, v] of Object.entries(dc)) {
            if (normalizarTextoClave(k) === cNorm && v !== undefined && v !== null && String(v).trim() !== '') {
                return String(v).trim();
            }
        }
    }

    return fallback;
}

function inicializarEventosDotacion() {
    const inputLegajo = document.getElementById('legajo');
    if (!inputLegajo) return;

    // Detectar cuando el usuario escribe para disparar al llegar a 5 dígitos
    inputLegajo.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, ''); // Solo números
        e.target.value = val;

        if (val.length === 5) {
            ejecutarBusquedaLegajo();
        }
    });

    inputLegajo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            ejecutarBusquedaLegajo();
        }
    });
}

function ejecutarBusquedaLegajo() {
    const inputLegajo = document.getElementById('legajo');
    if (!inputLegajo) return;

    let valorRaw = inputLegajo.value.trim();
    if (!valorRaw) return;

    const baseLocal = obtenerBaseDotacionLocal();

    if (!Array.isArray(baseLocal) || baseLocal.length === 0) {
        alert("Atención: No se encontró la base de dotación cargada en el sistema.\n\nPor favor, ingresá a 'Administración' -> 'Bases' e importá el archivo de Dotación.");
        return;
    }

    // Convertir a número puro y a formato padded de 5 dígitos (ej: 1160 -> 01160, 102 -> 00102)
    const legajoNumero = parseInt(valorRaw, 10);
    const legajoPadded = String(legajoNumero).padStart(5, '0');
    
    // Formatear el input a 5 dígitos
    inputLegajo.value = isNaN(legajoNumero) ? valorRaw : legajoPadded;

    // Buscar coincidencia por legajo con ceros, sin ceros, número o campos
    const empleado = baseLocal.find(emp => {
        const leg = String(emp.legajo || emp.Legajo || emp.LEGAJO || emp.id || emp.dni || emp.ficha || emp.matricula || '').trim();
        const legLimpio = leg.replace(/\D/g, '');
        return leg === legajoPadded || 
               leg === valorRaw ||
               legLimpio === valorRaw || 
               legLimpio === String(legajoNumero) || 
               (legLimpio.length > 0 && !isNaN(legajoNumero) && parseInt(legLimpio, 10) === legajoNumero);
    });

    if (empleado) {
        completarCamposDotacion(empleado);
        inputLegajo.blur(); // Cierra el teclado en móviles/tablets
    } else {
        alert(`No se encontró ningún empleado con el legajo ${legajoPadded} (${valorRaw}) en los ${baseLocal.length} registros de la base actual.`);
        limpiarCamposDotacion(false);
    }
}

function completarCamposDotacion(e) {
    // 1. Apellido y Nombre
    let apellido = obtenerValorCampo(e, ['apellido', 'apellidos', 'ape', 'lastname', 'surname']);
    let nombre = obtenerValorCampo(e, ['nombre', 'nombres', 'nom', 'firstname', 'givenname']);
    const nombreCompleto = obtenerValorCampo(e, ['nombre_completo', 'nombrecompleto', 'nombreyapellido', 'empleado', 'agente', 'persona']);

    // Si viene en un único campo "APELLIDO, NOMBRE" o "APELLIDO NOMBRE"
    if (!apellido && nombreCompleto) {
        if (nombreCompleto.includes(',')) {
            const partes = nombreCompleto.split(',');
            apellido = partes[0].trim();
            nombre = partes.slice(1).join(',').trim();
        } else if (nombreCompleto.includes(' ')) {
            const partes = nombreCompleto.split(' ');
            apellido = partes[0].trim();
            nombre = partes.slice(1).join(' ').trim();
        } else {
            apellido = nombreCompleto;
        }
    } else if (!apellido && nombre && nombre.includes(',')) {
        const partes = nombre.split(',');
        apellido = partes[0].trim();
        nombre = partes.slice(1).join(',').trim();
    }

    // 2. Puesto / Cargo (Col E / N°5 / col_4)
    let puesto = e.puesto || '';
    if (!puesto || /^\d+$/.test(puesto)) {
        puesto = obtenerValorCampo(e, [
            'col_4', 'puesto', 'cargo', 'posicion', 'posicionlaboral', 'funcion', 'tarea', 'rol', 
            'jobtitle', 'position', 'puestotrabajo', 'puestodetrabajo', 'denominacionpuesto', 'descripcionpuesto'
        ], puesto);
    }

    // 3. Categoría / Convenio / Nivel (Col I / N°9 / col_8)
    let categoria = e.categoria || obtenerValorCampo(e, [
        'col_8', 'categoria', 'cat', 'convenio', 'nivel', 'banda', 'grado', 'escalafon', 
        'category', 'agrupamiento', 'clase'
    ]);

    // 4. Dirección / Departamento nivel 1 (Col N / N°14 / col_13)
    let direccion = e.direccion || obtenerValorCampo(e, [
        'col_13', 'departamento nivel 1', 'departamentonivel1', 'direccion', 'dir', 'planta', 'sector', 'area', 'unidad', 'ubicacion', 
        'direction', 'division', 'sitio'
    ]);

    // 5. Gerencia / Departamento nivel 2 (Col O / N°15 / col_14)
    let gerencia = e.gerencia;
    if (!gerencia && e.col_14) gerencia = e.col_14;
    if (!gerencia && e.datos_completos && e.datos_completos.col_14) gerencia = e.datos_completos.col_14;
    if (!gerencia) {
        gerencia = obtenerValorCampo(e, [
            'col_14', 'departamento nivel 2', 'departamentonivel2', 'gerencia', 'gerente', 'ger', 'departamento', 'depto', 'dpto', 'management'
        ]);
    }

    // 6. Coordinación / Departamento nivel 3 (Col P / N°16 / col_15)
    let coordinacion = e.coordinacion;
    if (!coordinacion && e.col_15) coordinacion = e.col_15;
    if (!coordinacion && e.datos_completos && e.datos_completos.col_15) coordinacion = e.datos_completos.col_15;
    if (!coordinacion) {
        coordinacion = obtenerValorCampo(e, [
            'col_15', 'departamento nivel 3', 'departamentonivel3', 'coordinacion', 'coordinador', 'coord'
        ]);
    }

    // 7. Jefatura / Departamento nivel 4 (Col Q / N°17 / col_16)
    let jefatura = e.jefatura;
    if (!jefatura && e.col_16) jefatura = e.col_16;
    if (!jefatura && e.datos_completos && e.datos_completos.col_16) jefatura = e.datos_completos.col_16;
    if (!jefatura) {
        jefatura = obtenerValorCampo(e, [
            'col_16', 'departamento nivel 4', 'departamentonivel4', 'jefatura', 'jefe', 'jefedirecto', 'jef', 'supervisor', 'supervision', 'lider', 
            'head', 'teamleader'
        ]);
    }

    // 8. Manager / Superior (Col T / N°20 / col_19)
    let manager = e.manager || obtenerValorCampo(e, [
        'col_19', 'nombre del mánager', 'nombre del manager', 'nombredelmanager', 'manager', 'superior', 'superiordirecto', 'responsable', 'liderdearea'
    ]);

    // 9. Email / Correo electrónico principal (Col AL / N°38 / col_37)
    let email = e.email || obtenerValorCampo(e, [
        'col_37', 'correo electrónico principal', 'correo electronico principal', 'correoelectronicoprincipal', 'email', 'correo', 'mail', 'emailaddress', 'correoelectronico', 'contacto'
    ]);

    // Asignar a inputs si existen en el DOM
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('apellido', apellido);
    setVal('nombreEmpleado', nombre);
    setVal('puesto', puesto);
    setVal('categoria', categoria);
    setVal('direccion', direccion);
    setVal('gerencia', gerencia);
    setVal('coordinacion', coordinacion);
    setVal('jefatura', jefatura);
    setVal('manager', manager);
    setVal('email', email);
}

function limpiarCamposDotacion(limpiarLegajo = true) {
    if (limpiarLegajo) {
        const inputLegajo = document.getElementById('legajo');
        if (inputLegajo) {
            inputLegajo.value = '';
            inputLegajo.focus();
        }
    }

    const campos = ['apellido', 'nombreEmpleado', 'puesto', 'categoria', 'direccion', 'gerencia', 'coordinacion', 'jefatura', 'manager', 'email'];
    campos.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
}

window.ejecutarBusquedaLegajo = ejecutarBusquedaLegajo;
window.limpiarCamposDotacion = limpiarCamposDotacion;
window.actualizarFechaDotacionUI = actualizarFechaDotacionUI;
