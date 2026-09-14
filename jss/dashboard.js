// ===================================================
// SIGA-AP - LÓGICA DASHBOARD & RESUMEN DE LA SEMANA
// ===================================================

document.addEventListener("DOMContentLoaded", () => {
    actualizarSaludoYFecha();
    cargarResumenSemana();
});

function obtenerDB() {
    return window.supabaseClient || window.supabase || null;
}

// 1. Manejo de saludo según horario y fecha en español
function actualizarSaludoYFecha() {
    const elSaludo = document.getElementById("saludo");
    const elFecha = document.getElementById("fecha");

    const ahora = new Date();
    const hora = ahora.getHours();

    let saludoTxt = "Buenas noches";
    let icono = "🌙";

    if (hora >= 6 && hora < 12) {
        saludoTxt = "Buenos días";
        icono = "☀️";
    } else if (hora >= 12 && hora < 20) {
        saludoTxt = "Buenas tardes";
        icono = "🌤️";
    }

    // Obtener nombre del usuario en sesión
    let nombreParaSaludo = "Usuario";
    try {
        const sesion = JSON.parse(localStorage.getItem('siga_usuario_activo') || '{}');
        const nombreCompleto = sesion.nombre || sesion.usuario || localStorage.getItem('usuario') || "Usuario";
        // Tomar el primer nombre para el saludo (ej: "Juan Pérez" -> "Juan", "Admin" -> "Admin")
        nombreParaSaludo = nombreCompleto.trim().split(" ")[0] || nombreCompleto;
    } catch (e) {}

    if (elSaludo) {
        elSaludo.innerHTML = `${icono} ${saludoTxt}, ${nombreParaSaludo}`;
    }

    if (elFecha) {
        const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const fechaFormateada = ahora.toLocaleDateString('es-ES', opciones);
        elFecha.textContent = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
    }
}

// 2. Consulta y desglose de actividades de la semana activa
async function cargarResumenSemana() {
    const contenedor = document.getElementById("actividadSemana");
    if (!contenedor) return;

    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0: Dom, 1: Lun, ...
    
    // Calcular Lunes y Domingo de la semana en curso
    const diffLunes = ahora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const lunes = new Date(ahora.setDate(diffLunes));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    const fechaInicioStr = lunes.toISOString().split("T")[0];
    const fechaFinStr = domingo.toISOString().split("T")[0];

    const db = obtenerDB();
    
    if (!db) {
        contenedor.textContent = "No hay conexión con la base de datos.";
        return;
    }

    try {
        const { data, error } = await db
            .from("capacitaciones")
            .select("*")
            .gte("fecha", fechaInicioStr)
            .lte("fecha", fechaFinStr);

        if (error) {
            console.error("Error al consultar resumen semanal:", error);
            contenedor.textContent = "Error al obtener las actividades de la semana.";
            return;
        }

        if (!data || data.length === 0) {
            contenedor.innerHTML = `<span style="color:#64748b; font-weight:500;">📅 Sin actividades programadas para esta semana.</span>`;
            return;
        }

        // Contadores por estado
        let programadas = 0;
        let enCurso = 0;
        let finalizadas = 0;

        data.forEach(item => {
            const estado = item.estado ? item.estado.toLowerCase() : "";
            if (estado.includes("programad")) programadas++;
            else if (estado.includes("curso")) enCurso++;
            else if (estado.includes("finaliz")) finalizadas++;
            else programadas++;
        });

        const total = data.length;

        // Renderizado con insignias de colores acordes a la Agenda
        contenedor.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap; font-size:14px; padding:4px 0;">
                <span style="font-weight:bold; color:#1e293b;">Total semana (${total}):</span>
                
                <span style="background-color:#d97706; color:#fff; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">
                    🟠 ${programadas} Programada${programadas !== 1 ? 's' : ''}
                </span>

                <span style="background-color:#0284c7; color:#fff; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">
                    🔵 ${enCurso} En curso
                </span>

                <span style="background-color:#16a34a; color:#fff; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">
                    🟢 ${finalizadas} Finalizada${finalizadas !== 1 ? 's' : ''}
                </span>
            </div>
        `;

    } catch (err) {
        console.error("Error inesperado:", err);
        contenedor.textContent = "No se pudo cargar el resumen de la semana.";
    }
}