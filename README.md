# SIGA-AP — Sistema Integral de Gestión de Actividades y Capacitaciones
### Centro de Formación Técnica (CFT)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-blue.svg)](https://vitejs.dev/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

SIGA-AP es una plataforma web integral diseñada para la gestión, control, trazabilidad y reportería de actividades de capacitación técnica, registro y certificación de dotación industrial, evaluaciones de impacto y seguimiento documental de proveedores.

---

## 🚀 Características Principales

1. **Gestión de Capacitaciones y Agenda Multi-clase**:
   - Programación de cursos en series de múltiples clases (Clase 1, Clase 2, Clase 3...).
   - Ciclo de vida y estados independientes por clase (Programado, En curso, Finalizado).
   - Vista de calendario interactivo mensual, semanal y diario con filtros avanzados.
   - Exportación de agenda a reporte ejecutivo en PDF estructurado y estilizado.

2. **Toma de Asistencia y Planilla Oficial**:
   - Búsqueda y carga masiva o individual de asistentes desde el padrón de dotación de RRHH.
   - Generación de planillas de asistencia oficiales para firma física o registro digital con código QR.
   - Cierre de registro con bloqueo de edición y pase automático a histórico de asistencias.

3. **Evaluaciones de Satisfacción y Transferencia**:
   - Formularios públicos de evaluación de satisfacción por QR o link directo con cálculo de métricas.
   - Encuestas de transferencia al puesto para supervisores y jefaturas con control de estados (`Pendiente`, `Enviada`, `Recibida`).

4. **Certificaciones Externas y Calificaciones Técnicas**:
   - Registro de Ensayos No Destructivos (END: Ultrasonido, Líquidos Penetrantes, Partículas Magnetizables).
   - Control de habilitaciones de Soldadores (AWS D1.1, Aluminotérmica) y Operadores de Equipos de Izaje (Hidrogrúas, Puentes Grúa).
   - Alerta temprana de vencimientos y semáforo de vigencia.
   - Almacenamiento y previsualización integrada de certificados PDF.

5. **Administración y Seguimiento Documental de Proveedores**:
   - Catálogos de Programas, Cursos, Instructores, Proveedores y Dotación.
   - Carpetas de actividad para proveedores: carga múltiple de presupuestos, facturas y órdenes de servicio (OS).

6. **Arquitectura Híbrida de Persistencia**:
   - **Nube (Cloud)**: Base de datos relacional PostgreSQL administrada en **Supabase**.
   - **Local (Offline)**: Caché reactivo en IndexedDB con soporte para funcionamiento sin conexión a internet y sincronización bidireccional.

---

## 🗄️ Configuración de la Base de Datos en Supabase

El sistema incluye el script SQL completo (`supabase_schema.sql` y `sql/schema.sql`) con la definición de todas las tablas, columnas, restricciones, claves foráneas, índices, políticas de seguridad (RLS) y datos iniciales.

### Paso a Paso para Crear las Tablas en Supabase:

