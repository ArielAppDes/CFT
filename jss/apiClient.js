// ===================================================================
// SIGA-AP - CLIENTE CENTRAL DE COMUNICACIÓN CON EL BACKEND (/api/*)
// ===================================================================

(function () {
    const API_BASE = '/api';

    const apiClient = {
        // Obtener token almacenado
        getToken() {
            return localStorage.getItem('siga_token') || '';
        },

        // Guardar sesión y token
        guardarSesion(token, user) {
            if (token) localStorage.setItem('siga_token', token);
            if (user) {
                const sesion = {
                    id: user.id,
                    usuario: user.usuario,
                    nombre: user.nombre || user.usuario,
                    email: user.email || '',
                    rol: user.rol || 'Operador',
                    estado: user.estado || 'Activo',
                    fechaIngreso: new Date().toISOString()
                };
                localStorage.setItem('siga_usuario_activo', JSON.stringify(sesion));
                localStorage.setItem('usuario', sesion.nombre);
                localStorage.setItem('rol', sesion.rol);
            }
        },

        // Limpiar sesión local
        limpiarSesion() {
            localStorage.removeItem('siga_token');
            localStorage.removeItem('siga_usuario_activo');
            localStorage.removeItem('usuario');
            localStorage.removeItem('rol');
        },

        // Obtener usuario en sesión
        getUsuarioActual() {
            try {
                const raw = localStorage.getItem('siga_usuario_activo');
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },

        // Petición genérica al backend con token
        async request(endpoint, opciones = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
            const headers = {
                'Content-Type': 'application/json',
                ...(opciones.headers || {})
            };

            const token = this.getToken();
            if (token && !headers['Authorization']) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const config = {
                ...opciones,
                headers
            };

            if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
                config.body = JSON.stringify(config.body);
            }

            try {
                const res = await fetch(url, config);
                let data = null;
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    data = await res.json();
                } else {
                    data = await res.text();
                }

                if (!res.ok) {
                    const mensaje = (data && data.error) ? data.error : `Error HTTP ${res.status}`;
                    return { ok: false, status: res.status, error: mensaje, data: null };
                }

                return { ok: true, status: res.status, data: data, error: null };
            } catch (err) {
                console.error(`[apiClient] Error de red al solicitar ${endpoint}:`, err);
                return { ok: false, status: 0, error: 'No se pudo conectar con el servidor backend', data: null };
            }
        },

        // Autenticación
        async login(usuario, clave) {
            const resp = await this.request('/auth/login', {
                method: 'POST',
                body: { usuario, clave }
            });

            if (resp.ok && resp.data && resp.data.success) {
                this.guardarSesion(resp.data.token, resp.data.user);
                return { exito: true, user: resp.data.user, token: resp.data.token };
            }

            return { exito: false, mensaje: resp.error || 'Credenciales incorrectas' };
        },

        async verificarSesion() {
            const token = this.getToken();
            if (!token) return { autenticado: false };

            const resp = await this.request('/auth/me', { method: 'GET' });
            if (resp.ok && resp.data && resp.data.authenticated) {
                return { autenticado: true, user: resp.data.user };
            }

            // Solo desloguear si el backend confirmó que el token es inválido o expiró (401 o 403)
            if (resp.status === 401 || resp.status === 403) {
                return { autenticado: false, error: resp.error };
            }

            // Si el backend arrojó 500 o falló la conexión por red, preservar la sesión activa
            return { autenticado: true, offline: true, error: resp.error };
        },

        async logout() {
            try {
                await this.request('/auth/logout', { method: 'POST' });
            } catch {}
            this.limpiarSesion();
            window.location.href = 'index.html';
        },

        async checkHealth() {
            return await this.request('/health', { method: 'GET' });
        },

        // ==========================================
        // SERVICIOS DE NEGOCIO (Fase 2)
        // ==========================================

        // 1. Dotación
        dotacion: {
            async listar(params = {}) {
                const qs = new URLSearchParams(params).toString();
                const res = await apiClient.request(`/dotacion${qs ? `?${qs}` : ''}`);
                return res.ok ? (res.data.data || []) : [];
            },
            async obtener(legajo) {
                const res = await apiClient.request(`/dotacion/${encodeURIComponent(legajo)}`);
                return res.ok ? res.data.data : null;
            },
            async guardar(empleado) {
                return await apiClient.request('/dotacion', { method: 'POST', body: empleado });
            },
            async actualizar(legajo, datos) {
                return await apiClient.request(`/dotacion/${encodeURIComponent(legajo)}`, { method: 'PUT', body: datos });
            },
            async eliminar(legajo) {
                return await apiClient.request(`/dotacion/${encodeURIComponent(legajo)}`, { method: 'DELETE' });
            },
            async importarMasivo(empleados) {
                return await apiClient.request('/dotacion/bulk', { method: 'POST', body: { empleados } });
            }
        },

        // 2. Cursos
        cursos: {
            async listar(params = {}) {
                const qs = new URLSearchParams(params).toString();
                const res = await apiClient.request(`/cursos${qs ? `?${qs}` : ''}`);
                return res.ok ? (res.data.data || []) : [];
            },
            async obtener(codigo) {
                const res = await apiClient.request(`/cursos/${encodeURIComponent(codigo)}`);
                return res.ok ? res.data.data : null;
            },
            async guardar(curso) {
                return await apiClient.request('/cursos', { method: 'POST', body: curso });
            },
            async actualizar(codigo, datos) {
                return await apiClient.request(`/cursos/${encodeURIComponent(codigo)}`, { method: 'PUT', body: datos });
            },
            async eliminar(codigo) {
                return await apiClient.request(`/cursos/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            }
        },

        // 3. Programas
        programas: {
            async listar() {
                const res = await apiClient.request('/programas');
                return res.ok ? (res.data.data || []) : [];
            },
            async guardar(programa) {
                return await apiClient.request('/programas', { method: 'POST', body: programa });
            },
            async actualizar(codigo, datos) {
                return await apiClient.request(`/programas/${encodeURIComponent(codigo)}`, { method: 'PUT', body: datos });
            },
            async eliminar(codigo) {
                return await apiClient.request(`/programas/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            }
        },

        // 4. Instructores
        instructores: {
            async listar() {
                const res = await apiClient.request('/instructores');
                return res.ok ? (res.data.data || []) : [];
            },
            async guardar(instructor) {
                return await apiClient.request('/instructores', { method: 'POST', body: instructor });
            },
            async actualizar(codigo, datos) {
                return await apiClient.request(`/instructores/${encodeURIComponent(codigo)}`, { method: 'PUT', body: datos });
            },
            async eliminar(codigo) {
                return await apiClient.request(`/instructores/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            }
        },

        // 5. Capacitaciones
        capacitaciones: {
            async listar(filtros = {}) {
                const qs = new URLSearchParams(filtros).toString();
                const res = await apiClient.request(`/capacitaciones${qs ? `?${qs}` : ''}`);
                return res.ok ? (res.data.data || []) : [];
            },
            async obtener(id_cap) {
                const res = await apiClient.request(`/capacitaciones/${encodeURIComponent(id_cap)}`);
                return res.ok ? res.data.data : null;
            },
            async guardar(cap) {
                return await apiClient.request('/capacitaciones', { method: 'POST', body: cap });
            },
            async actualizar(id_cap, datos) {
                return await apiClient.request(`/capacitaciones/${encodeURIComponent(id_cap)}`, { method: 'PUT', body: datos });
            },
            async eliminar(id_cap) {
                return await apiClient.request(`/capacitaciones/${encodeURIComponent(id_cap)}`, { method: 'DELETE' });
            }
        },

        // 6. Asistentes
        asistentes: {
            async listar(id_cap) {
                const url = id_cap ? `/asistentes?id_cap=${encodeURIComponent(id_cap)}` : '/asistentes';
                const res = await apiClient.request(url);
                return res.ok ? (res.data.data || []) : [];
            },
            async guardarNomina(id_cap, asistentes) {
                return await apiClient.request('/asistentes/bulk-save', { method: 'POST', body: { id_cap, asistentes } });
            },
            async actualizar(id, datos) {
                return await apiClient.request(`/asistentes/${encodeURIComponent(id)}`, { method: 'PUT', body: datos });
            },
            async eliminar(id) {
                return await apiClient.request(`/asistentes/${encodeURIComponent(id)}`, { method: 'DELETE' });
            }
        },

        // 7. Evaluaciones
        evaluaciones: {
            satisfaccion: {
                async listar(id_cap) {
                    const url = id_cap ? `/evaluaciones/satisfaccion?id_cap=${encodeURIComponent(id_cap)}` : '/evaluaciones/satisfaccion';
                    const res = await apiClient.request(url);
                    return res.ok ? (res.data.data || []) : [];
                },
                async registrar(payload) {
                    return await apiClient.request('/evaluaciones/satisfaccion', { method: 'POST', body: payload });
                }
            },
            transferencia: {
                async listar(id_cap) {
                    const url = id_cap ? `/evaluaciones/transferencia?id_cap=${encodeURIComponent(id_cap)}` : '/evaluaciones/transferencia';
                    const res = await apiClient.request(url);
                    return res.ok ? (res.data.data || []) : [];
                },
                async registrar(payload) {
                    return await apiClient.request('/evaluaciones/transferencia', { method: 'POST', body: payload });
                }
            }
        },

        // 8. Certificaciones
        certificaciones: {
            async listar(params = {}) {
                const qs = new URLSearchParams(params).toString();
                const res = await apiClient.request(`/certificaciones${qs ? `?${qs}` : ''}`);
                return res.ok ? (res.data.data || []) : [];
            },
            async obtener(id) {
                const res = await apiClient.request(`/certificaciones/${encodeURIComponent(id)}`);
                return res.ok ? res.data.data : null;
            },
            async guardar(cert) {
                return await apiClient.request('/certificaciones', { method: 'POST', body: cert });
            },
            async actualizar(id, datos) {
                return await apiClient.request(`/certificaciones/${encodeURIComponent(id)}`, { method: 'PUT', body: datos });
            },
            async eliminar(id) {
                return await apiClient.request(`/certificaciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
            }
        },

        // 9. Proveedores
        proveedores: {
            async listar() {
                const res = await apiClient.request('/proveedores');
                return res.ok ? (res.data.data || []) : [];
            },
            async guardar(prov) {
                return await apiClient.request('/proveedores', { method: 'POST', body: prov });
            },
            async actualizar(codigo, datos) {
                return await apiClient.request(`/proveedores/${encodeURIComponent(codigo)}`, { method: 'PUT', body: datos });
            },
            async eliminar(codigo) {
                return await apiClient.request(`/proveedores/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            }
        },

        // 10. Estadísticas consolidadas
        stats: {
            async dashboard() {
                const res = await apiClient.request('/stats/dashboard');
                return res.ok ? res.data : null;
            }
        },

        // 11. Gestión de Usuarios y Roles (Fase 4)
        usuarios: {
            async listar() {
                const res = await apiClient.request('/usuarios');
                return res.ok ? (res.data.data || []) : [];
            },
            async crear(usuario) {
                return await apiClient.request('/usuarios', { method: 'POST', body: usuario });
            },
            async actualizar(usuario, datos) {
                return await apiClient.request(`/usuarios/${encodeURIComponent(usuario)}`, { method: 'PUT', body: datos });
            },
            async eliminar(usuario) {
                return await apiClient.request(`/usuarios/${encodeURIComponent(usuario)}`, { method: 'DELETE' });
            }
        },

        // ==========================================
        // MOTOR MODO TALLER / OFFLINE (Fase 4)
        // ==========================================
        offline: {
            getCola() {
                try {
                    const raw = localStorage.getItem('siga_offline_queue');
                    return raw ? JSON.parse(raw) : [];
                } catch {
                    return [];
                }
            },
            guardarCola(cola) {
                localStorage.setItem('siga_offline_queue', JSON.stringify(cola));
                this.actualizarInsigniaUI(cola.length);
            },
            encolar(opcion) {
                const cola = this.getCola();
                cola.push({
                    id: 'OFF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    fecha: new Date().toISOString(),
                    ...opcion
                });
                this.guardarCola(cola);
                console.log(`[Modo Offline] Acción guardada en cola local (${cola.length} pendientes).`);
            },
            async procesarCola() {
                const cola = this.getCola();
                if (cola.length === 0) return;

                console.log(`[Modo Offline] Conexión restablecida. Sincronizando ${cola.length} acciones pendientes con la nube...`);
                const pendientesRestantes = [];

                for (const item of cola) {
                    try {
                        const res = await fetch('/api' + item.endpoint, {
                            method: item.method,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiClient.getToken()}`
                            },
                            body: item.body ? JSON.stringify(item.body) : undefined
                        });
                        if (!res.ok && res.status >= 500) {
                            pendientesRestantes.push(item);
                        }
                    } catch {
                        pendientesRestantes.push(item);
                    }
                }

                this.guardarCola(pendientesRestantes);
                if (pendientesRestantes.length === 0) {
                    console.log('[Modo Offline] ¡Todas las operaciones pendientes fueron sincronizadas con éxito en Supabase!');
                }
            },
            actualizarInsigniaUI(pendientes = 0) {
                let badge = document.getElementById('siga-sync-badge');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.id = 'siga-sync-badge';
                    badge.style.position = 'fixed';
                    badge.style.bottom = '12px';
                    badge.style.right = '12px';
                    badge.style.zIndex = '99999';
                    badge.style.fontSize = '12px';
                    badge.style.fontWeight = '600';
                    badge.style.padding = '6px 12px';
                    badge.style.borderRadius = '20px';
                    badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    badge.style.transition = 'all 0.3s ease';
                    document.body.appendChild(badge);
                }

                if (navigator.onLine && pendientes === 0) {
                    badge.style.background = '#dcfce7';
                    badge.style.color = '#15803d';
                    badge.style.border = '1px solid #86efac';
                    badge.innerHTML = '🟢 Conectado a la Nube';
                    setTimeout(() => { if (badge && navigator.onLine) badge.style.opacity = '0.7'; }, 3000);
                } else if (navigator.onLine && pendientes > 0) {
                    badge.style.background = '#fef9c3';
                    badge.style.color = '#a16207';
                    badge.style.border = '1px solid #fde047';
                    badge.style.opacity = '1';
                    badge.innerHTML = `🟡 Sincronizando (${pendientes} pendientes)...`;
                } else {
                    badge.style.background = '#fee2e2';
                    badge.style.color = '#b91c1c';
                    badge.style.border = '1px solid #fca5a5';
                    badge.style.opacity = '1';
                    badge.innerHTML = `🔴 Modo Taller Offline (${pendientes} pendientes)`;
                }
            },
            iniciar() {
                window.addEventListener('online', () => {
                    this.actualizarInsigniaUI(this.getCola().length);
                    this.procesarCola();
                });
                window.addEventListener('offline', () => {
                    this.actualizarInsigniaUI(this.getCola().length);
                });
                setInterval(() => {
                    if (navigator.onLine && this.getCola().length > 0) {
                        this.procesarCola();
                    }
                }, 15000);
                setTimeout(() => this.actualizarInsigniaUI(this.getCola().length), 1000);
            }
        }
    };

    window.apiClient = apiClient;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => apiClient.offline.iniciar());
        } else {
            apiClient.offline.iniciar();
        }
    }
})();
