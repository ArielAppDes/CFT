// ===================================================================
// SIGA-AP - CONTROL DE ACCESO, SESIÓN Y ROLES (RBAC)
// ===================================================================

(function verificarSesionYPermisos() {
    const rawSesion = localStorage.getItem('siga_usuario_activo');
    let sesion = null;
    try {
        sesion = rawSesion ? JSON.parse(rawSesion) : null;
    } catch (e) {
        sesion = null;
    }

    const pathActual = window.location.pathname.split("/").pop() || "index.html";
    const esLogin = pathActual === "index.html" || pathActual === "";

    // 1. SI NO HAY SESIÓN ACTIVA
    if (!sesion || !sesion.usuario) {
        if (!esLogin) {
            window.location.href = "index.html";
            return;
        }
        return; // Permitir estar en index.html
    }

    // 2. SI YA HAY SESIÓN Y ESTÁ EN LOGIN -> REDIRIGIR AL DASHBOARD
    if (sesion && esLogin) {
        window.location.href = "dashboard.html";
        return;
    }

    // 3. VALIDACIÓN DE PERMISOS POR ROL
    const rol = (sesion.rol || 'Administrador').trim();

    // Reglas de acceso por página:
    // - Administrador: Acceso total
    // - Operador: Todo excepto administracion.html
    // - Reportes: Solo dashboard.html, reportes.html, agenda.html, certificaciones.html, normativas.html
    if (rol === 'Operador') {
        if (pathActual === 'administracion.html') {
            alert('Acceso restringido: Su usuario tiene rol Operador y no posee permisos de Administración.');
            window.location.href = 'dashboard.html';
            return;
        }
    } else if (rol === 'Reportes') {
        const paginasBloqueadasParaReportes = ['administracion.html', 'capacitaciones.html', 'asistentes.html', 'actividades.html', 'encuesta.html', 'transferencia.html'];
        if (paginasBloqueadasParaReportes.includes(pathActual)) {
            alert('Acceso restringido: Su usuario tiene rol de Solo Reportes y no puede modificar registros de capacitación.');
            window.location.href = 'reportes.html';
            return;
        }
    }

    // 4. ADAPTACIÓN VISUAL DEL MENÚ Y CABECERA SEGÚN EL ROL
    window.addEventListener('DOMContentLoaded', () => {
        aplicarUIsegunRol(sesion);
    });

    // También ejecutar inmediatamente si el DOM ya está listo
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        aplicarUIsegunRol(sesion);
    }
})();

function aplicarUIsegunRol(sesion) {
    if (!sesion) return;
    const rol = (sesion.rol || 'Administrador').trim();

    // 1. Actualizar etiqueta de usuario en la cabecera
    const elementosUsuario = document.querySelectorAll('.usuario, #nombreUsuarioHeader, .user-badge');
    elementosUsuario.forEach(elem => {
        elem.innerHTML = `👤 <strong>${sesion.nombre || sesion.usuario}</strong> <span style="font-size: 0.8rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; margin-left: 6px; font-weight: normal;">${rol}</span>`;
    });

    // 2. Ocultar o deshabilitar elementos según rol
    const enlacesNav = document.querySelectorAll('aside.sidebar nav a, .nav-item a');
    enlacesNav.forEach(enlace => {
        const href = enlace.getAttribute('href') || '';

        // Bloquear Administración para no-admins
        if (href.includes('administracion.html') && rol !== 'Administrador') {
            enlace.style.display = 'none';
        }

        // Bloquear Actividades para rol Reportes
        if (href.includes('actividades.html') && rol === 'Reportes') {
            enlace.style.display = 'none';
        }

        // Configurar botón Salir
        if (href.includes('index.html') || enlace.textContent.includes('Salir')) {
            enlace.addEventListener('click', (e) => {
                e.preventDefault();
                cerrarSesion();
            });
        }
    });

    // 3. En el Dashboard, ocultar tarjetas no permitidas
    if (window.location.pathname.includes('dashboard.html')) {
        const cardAdmin = document.querySelector('.card[onclick*="administracion"]');
        if (cardAdmin && rol !== 'Administrador') {
            cardAdmin.style.display = 'none';
        }

        const cardActividades = document.querySelector('.card[onclick*="actividades"]');
        if (cardActividades && rol === 'Reportes') {
            cardActividades.style.display = 'none';
        }
    }
}

// Función global para cerrar sesión
window.cerrarSesion = function () {
    if (confirm('¿Desea cerrar la sesión de ' + (JSON.parse(localStorage.getItem('siga_usuario_activo') || '{}').nombre || 'usuario') + '?')) {
        localStorage.removeItem('siga_usuario_activo');
        localStorage.removeItem('usuario');
        localStorage.removeItem('rol');
        window.location.href = 'index.html';
    }
};
