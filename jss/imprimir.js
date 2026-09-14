// ===================================================
// SIGA_APP - IMPRESIÓN DE PLANILLA A4 DE ASISTENCIA
// ===================================================

function prepararYAbrirPlanillaA4() {
    try {
        let idCap = document.getElementById('idcap')?.value || 
                    document.getElementById('resumenIdCap')?.value || 
                    document.getElementById('idCap')?.value || 
                    document.getElementById('id_cap')?.value || '';

        let cap = null;

        // 1. Buscar en dbLocal
        if (idCap && window.dbLocal && window.dbLocal.raw) {
            const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
            cap = caps.find(c => String(c.id_cap).trim() === String(idCap).trim());
        }

        // 2. Si no se encontró por ID o no hay ID, buscar en capacitacion_activa
        if (!cap) {
            try {
                const act = JSON.parse(localStorage.getItem('capacitacion_activa') || '{}');
                if (act && (act.id_cap || act.nombre_curso)) {
                    cap = act;
                    if (!idCap && cap.id_cap) idCap = cap.id_cap;
                }
            } catch (e) {}
        }

        // 3. Fallback de búsqueda general si aún no se tiene cap
        if (!cap && window.dbLocal && window.dbLocal.raw) {
            const caps = window.dbLocal.raw.leerTabla('capacitaciones') || [];
            if (caps.length > 0) cap = caps[caps.length - 1];
        }

        cap = cap || {};

        const cActual = cap.clase_nro || document.getElementById('clase')?.value || '1';
        const cTotal = cap.total_clases || '1';
        const cursoNombre = cap.nombre_curso || cap.curso || document.getElementById('curso')?.value || 'Capacitación General';
        const cursoCompleto = `${cursoNombre} (Clase Nº ${cActual} de ${cTotal})`;

        // Horario formateado
        let horarioStr = '-';
        if (cap.hs_inicio && cap.hs_fin) {
            horarioStr = `${cap.hs_inicio} a ${cap.hs_fin}`;
        } else if (cap.hs_inicio) {
            horarioStr = `${cap.hs_inicio}`;
        } else if (cap.horario && cap.horario !== '-') {
            horarioStr = cap.horario;
        } else if (cap.duracion || cap.duracion_horas) {
            horarioStr = `${cap.duracion || cap.duracion_horas} hs`;
        }

        // Fecha formateada
        let fechaFormateada = cap.fecha || document.getElementById('fecha')?.value || '';
        if (window.formatearFecha && fechaFormateada) {
            fechaFormateada = window.formatearFecha(fechaFormateada);
        } else if (fechaFormateada && fechaFormateada.includes('-') && fechaFormateada.split('-').length === 3) {
            const [y, m, d] = fechaFormateada.split('-');
            if (y.length === 4) fechaFormateada = `${d}/${m}/${y}`;
        }
        if (!fechaFormateada || fechaFormateada === '-') {
            fechaFormateada = new Date().toLocaleDateString('es-AR');
        }

        const capacitadorNombre = [cap.instructor_1, cap.instructor_2, cap.instructor, cap.capacitador].filter(Boolean).join(', ') || 
                                  document.getElementById('instructor')?.value || '-';

        const temaReal = cap.tema || cap.temas || cap.descripcion || '-';
        const lugarReal = cap.lugar || 'Planta General';

        const datosCapacitacion = {
            id_cap: idCap || cap.id_cap || '-',
            fecha: fechaFormateada,
            horario: horarioStr,
            programa: cap.programa || cursoNombre,
            curso: cursoCompleto,
            modulo: `Clase Nº ${cActual}`,
            temas: temaReal,
            capacitador: capacitadorNombre,
            lugar: lugarReal,
            modalidad: cap.modalidad || 'Presencial'
        };

        const asistentes = [];
        const filas = document.querySelectorAll('#tablaAsistentes tr');

        filas.forEach(fila => {
            const c = fila.children;
            if (c.length >= 3 && !fila.textContent.includes('No hay participantes') && !fila.textContent.includes('Cargando')) {
                asistentes.push({
                    legajo: c[0]?.textContent?.trim() || '',
                    apellido: c[1]?.textContent?.trim() || '',
                    nombre: c[2]?.textContent?.trim() || '',
                    sector: '',
                    linea: ''
                });
            }
        });

        // Si la tabla no tenía filas en el DOM, buscar de dbLocal
        if (asistentes.length === 0 && idCap && window.dbLocal && window.dbLocal.raw) {
            const asisBD = window.dbLocal.raw.leerTabla('asistentes') || [];
            const filtrados = asisBD.filter(a => String(a.id_cap).trim() === String(idCap).trim());
            filtrados.forEach(a => {
                asistentes.push({
                    legajo: a.legajo || '',
                    apellido: a.apellido || '',
                    nombre: a.nombre || '',
                    sector: '',
                    linea: ''
                });
            });
        }

        localStorage.setItem('siga_impresion_cabecera', JSON.stringify(datosCapacitacion));
        localStorage.setItem('siga_impresion_asistentes', JSON.stringify(asistentes));

        const paramId = encodeURIComponent(datosCapacitacion.id_cap);
        window.open(`planilla_asistencia.html?id_cap=${paramId}`, '_blank');
    } catch (error) {
        console.error('Error al preparar planilla A4:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Evento Botón Imprimir Directo
    const btnImprimir = document.getElementById('btnImprimir');
    if (btnImprimir) {
        btnImprimir.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            prepararYAbrirPlanillaA4();
        });
    }

    // 2. Eventos del Modal post-guardado
    const btnModalImprimir = document.getElementById('btnModalImprimir');
    const btnModalFinalizar = document.getElementById('btnModalFinalizar');

    if (btnModalImprimir) {
        btnModalImprimir.addEventListener('click', () => {
            prepararYAbrirPlanillaA4();
            window.location.href = 'actividades.html';
        });
    }

    if (btnModalFinalizar) {
        btnModalFinalizar.addEventListener('click', () => {
            window.location.href = 'actividades.html';
        });
    }
});
