document.addEventListener("DOMContentLoaded", async () => {
    await cargarDatosTransferencia();
    configurarEnvioFormulario();
});

function obtenerDB() {
    return window.dbLocal || window.supabaseClient || window.supabase || null;
}

async function cargarDatosTransferencia() {
    const params = new URLSearchParams(window.location.search);
    const idCap = params.get("id_cap");
    const jefaturaParam = params.get("jefatura");

    if (!idCap) {
        return;
    }

    try {
        let cap = null;
        if (window.dbLocal && window.dbLocal.raw) {
            const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
            cap = caps.find(c => String(c.id_cap).trim() === idCap.trim());
        }

        if (!cap && (window.supabaseClient || window.supabase)) {
            const db = window.supabaseClient || window.supabase;
            const { data } = await db.from("capacitaciones").select("nombre_curso, fecha").eq("id_cap", idCap).maybeSingle();
            cap = data;
        }

        if (cap) {
            if (document.getElementById("lblCurso")) document.getElementById("lblCurso").textContent = cap.nombre_curso || idCap;
            if (document.getElementById("lblFecha")) document.getElementById("lblFecha").textContent = cap.fecha || "-";
        }

        let listaAsistentes = [];
        if (window.dbLocal && window.dbLocal.raw) {
            const todos = window.dbLocal.raw.leerTabla('asistentes') || [];
            listaAsistentes = todos.filter(a => String(a.id_cap).trim() === idCap.trim());
        }

        if (listaAsistentes.length === 0 && (window.supabaseClient || window.supabase)) {
            const db = window.supabaseClient || window.supabase;
            let query = db.from("asistentes").select("apellido, nombre, legajo, jefatura").eq("id_cap", idCap);
            if (jefaturaParam) query = query.eq("jefatura", jefaturaParam);
            const { data } = await query;
            if (data) listaAsistentes = data;
        }

        if (jefaturaParam) {
            let dota = [];
            if (window.dbLocal && window.dbLocal.raw) {
                dota = window.dbLocal.raw.leerTabla('dotacion') || [];
            }
            const filtrados = listaAsistentes.filter(a => {
                let j = a.jefatura || a.Jefatura || (a.datos_completos && a.datos_completos.jefatura) || a.manager || '';
                if (!j || j === '-' || j === 'Sin Jefatura Asignada') {
                    const emp = dota.find(d => 
                        String(d.legajo).padStart(5, '0') === String(a.legajo).padStart(5, '0') || 
                        String(d.legajo) === String(a.legajo)
                    );
                    if (emp) {
                        j = emp.jefatura || emp.manager || emp.gerencia || 'Sin Jefatura Asignada';
                    }
                }
                return j.toLowerCase().trim() === jefaturaParam.toLowerCase().trim();
            });
            if (filtrados.length > 0) listaAsistentes = filtrados;
        }

        if (listaAsistentes && listaAsistentes.length > 0) {
            const nombres = listaAsistentes.map(a => `${a.apellido || ''}, ${a.nombre || ''}`.trim() || `Legajo ${a.legajo}`).join(" | ");
            const legajos = listaAsistentes.map(a => String(a.legajo || '-')).join(" | ");

            if (document.getElementById("lblParticipante")) document.getElementById("lblParticipante").textContent = nombres;
            if (document.getElementById("lblLegajo")) document.getElementById("lblLegajo").textContent = legajos;
        } else {
            if (document.getElementById("lblParticipante")) document.getElementById("lblParticipante").textContent = "Sin participantes registrados";
            if (document.getElementById("lblLegajo")) document.getElementById("lblLegajo").textContent = "-";
        }
    } catch (err) {
        console.error("Error al cargar datos:", err);
    }
}

function configurarEnvioFormulario() {
    const form = document.getElementById("formTransferencia");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const params = new URLSearchParams(window.location.search);
        const idCap = params.get("id_cap");
        const jefaturaParam = params.get("jefatura");

        const respuestaAplica = document.getElementById("selectAplica")?.value;
        const nombreEvaluador = document.getElementById("txtEvaluador")?.value;

        if (!respuestaAplica || !nombreEvaluador) {
            alert("Por favor completá todos los campos requeridos.");
            return;
        }

        const db = obtenerDB();
        if (db) {
            try {
                // Registrar respuesta en BD (opcional/según tu tabla de respuestas)
                await db.from("capacitaciones").update({ estado_tra: "Recibida" }).eq("id_cap", idCap);
                alert("¡Evaluación enviada con éxito!");
                window.location.reload();
            } catch (err) {
                console.error("Error al guardar evaluación:", err);
            }
        }
    });
}
