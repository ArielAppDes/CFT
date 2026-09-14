// ===================================================================
// SIGA-AP - CONTROLADOR DE INICIO DE SESIÓN RESILIENTE
// ===================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Si viene con parámetro ?logout=true o al cargar el login, limpiar posible sesión previa conflictiva si el usuario lo desea
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("logout") === "true") {
        localStorage.removeItem("siga_usuario_activo");
    }

    const form = document.getElementById("formLogin");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            procesarLogin();
        });
    }
});

function rellenarCredenciales(user, pass) {
    const inputUsuario = document.getElementById("usuario");
    const inputClave = document.getElementById("clave");
    if (inputUsuario) inputUsuario.value = user;
    if (inputClave) inputClave.value = pass;
    const divError = document.getElementById("mensajeError");
    if (divError) divError.style.display = "none";
}

function alternarVisibilidadClave() {
    const inputClave = document.getElementById("clave");
    const icono = document.getElementById("iconoVerClave");
    if (!inputClave) return;
    if (inputClave.type === "password") {
        inputClave.type = "text";
        if (icono) icono.textContent = "🙈";
    } else {
        inputClave.type = "password";
        if (icono) icono.textContent = "👁️";
    }
}

async function procesarLogin() {
    const inputUsuario = document.getElementById("usuario");
    const inputClave = document.getElementById("clave");
    const divError = document.getElementById("mensajeError");
    const btnIngresar = document.getElementById("btnIngresar");

    const usuarioIngresado = (inputUsuario?.value || "").trim();
    const claveIngresada = (inputClave?.value || "").trim();

    if (!usuarioIngresado || !claveIngresada) {
        mostrarError("Por favor ingrese su nombre de usuario y contraseña.");
        return;
    }

    if (btnIngresar) {
        btnIngresar.disabled = true;
        btnIngresar.textContent = "Verificando acceso...";
    }

    if (divError) divError.style.display = "none";

    try {
        let usuarioValido = null;

        // 1. Verificación prioritaria del usuario maestro 'Admin' con clave 'CFT2026' (insensible a mayúsculas en clave/usuario para máxima facilidad)
        if (usuarioIngresado.toLowerCase() === "admin" && claveIngresada.toUpperCase() === "CFT2026") {
            usuarioValido = {
                id: 1,
                usuario: "Admin",
                clave: "CFT2026",
                nombre: "Ariel Pizzutto",
                email: "ariel.pizzutto@alumnos.udemm.edu.ar",
                rol: "Administrador",
                estado: "Activo"
            };
        }

        // 2. Si no es el maestro o para validar contra la base de datos de usuarios
        if (!usuarioValido) {
            const db = window.supabaseClient || window.supabase || window.dbLocal;
            let usuarios = [];

            if (db) {
                try {
                    const res = await db.from('profiles').select('*');
                    if (res && res.data && Array.isArray(res.data)) {
                        usuarios = res.data;
                    }
                } catch (e) {
                    console.warn("Error consultando profiles:", e);
                }
            }

            // Si está vacío, consultar localStorage directo
            if (usuarios.length === 0) {
                try {
                    const raw = localStorage.getItem("SIGA_DB_profiles");
                    if (raw) usuarios = JSON.parse(raw);
                } catch (e) {}
            }

            // Si aún no hay usuarios en la base, usar el listado predeterminado
            if (!usuarios || usuarios.length === 0) {
                usuarios = [
                    { id: 1, usuario: "Admin", clave: "CFT2026", nombre: "Ariel Pizzutto", email: "ariel.pizzutto@alumnos.udemm.edu.ar", rol: "Administrador", estado: "Activo" },
                    { id: 2, usuario: "Operador", clave: "CFT2026", nombre: "Operador Capacitación", email: "capacitacion@empresa.com", rol: "Operador", estado: "Activo" },
                    { id: 3, usuario: "Auditor", clave: "CFT2026", nombre: "Consulta Reportes", email: "reportes@empresa.com", rol: "Reportes", estado: "Activo" }
                ];
            }

            // Buscar usuario coincidente (insensible a mayúsculas/minúsculas)
            const encontrado = usuarios.find(u => 
                (u.usuario || "").trim().toLowerCase() === usuarioIngresado.toLowerCase()
            );

            if (encontrado) {
                const claveGuardada = (encontrado.clave || "").trim();
                // Validar contraseña
                if (claveGuardada === claveIngresada || claveGuardada.toUpperCase() === claveIngresada.toUpperCase()) {
                    if (encontrado.estado && encontrado.estado.toLowerCase() === "inactivo") {
                        mostrarError("El usuario se encuentra inactivo. Comuníquese con el Administrador.");
                        return;
                    }
                    usuarioValido = encontrado;
                }
            }
        }

        if (!usuarioValido) {
            mostrarError("Usuario o contraseña incorrectos. Verifique mayúsculas y minúsculas.");
            return;
        }

        // 3. Crear sesión activa
        const sesion = {
            id: usuarioValido.id || 1,
            usuario: usuarioValido.usuario || "Admin",
            nombre: usuarioValido.nombre || usuarioValido.usuario || "Administrador",
            email: usuarioValido.email || "",
            rol: usuarioValido.rol || "Administrador",
            fechaIngreso: new Date().toISOString()
        };

        localStorage.setItem("siga_usuario_activo", JSON.stringify(sesion));
        localStorage.setItem("usuario", sesion.nombre);
        localStorage.setItem("rol", sesion.rol);

        // Asegurar que la tabla profiles local tenga al menos al Admin guardado
        try {
            const db = window.supabaseClient || window.supabase || window.dbLocal;
            if (db) {
                await db.from('profiles').upsert({
                    usuario: sesion.usuario,
                    clave: "CFT2026",
                    nombre: sesion.nombre,
                    email: sesion.email,
                    rol: sesion.rol,
                    estado: "Activo"
                }, { onConflict: 'usuario' });
            }
        } catch (e) {
            console.warn("No se pudo persistir perfil en login:", e);
        }

        // 4. Redirigir según el rol del usuario
        if (sesion.rol === "Reportes") {
            window.location.href = "reportes.html";
        } else {
            window.location.href = "dashboard.html";
        }

    } catch (err) {
        console.error("Error inesperado en login:", err);
        mostrarError("Ocurrió un error al procesar el ingreso. Intente nuevamente.");
    } finally {
        if (btnIngresar) {
            btnIngresar.disabled = false;
            btnIngresar.textContent = "Ingresar al Sistema";
        }
    }
}

function mostrarError(texto) {
    const divError = document.getElementById("mensajeError");
    if (divError) {
        divError.textContent = texto;
        divError.style.display = "block";
    } else {
        alert(texto);
    }
    const inputClave = document.getElementById("clave");
    if (inputClave) {
        inputClave.focus();
    }
}