1. Ingresá a tu cuenta en [Supabase](https://supabase.com/) y creá un nuevo proyecto (o seleccioná uno existente).
2. En el menú lateral izquierdo de Supabase, hacé clic en **SQL Editor**.
3. Creá una nueva consulta (**New query**) haciendo clic en **"+ New Query"**.
4. Abrí el archivo `supabase_schema.sql` de este repositorio, copiá todo su contenido y pegalo en el editor SQL de Supabase.
5. Hacé clic en **"Run"** (o presioná `Ctrl + Enter`).
6. Supabase creará automáticamente las 11 tablas del sistema con todas sus columnas, claves, índices, vistas y datos iniciales:
   - `profiles` (Usuarios y permisos)
   - `programas` (Catálogo de programas)
   - `cursos` (Catálogo de cursos técnicos)
   - `instructores` (Catálogo de instructores)
   - `dotacion` (Padrón maestro de empleados de RRHH)
   - `proveedores` (Proveedores y carpetas de actividad)
   - `capacitaciones` (Actividades y capacitaciones multi-clase)
   - `asistentes` (Nómina de asistentes por capacitación)
   - `evaluaciones_satisfaccion` (Encuestas de satisfacción por QR/enlace)
   - `transferencias` (Evaluaciones de transferencia al puesto)
   - `certificaciones_externas` (Calificaciones técnicas y carnets)

---

## 🔑 Configuración de Credenciales de Supabase

Tenés dos formas muy sencillas de conectar la aplicación a tu base de datos de Supabase:

### Opción A: Desde la Interfaz Web (Sin tocar código)
1. Abrí la aplicación e ingresá al módulo de **Administración** (`administracion.html`).
2. En el menú lateral de administración, seleccioná la pestaña **Bases de Datos**.
3. En la tarjeta **Conexión Supabase (PostgreSQL Cloud)**:
   - Pegá tu **Project URL** (ej: `https://xyz.supabase.co`).
   - Pegá tu **Anon Public Key** (disponible en *Project Settings* -> *API* en Supabase).
4. Hacé clic en **"Guardar y Probar Conexión"**.
5. ¡Listo! La aplicación detectará la conexión y sincronizará los datos automáticamente.

### Opción B: Mediante archivo de Entorno `.env`
1. Copiá el archivo `.env.example` como `.env`:
   ```bash
   cp .env.example .env
   ```
2. Editá `.env` con las credenciales de tu proyecto:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica-aqui
   ```

---

## 💻 Instalación y Ejecución Local

### Requisitos:
- **Node.js** v18 o superior instalado.
- Gestor de paquetes **npm** (incluido con Node.js).

### Pasos:
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/siga-ap.git
   cd siga-ap
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abrí tu navegador en `http://localhost:3000` (o el puerto indicado por Vite).

4. **Acceso directo en Windows**:
   También podés hacer doble clic sobre el archivo `INICIAR_SIGA.bat` para iniciar el sistema automáticamente.

---

## 📦 Subir el Proyecto a GitHub

1. Inicializá el repositorio Git local (si no está inicializado):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Sistema SIGA-AP completo con esquema SQL de Supabase"
   ```

2. Creá un nuevo repositorio en [GitHub](https://github.com/new).

3. Vinculá y subí los cambios:
   ```bash
   git branch -M main
   git remote add origin https://github.com/tu-usuario/nombre-del-repo.git
   git push -u origin main
   ```

---

## 📋 Estructura de Tablas y Columnas (Schema SQL)

| Tabla | Clave Primaria | Columnas Clave | Descripción |
|---|---|---|---|
| `profiles` | `id` (Auto-inc) | `usuario`, `clave`, `nombre`, `email`, `rol`, `estado` | Usuarios del sistema y autenticación local |
| `programas` | `codigo_programa` | `nombre`, `descripcion`, `estado` | Catálogo de programas de capacitación |
| `cursos` | `codigo_curso` | `nombre`, `hs_teoria`, `hs_practica`, `hs_totales`, `modalidad` | Catálogo técnico de cursos formativos |
| `instructores` | `codigo_instructor` | `nombre`, `apellido`, `dni`, `email`, `especialidad`, `tipo` | Docentes internos y externos |
| `dotacion` | `legajo` | `apellido`, `nombre`, `puesto`, `gerencia`, `jefatura`, `email` | Padrón maestro de RRHH |
| `proveedores` | `codigo_proveedor` | `razon_social`, `ente`, `rubro`, `contacto`, `carpetas_seguimiento` (JSONB) | Proveedores externos y seguimiento de facturación |
| `capacitaciones` | `id_cap` | `programa`, `nombre_curso`, `estado`, `fecha`, `clase_nro`, `total_clases` | Actividades formativas y clases multi-clase |
| `asistentes` | `id` (Auto-inc) | `id_cap`, `legajo`, `apellido`, `nombre`, `puesto`, `calificacion` | Presentismo de capacitaciones |
| `evaluaciones_satisfaccion` | `id` (UUID) | `id_cap`, `puntaje_general`, `puntaje_instructor`, `comentarios` | Encuestas de satisfacción post-curso |
| `transferencias` | `id` (Auto-inc) | `id_cap`, `jefatura`, `aplica_contenidos`, `plan_accion`, `firma_responsable` | Evaluaciones de transferencia al puesto de trabajo |
| `certificaciones_externas` | `id` (Auto-inc) | `codigo`, `alcance`, `categoria`, `subcategoria`, `legajo`, `fecha_vencimiento` | Calificaciones técnicas y carnets de END, Soldadura e Izaje |

---

## 🔒 Seguridad y Privacidad

- **Row Level Security (RLS)**: Todas las tablas en Supabase tienen RLS activado.
- **Acceso Anónimo Autorizado**: El script incluye políticas para lectura y escritura seguras utilizando la clave anónima pública (`anon key`), ideal para despliegues corporativos en intranet o redes empresariales.
- **Sin Claves Privadas en el Frontend**: Nunca expongas la clave `service_role` (privada) en el cliente; utilizá siempre la clave pública (`anon key`).

---

Desarrollado para el **Centro de Formación Técnica (CFT)**.
