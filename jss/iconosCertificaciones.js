/* ===================================================
   SIGA-AP - DICCIONARIO DE ÍCONOS VECTORIALES TÉCNICOS
   =================================================== */

window.SVG_ICONOS_CERTIFICACIONES = window.SVG_ICONOS_CERTIFICACIONES || {};

Object.assign(window.SVG_ICONOS_CERTIFICACIONES, {
    // 1. Soldadura SMAW (Pinza portaelectrodo con electrodo, arco eléctrico de soldadura, chapa metálica con cordón y cable)
    "smaw": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Pieza / Chapa a soldar -->
            <rect x="6" y="26" width="22" height="32" rx="3" fill="#E2E8F0" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M6 42H28" stroke="#94A3B8" stroke-width="2" stroke-dasharray="2 2"/>
            <!-- Cordón de soldadura con escamas -->
            <path d="M17 26V58" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
            <path d="M14 30C16 32 18 32 20 30" stroke="#B45309" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M14 36C16 38 18 38 20 36" stroke="#B45309" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M14 42C16 44 18 44 20 42" stroke="#B45309" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M14 48C16 50 18 50 20 48" stroke="#B45309" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M14 54C16 56 18 56 20 54" stroke="#B45309" stroke-width="1.5" stroke-linecap="round"/>
            <!-- Chispas / Destello de arco eléctrico -->
            <path d="M17 26L10 20M17 26L11 27M17 26L13 18M17 26L21 19" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
            <circle cx="17" cy="26" r="3.5" fill="#FDE047" stroke="#EA580C" stroke-width="1.5"/>
            <!-- Electrodo (Varilla) -->
            <line x1="17" y1="26" x2="36" y2="18" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
            <!-- Pinza Portaelectrodo con cabezal y mordaza -->
            <path d="M34 14L41 11L45 20L38 23L34 14Z" fill="#F97316" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M38 17L33 19" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Mango de la pinza -->
            <rect x="42" y="14" width="14" height="9" rx="2" transform="rotate(25 42 14)" fill="#334155" stroke="#1E293B" stroke-width="2.5"/>
            <!-- Mano / Guante del operador -->
            <path d="M43 7C43 4.5 45.5 3 48 3C50.5 3 53 4.5 53 7V17L44 21L40 16" fill="#FEF08A" stroke="#1E293B" stroke-width="2" stroke-linejoin="round"/>
            <path d="M45 7V13M48 6V13M51 7V14" stroke="#CA8A04" stroke-width="1.2" stroke-linecap="round"/>
            <!-- Cable de soldadura curvado -->
            <path d="M52 23C56 26 59 31 56 36C53 41 58 46 60 50C61 52 61 56 58 58" stroke="#475569" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>
    `,

    // 2. Soldadura Aluminotérmica (Crisol de colada térmico, molde de unión, riel ferroviario y flujo fundido incandescente)
    "aluminotermica": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Riel Ferroviario Perfil I / Vignole (Lado Izquierdo) -->
            <path d="M4 42H22M8 42V52H5V58H25V52H22V42" stroke="#334155" stroke-width="2.5" stroke-linejoin="round" fill="#CBD5E1"/>
            <!-- Riel Ferroviario (Lado Derecho) -->
            <path d="M42 42H60M42 42V52H39V58H59V52H56V42" stroke="#334155" stroke-width="2.5" stroke-linejoin="round" fill="#CBD5E1"/>
            <!-- Molde refractario en la unión del riel -->
            <rect x="23" y="34" width="18" height="25" rx="3" fill="#64748B" stroke="#1E293B" stroke-width="2.5"/>
            <!-- Canal de colada del molde -->
            <path d="M29 34V46C29 49 35 49 35 46V34" fill="#EA580C" stroke="#C2410C" stroke-width="1.5"/>
            <!-- Crisol de Fundición Superior -->
            <path d="M20 7H44L39 23H25L20 7Z" fill="#94A3B8" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round"/>
            <!-- Acero fundido / Porción líquida incandescente en el crisol -->
            <path d="M22 10H42L38 20H26L22 10Z" fill="#F97316"/>
            <ellipse cx="32" cy="10" rx="10" ry="2.5" fill="#FDE047"/>
            <!-- Chorro de colada / Acero líquido vertiendo al molde -->
            <path d="M30 23H34V35H30V23Z" fill="#F97316" stroke="#C2410C" stroke-width="1.5"/>
            <!-- Reacción química térmica / Chispas y calor -->
            <circle cx="21" cy="4" r="1.5" fill="#EF4444"/>
            <circle cx="43" cy="5" r="1.5" fill="#EF4444"/>
            <path d="M32 3V0M28 2L26 0M36 2L38 0" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
            <!-- Símbolo Al / Termita -->
            <circle cx="53" cy="17" r="8" fill="#F8FAFC" stroke="#1E293B" stroke-width="1.8"/>
            <text x="53" y="21" font-size="8" font-family="'Segoe UI', sans-serif" font-weight="900" fill="#0F172A" text-anchor="middle">AL</text>
        </svg>
    `,

    // 3. Hidrogrúa (Grúa móvil montada sobre camión / chasis con pluma telescópica inclinada, estabilizadores y gancho)
    "hidrogrua": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Chasis / Base de vehículo -->
            <rect x="8" y="44" width="48" height="6" rx="2" fill="#334155" stroke="#1E293B" stroke-width="2.5"/>
            <!-- Patas estabilizadoras hidráulicas -->
            <path d="M10 50V58M54 50V58M7 58H13M51 58H57" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Ruedas dobles -->
            <circle cx="19" cy="49" r="6.5" fill="#64748B" stroke="#1E293B" stroke-width="2.5"/>
            <circle cx="19" cy="49" r="2.5" fill="#0F172A"/>
            <circle cx="43" cy="49" r="6.5" fill="#64748B" stroke="#1E293B" stroke-width="2.5"/>
            <circle cx="43" cy="49" r="2.5" fill="#0F172A"/>
            <!-- Cabina del operador -->
            <path d="M34 44V34H45L51 40V44H34Z" fill="#FACC15" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round"/>
            <polygon points="43,36 49,40 43,40" fill="#67E8F9" stroke="#0891B2" stroke-width="1.5"/>
            <!-- Torre de giro / Base de pluma -->
            <rect x="13" y="36" width="16" height="8" rx="2" fill="#EAB308" stroke="#1E293B" stroke-width="2.5"/>
            <!-- Brazo telescópico principal inclinado -->
            <path d="M17 38L45 11" stroke="#EAB308" stroke-width="8" stroke-linecap="round"/>
            <path d="M17 38L45 11" stroke="#1E293B" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 7"/>
            <!-- Sección telescópica extendida -->
            <path d="M43 13L51 5" stroke="#CA8A04" stroke-width="5" stroke-linecap="round"/>
            <path d="M17 38L45 11L51 5" stroke="#1E293B" stroke-width="2" fill="none"/>
            <!-- Polea y cable de izaje -->
            <circle cx="51" cy="5" r="2.5" fill="#334155" stroke="#1E293B" stroke-width="1.5"/>
            <path d="M51 7V17" stroke="#1E293B" stroke-width="2"/>
            <!-- Gancho de izaje de carga -->
            <path d="M48 17H54M51 17V21C51 25 45 25 45 21" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </svg>
    `,

    // 4. Puente Grúa (Estructura pórtico con columnas rayadas amarillas y negras, viga carrilera, carro con cable ondulado, gancho e izaje de carga)
    "puente_grua": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Viga Superior Principal / Puente -->
            <rect x="5" y="6" width="54" height="8" rx="2" fill="#334155" stroke="#1E293B" stroke-width="2.5"/>
            <!-- Columna Izquierda con bandas de seguridad industrial -->
            <rect x="10" y="14" width="9" height="42" fill="#FACC15" stroke="#1E293B" stroke-width="2.5"/>
            <path d="M10 20L19 26M10 30L19 36M10 40L19 46M10 50L19 56" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Base Columna Izquierda -->
            <rect x="6" y="55" width="17" height="5" rx="1.5" fill="#1E293B"/>
            
            <!-- Columna Derecha con bandas de seguridad industrial -->
            <rect x="45" y="14" width="9" height="42" fill="#FACC15" stroke="#1E293B" stroke-width="2.5"/>
            <path d="M45 20L54 26M45 30L54 36M45 40L54 46M45 50L54 56" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Base Columna Derecha -->
            <rect x="41" y="55" width="17" height="5" rx="1.5" fill="#1E293B"/>

            <!-- Carro de traslación / Polipasto -->
            <rect x="27" y="9" width="12" height="10" rx="2" fill="#E2E8F0" stroke="#1E293B" stroke-width="2"/>
            <!-- Cable de alimentación festoon ondulado -->
            <path d="M21 14C23 9 26 18 29 14M38 14C41 9 44 19 47 14" stroke="#EAB308" stroke-width="2" stroke-linecap="round" fill="none"/>
            <!-- Mando colgante / Botonera con cable -->
            <path d="M21 14V23" stroke="#1E293B" stroke-width="1.5"/>
            <rect x="18" y="23" width="6" height="10" rx="1.5" fill="#1E293B"/>
            <circle cx="21" cy="26" r="1" fill="#EF4444"/>
            <circle cx="21" cy="30" r="1" fill="#22C55E"/>

            <!-- Gancho de izaje central -->
            <path d="M33 19V25C33 28 37 28 37 25C37 23 34 22 34 20" stroke="#EAB308" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <!-- Carga suspendida (Contenedor / Bloque izado) -->
            <path d="M33 27L29 33M33 27L37 33" stroke="#EF4444" stroke-width="1.5"/>
            <rect x="25" y="33" width="16" height="9" rx="1.5" fill="#38BDF8" stroke="#0284C7" stroke-width="2"/>
            <line x1="30" y1="35" x2="30" y2="40" stroke="#0284C7" stroke-width="1.5"/>
            <line x1="33" y1="35" x2="33" y2="40" stroke="#0284C7" stroke-width="1.5"/>
            <line x1="36" y1="35" x2="36" y2="40" stroke="#0284C7" stroke-width="1.5"/>
        </svg>
    `,

    // 5. Familia: END (Ensayos No Destructivos)
    "end": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="10" width="48" height="44" rx="6" fill="#1E293B" stroke="#0EA5E9" stroke-width="2.5"/>
            <path d="M14 32H22L26 20L32 44L38 28L42 32H50" stroke="#38BDF8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="32" cy="44" r="3" fill="#F43F5E"/>
            <circle cx="48" cy="16" r="4" fill="#22C55E"/>
            <path d="M46 16L47.5 17.5L50 15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,

    // 6. Familia: Soldadores
    "soldadores": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="16" y="8" width="32" height="38" rx="10" fill="#1E293B" stroke="#F97316" stroke-width="2.5"/>
            <rect x="22" y="18" width="20" height="12" rx="3" fill="#0284C7" stroke="#38BDF8" stroke-width="1.5"/>
            <path d="M25 21L39 27" stroke="#E0F2FE" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12 46C12 40 20 38 32 38C44 38 52 40 52 46V58H12V46Z" fill="#334155" stroke="#1E293B" stroke-width="2.5"/>
            <circle cx="48" cy="44" r="3" fill="#FDE047"/>
            <path d="M48 44L56 40M48 44L54 48M48 44L50 36" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `,

    // 7. Familia: Equipos de Izaje
    "equipos_izaje": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 56L26 10H38L56 56" stroke="#1E293B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 42H50M20 28H44" stroke="#EAB308" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M32 10V32" stroke="#1E293B" stroke-width="2.5"/>
            <circle cx="32" cy="34" r="3" fill="#334155"/>
            <path d="M29 37H35M32 37V42C32 46 27 46 27 42" stroke="#EAB308" stroke-width="3" stroke-linecap="round" fill="none"/>
            <rect x="22" y="47" width="20" height="11" rx="2" fill="#0284C7" stroke="#1E293B" stroke-width="2"/>
        </svg>
    `,

    // 8. Especialidad: Ultrasonido (UT)
    "ultrasonido": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="10" width="48" height="34" rx="4" fill="#0F172A" stroke="#38BDF8" stroke-width="2"/>
            <path d="M12 27H20L24 16L28 38L34 22L38 32L42 27H52" stroke="#22C55E" stroke-width="2" stroke-linecap="round"/>
            <!-- Palpador ultrasónico -->
            <rect x="24" y="48" width="16" height="10" rx="2" fill="#F59E0B" stroke="#1E293B" stroke-width="2"/>
            <line x1="32" y1="44" x2="32" y2="48" stroke="#64748B" stroke-width="2"/>
            <!-- Ondas sonoras hacia la pieza -->
            <path d="M26 60C30 58 34 58 38 60" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `,

    // 9. Especialidad: Líquidos Penetrantes (LP)
    "liquidos_penetrantes": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Bloque de metal con fisura -->
            <rect x="8" y="32" width="48" height="24" rx="3" fill="#CBD5E1" stroke="#1E293B" stroke-width="2.5"/>
            <path d="M28 32L30 42L34 40L33 46" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Aerosol / Aplicador -->
            <rect x="20" y="8" width="16" height="18" rx="2" fill="#E11D48" stroke="#1E293B" stroke-width="2"/>
            <rect x="25" y="4" width="6" height="4" fill="#1E293B"/>
            <path d="M38 18L48 24M40 14L52 18M38 10L49 11" stroke="#FB7185" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
    `,

    // 10. Especialidad: Partículas Magnetizables (PM)
    "particulas_magnetizables": `
        <svg class="cert-icono-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Yugo electromagnético (Imán en herradura) -->
            <path d="M14 16V34C14 44 50 44 50 34V16" stroke="#DC2626" stroke-width="8" stroke-linecap="square"/>
            <rect x="10" y="12" width="8" height="8" fill="#E2E8F0" stroke="#1E293B" stroke-width="2"/>
            <rect x="46" y="12" width="8" height="8" fill="#E2E8F0" stroke="#1E293B" stroke-width="2"/>
            <text x="14" y="18" font-size="7" font-weight="900" fill="#1E293B">N</text>
            <text x="50" y="18" font-size="7" font-weight="900" fill="#1E293B">S</text>
            <!-- Líneas de flujo magnético y partículas -->
            <path d="M18 16C24 10 40 10 46 16" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="2 2"/>
            <path d="M18 22C25 18 39 18 46 22" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="2 2"/>
            <circle cx="28" cy="14" r="1.5" fill="#1E293B"/>
            <circle cx="36" cy="14" r="1.5" fill="#1E293B"/>
            <circle cx="32" cy="18" r="1.5" fill="#1E293B"/>
        </svg>
    `
});
