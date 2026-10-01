// server/app.ts
import express from "express";

// server/api.ts
import { Router as Router13 } from "express";

// server/auth.ts
import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// server/db.ts
import { createClient } from "@supabase/supabase-js";
var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hhksfdwzeesmydgllubh.supabase.co";
var SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoa3NmZHd6ZWVzbXlkZ2xsdWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDcyNjEsImV4cCI6MjEwNDgyMzI2MX0.i5pVoJ-7T5HfQuqQRNdTn1PSnXiqci4Mf-zsd5WmE8c";
var supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Supabase URL or Key not configured in environment");
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseInstance;
}

// server/auth.ts
var JWT_SECRET = process.env.JWT_SECRET || "siga_cft_secure_jwt_token_key_2026";
function generateToken(user) {
  const payload = {
    id: user.id,
    usuario: user.usuario,
    nombre: user.nombre || user.usuario,
    email: user.email || "",
    rol: user.rol || "Operador",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1e3
    // 7 días de validez
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}
function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
    if (signature !== expectedSignature) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : req.query.token;
  if (!token) {
    return res.status(401).json({ error: "No autorizado: Token de sesi\xF3n ausente" });
  }
  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ error: "Sesi\xF3n expirada o token inv\xE1lido" });
  }
  req.user = session;
  next();
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      const rolUsuario = (user.rol || "").toLowerCase().trim();
      const rolesPermitidos = allowedRoles.map((r) => r.toLowerCase().trim());
      const esAdmin = rolUsuario === "administrador" || rolUsuario === "admin";
      const tienePermiso = esAdmin || rolesPermitidos.includes(rolUsuario);
      if (!tienePermiso) {
        return res.status(403).json({
          error: `Acceso denegado: Esta acci\xF3n requiere perfil [${allowedRoles.join(", ")}]. Tu rol actual es '${user.rol}'.`
        });
      }
      next();
    });
  };
}
var requireAdmin = requireRole("Administrador", "Admin");
var requireOperatorOrAdmin = requireRole("Administrador", "Admin", "Operador");
var authRouter = Router();
authRouter.post("/login", async (req, res) => {
  const { usuario, clave } = req.body || {};
  const userClean = (usuario || "").trim();
  const passClean = (clave || "").trim();
  if (!userClean || !passClean) {
    return res.status(400).json({ error: "Debe ingresar usuario y contrase\xF1a" });
  }
  try {
    if (userClean.toLowerCase() === "admin" && passClean.toUpperCase() === "CFT2026") {
      const token2 = generateToken({
        id: 1,
        usuario: "Admin",
        nombre: "Ariel Pizzutto",
        email: "ariel.pizzutto@alumnos.udemm.edu.ar",
        rol: "Administrador"
      });
      return res.json({
        success: true,
        token: token2,
        user: {
          id: 1,
          usuario: "Admin",
          nombre: "Ariel Pizzutto",
          email: "ariel.pizzutto@alumnos.udemm.edu.ar",
          rol: "Administrador",
          estado: "Activo"
        }
      });
    }
    const supabase = getSupabase();
    const { data: users, error } = await supabase.from("profiles").select("*").ilike("usuario", userClean).limit(1);
    if (error) {
      console.error("[API Auth] Error consultando Supabase:", error);
      return res.status(500).json({ error: "Error al conectar con la base de datos" });
    }
    const user = users && users.length > 0 ? users[0] : null;
    if (!user) {
      return res.status(401).json({ error: "Usuario o contrase\xF1a incorrectos" });
    }
    if (user.estado && user.estado.toLowerCase() === "inactivo") {
      return res.status(403).json({ error: "El usuario se encuentra inactivo. Comun\xEDquese con el Administrador." });
    }
    let passwordMatch = false;
    if (user.clave && user.clave.startsWith("$2")) {
      passwordMatch = await bcrypt.compare(passClean, user.clave);
    } else {
      passwordMatch = user.clave === passClean || user.clave && user.clave.toUpperCase() === passClean.toUpperCase();
    }
    if (!passwordMatch) {
      return res.status(401).json({ error: "Usuario o contrase\xF1a incorrectos" });
    }
    const token = generateToken({
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre || user.usuario,
      email: user.email || "",
      rol: user.rol || "Operador"
    });
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        estado: user.estado
      }
    });
  } catch (err) {
    console.error("[API Auth] Error en login:", err);
    return res.status(500).json({ error: "Error interno en el servidor de autenticaci\xF3n" });
  }
});
authRouter.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : req.query.token;
  if (!token) {
    return res.status(401).json({ authenticated: false, error: "No autenticado" });
  }
  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ authenticated: false, error: "Token inv\xE1lido o expirado" });
  }
  return res.json({
    authenticated: true,
    user: {
      id: session.id,
      usuario: session.usuario,
      nombre: session.nombre,
      email: session.email,
      rol: session.rol
    }
  });
});
authRouter.post("/logout", (_req, res) => {
  return res.json({ success: true, message: "Sesi\xF3n finalizada correctamente" });
});

// server/routes/dotacion.ts
import { Router as Router2 } from "express";
var dotacionRouter = Router2();
dotacionRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { q, estado, limit = 500, offset = 0 } = req.query;
    let query = supabase.from("dotacion").select("*");
    if (estado) {
      query = query.eq("estado", String(estado));
    }
    if (q) {
      const search = String(q).trim();
      query = query.or(`legajo.ilike.%${search}%,nombre.ilike.%${search}%,apellido.ilike.%${search}%,puesto.ilike.%${search}%,gerencia.ilike.%${search}%`);
    }
    query = query.order("apellido", { ascending: true }).range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error, count } = await query;
    if (error) {
      console.error("[API dotacion] Error al listar:", error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ data: data || [], count: count || (data ? data.length : 0) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
dotacionRouter.get("/:legajo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const legajo = String(req.params.legajo || "").trim();
    const { data, error } = await supabase.from("dotacion").select("*").eq("legajo", legajo).maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: `Empleado con legajo ${legajo} no encontrado` });
    }
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
dotacionRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.legajo || !body.nombre || !body.apellido) {
      return res.status(400).json({ error: "Legajo, nombre y apellido son obligatorios" });
    }
    const registro = {
      legajo: String(body.legajo).trim(),
      nombre: String(body.nombre).trim(),
      apellido: String(body.apellido).trim(),
      puesto: body.puesto || "",
      categoria: body.categoria || "",
      direccion: body.direccion || "",
      gerencia: body.gerencia || "",
      jefatura: body.jefatura || "",
      coordinacion: body.coordinacion || "",
      email: body.email || "",
      estado: body.estado || "Activo"
    };
    const { data, error } = await supabase.from("dotacion").upsert(registro, { onConflict: "legajo" }).select().single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
dotacionRouter.put("/:legajo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const legajo = String(req.params.legajo || "").trim();
    const body = req.body;
    const actualizacion = {};
    if (body.nombre !== void 0) actualizacion.nombre = String(body.nombre).trim();
    if (body.apellido !== void 0) actualizacion.apellido = String(body.apellido).trim();
    if (body.puesto !== void 0) actualizacion.puesto = body.puesto;
    if (body.categoria !== void 0) actualizacion.categoria = body.categoria;
    if (body.direccion !== void 0) actualizacion.direccion = body.direccion;
    if (body.gerencia !== void 0) actualizacion.gerencia = body.gerencia;
    if (body.jefatura !== void 0) actualizacion.jefatura = body.jefatura;
    if (body.coordinacion !== void 0) actualizacion.coordinacion = body.coordinacion;
    if (body.email !== void 0) actualizacion.email = body.email;
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    const { data, error } = await supabase.from("dotacion").update(actualizacion).eq("legajo", legajo).select().maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
dotacionRouter.delete("/:legajo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const legajo = String(req.params.legajo || "").trim();
    const { error } = await supabase.from("dotacion").delete().eq("legajo", legajo);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, message: `Empleado ${legajo} eliminado correctamente` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
dotacionRouter.post("/bulk", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { empleados } = req.body;
    if (!Array.isArray(empleados) || empleados.length === 0) {
      return res.status(400).json({ error: "Se requiere una lista de empleados" });
    }
    const registrosValidos = empleados.filter((e) => e && e.legajo && (e.nombre || e.apellido)).map((e) => ({
      legajo: String(e.legajo).trim(),
      nombre: String(e.nombre || "").trim(),
      apellido: String(e.apellido || "").trim(),
      puesto: e.puesto || "",
      categoria: e.categoria || "",
      direccion: e.direccion || "",
      gerencia: e.gerencia || "",
      jefatura: e.jefatura || "",
      coordinacion: e.coordinacion || "",
      email: e.email || "",
      estado: e.estado || "Activo"
    }));
    if (registrosValidos.length === 0) {
      return res.status(400).json({ error: "Ning\xFAn registro contiene legajo y nombre v\xE1lidos" });
    }
    const { data, error } = await supabase.from("dotacion").upsert(registrosValidos, { onConflict: "legajo" }).select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, count: data ? data.length : registrosValidos.length, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/cursos.ts
import { Router as Router3 } from "express";
var cursosRouter = Router3();
cursosRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { estado } = req.query;
    let query = supabase.from("cursos").select("*").order("nombre", { ascending: true });
    if (estado) {
      query = query.eq("estado", String(estado));
    }
    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
cursosRouter.get("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const { data, error } = await supabase.from("cursos").select("*").eq("codigo_curso", codigo).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Curso no encontrado" });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
cursosRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.nombre) {
      return res.status(400).json({ error: "El nombre del curso es obligatorio" });
    }
    let codigo = (body.codigo_curso || "").trim();
    if (!codigo) {
      const { data: ultimos } = await supabase.from("cursos").select("codigo_curso").order("codigo_curso", { ascending: false }).limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_curso : "";
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `CUR-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(siguienteNum).padStart(3, "0")}`;
    }
    const hsTeoria = Number(body.hs_teoria) || 0;
    const hsPractica = Number(body.hs_practica) || 0;
    const hsTotales = Number(body.hs_totales) || hsTeoria + hsPractica;
    const registro = {
      codigo_curso: codigo,
      nombre: String(body.nombre).trim(),
      hs_teoria: hsTeoria,
      hs_practica: hsPractica,
      hs_totales: hsTotales,
      modalidad: body.modalidad || "Presencial",
      contenido: body.contenido || body.descripcion || "",
      descripcion: body.descripcion || body.contenido || "",
      programa_pdf_url: body.programa_pdf_url || "",
      estado: body.estado || "Activo"
    };
    const { data, error } = await supabase.from("cursos").upsert(registro, { onConflict: "codigo_curso" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
cursosRouter.put("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const body = req.body;
    const actualizacion = {};
    if (body.nombre !== void 0) actualizacion.nombre = String(body.nombre).trim();
    if (body.hs_teoria !== void 0) actualizacion.hs_teoria = Number(body.hs_teoria);
    if (body.hs_practica !== void 0) actualizacion.hs_practica = Number(body.hs_practica);
    if (body.hs_totales !== void 0) actualizacion.hs_totales = Number(body.hs_totales);
    if (body.modalidad !== void 0) actualizacion.modalidad = body.modalidad;
    if (body.contenido !== void 0) actualizacion.contenido = String(body.contenido).trim();
    if (body.descripcion !== void 0) actualizacion.descripcion = String(body.descripcion).trim();
    if (body.programa_pdf_url !== void 0) actualizacion.programa_pdf_url = String(body.programa_pdf_url).trim();
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    let { data, error } = await supabase.from("cursos").update(actualizacion).eq("codigo_curso", codigo).select().maybeSingle();
    if (!data && !error) {
      const resUpsert = await supabase.from("cursos").upsert({ ...actualizacion, codigo_curso: codigo }, { onConflict: "codigo_curso" }).select().single();
      data = resUpsert.data;
      error = resUpsert.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
cursosRouter.delete("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const { error } = await supabase.from("cursos").delete().eq("codigo_curso", codigo);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Curso ${codigo} eliminado` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/programas.ts
import { Router as Router4 } from "express";
var programasRouter = Router4();
programasRouter.get("/", async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("programas").select("*").order("nombre", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
programasRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.nombre) {
      return res.status(400).json({ error: "El nombre del programa es obligatorio" });
    }
    let codigo = (body.codigo_programa || "").trim();
    if (!codigo) {
      const { data: ultimos } = await supabase.from("programas").select("codigo_programa").order("codigo_programa", { ascending: false }).limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_programa : "";
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `PRO-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(siguienteNum).padStart(3, "0")}`;
    }
    const registro = {
      codigo_programa: codigo,
      nombre: String(body.nombre).trim(),
      descripcion: body.descripcion || "",
      estado: body.estado || "Activo"
    };
    const { data, error } = await supabase.from("programas").upsert(registro, { onConflict: "codigo_programa" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
programasRouter.put("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const body = req.body;
    const actualizacion = {};
    if (body.nombre !== void 0) actualizacion.nombre = String(body.nombre).trim();
    if (body.descripcion !== void 0) actualizacion.descripcion = body.descripcion;
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    let { data, error } = await supabase.from("programas").update(actualizacion).eq("codigo_programa", codigo).select().maybeSingle();
    if (!data && !error) {
      const resUpsert = await supabase.from("programas").upsert({ ...actualizacion, codigo_programa: codigo }, { onConflict: "codigo_programa" }).select().single();
      data = resUpsert.data;
      error = resUpsert.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
programasRouter.delete("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const { error } = await supabase.from("programas").delete().eq("codigo_programa", codigo);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Programa ${codigo} eliminado` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/instructores.ts
import { Router as Router5 } from "express";
var instructoresRouter = Router5();
instructoresRouter.get("/", async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("instructores").select("*").order("apellido", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
instructoresRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    let codigo = (body.codigo_instructor || "").trim();
    if (!codigo) {
      const { data: ultimos } = await supabase.from("instructores").select("codigo_instructor").order("codigo_instructor", { ascending: false }).limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_instructor : "";
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `INS-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(siguienteNum).padStart(3, "0")}`;
    }
    const registro = {
      codigo_instructor: codigo,
      nombre: String(body.nombre).trim(),
      apellido: String(body.apellido || "").trim(),
      dni: body.dni || "",
      email: body.email || "",
      especialidad: body.especialidad || "",
      tipo: body.tipo || "Interno",
      estado: body.estado || "Activo"
    };
    const { data, error } = await supabase.from("instructores").upsert(registro, { onConflict: "codigo_instructor" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
instructoresRouter.put("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const body = req.body;
    const actualizacion = {};
    if (body.nombre !== void 0) actualizacion.nombre = String(body.nombre).trim();
    if (body.apellido !== void 0) actualizacion.apellido = String(body.apellido).trim();
    if (body.dni !== void 0) actualizacion.dni = body.dni;
    if (body.email !== void 0) actualizacion.email = body.email;
    if (body.especialidad !== void 0) actualizacion.especialidad = body.especialidad;
    if (body.tipo !== void 0) actualizacion.tipo = body.tipo;
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    let { data, error } = await supabase.from("instructores").update(actualizacion).eq("codigo_instructor", codigo).select().maybeSingle();
    if (!data && !error) {
      const resUpsert = await supabase.from("instructores").upsert({ ...actualizacion, codigo_instructor: codigo }, { onConflict: "codigo_instructor" }).select().single();
      data = resUpsert.data;
      error = resUpsert.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
instructoresRouter.delete("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const { error } = await supabase.from("instructores").delete().eq("codigo_instructor", codigo);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Instructor ${codigo} eliminado` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/capacitaciones.ts
import { Router as Router6 } from "express";
var capacitacionesRouter = Router6();
capacitacionesRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { estado, fecha, curso, id_cap, con_asistentes } = req.query;
    let query = supabase.from("capacitaciones").select("*").order("fecha", { ascending: false });
    if (id_cap) query = query.eq("id_cap", String(id_cap));
    if (estado) query = query.eq("estado", String(estado));
    if (fecha) query = query.eq("fecha", String(fecha));
    if (curso) query = query.ilike("nombre_curso", `%${String(curso)}%`);
    const { data: capacitaciones, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    if (con_asistentes === "true" && capacitaciones && capacitaciones.length > 0) {
      const ids = capacitaciones.map((c) => c.id_cap);
      const { data: asistentes } = await supabase.from("asistentes").select("*").in("id_cap", ids);
      const mapaAsistentes = (asistentes || []).reduce((acc, asis) => {
        if (!acc[asis.id_cap]) acc[asis.id_cap] = [];
        acc[asis.id_cap].push(asis);
        return acc;
      }, {});
      const resultado = capacitaciones.map((c) => ({
        ...c,
        asistentes: mapaAsistentes[c.id_cap] || []
      }));
      return res.json({ data: resultado });
    }
    return res.json({ data: capacitaciones || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
capacitacionesRouter.get("/:id_cap", async (req, res) => {
  try {
    const supabase = getSupabase();
    const idCap = String(req.params.id_cap || "").trim();
    const { data: cap, error } = await supabase.from("capacitaciones").select("*").eq("id_cap", idCap).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!cap) return res.status(404).json({ error: `Capacitaci\xF3n ${idCap} no encontrada` });
    const { data: asistentes } = await supabase.from("asistentes").select("*").eq("id_cap", idCap).order("apellido", { ascending: true });
    return res.json({
      data: {
        ...cap,
        asistentes: asistentes || []
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
capacitacionesRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.nombre_curso) {
      return res.status(400).json({ error: "El nombre del curso es obligatorio" });
    }
    let idCap = (body.id_cap || "").trim();
    if (!idCap) {
      const anio = (/* @__PURE__ */ new Date()).getFullYear();
      const { data: ultimos } = await supabase.from("capacitaciones").select("id_cap").like("id_cap", `CAP-${anio}-%`).order("id_cap", { ascending: false }).limit(1);
      let proxNum = 1;
      if (ultimos && ultimos[0] && ultimos[0].id_cap) {
        const match = ultimos[0].id_cap.match(/\d+$/);
        if (match) proxNum = parseInt(match[0], 10) + 1;
      }
      idCap = `CAP-${anio}-${String(proxNum).padStart(4, "0")}`;
    }
    const registroCap = {
      id_cap: idCap,
      programa: body.programa || "",
      nombre_curso: String(body.nombre_curso).trim(),
      estado: body.estado || "Programado",
      tema: body.tema || "",
      fecha: body.fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      hs_inicio: body.hs_inicio || "",
      hs_fin: body.hs_fin || "",
      lugar: body.lugar || "",
      centro: body.centro || "",
      instructor_1: body.instructor_1 || "",
      instructor_2: body.instructor_2 || "",
      observaciones: body.observaciones || "",
      clase_nro: Number(body.clase_nro) || 1,
      total_clases: String(body.total_clases || "1"),
      estado_tra: body.estado_tra || "Pendiente",
      estado_sat: body.estado_sat || body.estado_encuesta || "Pendiente",
      estado_encuesta: body.estado_encuesta || body.estado_sat || "Pendiente"
    };
    const { data: capCreada, error: errorCap } = await supabase.from("capacitaciones").upsert(registroCap, { onConflict: "id_cap" }).select().single();
    if (errorCap) return res.status(500).json({ error: errorCap.message });
    let asistentesInsertados = [];
    if (Array.isArray(body.asistentes) && body.asistentes.length > 0) {
      const listaAsistentes = body.asistentes.map((a) => ({
        id_cap: idCap,
        legajo: String(a.legajo || "").trim(),
        apellido: String(a.apellido || "").trim(),
        nombre: String(a.nombre || "").trim(),
        puesto: a.puesto || "",
        categoria: a.categoria || "",
        direccion: a.direccion || "",
        gerencia: a.gerencia || "",
        jefatura: a.jefatura || "",
        email: a.email || "",
        calificacion: a.calificacion !== void 0 ? String(a.calificacion) : "",
        observaciones: a.observaciones || ""
      }));
      await supabase.from("asistentes").delete().eq("id_cap", idCap);
      const { data: asisData, error: errAsis } = await supabase.from("asistentes").insert(listaAsistentes).select();
      if (!errAsis && asisData) {
        asistentesInsertados = asisData;
      }
    }
    return res.status(201).json({
      success: true,
      data: {
        ...capCreada,
        asistentes: asistentesInsertados
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
capacitacionesRouter.put("/:id_cap", async (req, res) => {
  try {
    const supabase = getSupabase();
    const idCap = String(req.params.id_cap || "").trim();
    const body = req.body;
    const actualizacion = {};
    if (body.programa !== void 0) actualizacion.programa = body.programa;
    if (body.nombre_curso !== void 0) actualizacion.nombre_curso = body.nombre_curso;
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    if (body.tema !== void 0) actualizacion.tema = body.tema;
    if (body.fecha !== void 0) actualizacion.fecha = body.fecha;
    if (body.hs_inicio !== void 0) actualizacion.hs_inicio = body.hs_inicio;
    if (body.hs_fin !== void 0) actualizacion.hs_fin = body.hs_fin;
    if (body.lugar !== void 0) actualizacion.lugar = body.lugar;
    if (body.centro !== void 0) actualizacion.centro = body.centro;
    if (body.instructor_1 !== void 0) actualizacion.instructor_1 = body.instructor_1;
    if (body.instructor_2 !== void 0) actualizacion.instructor_2 = body.instructor_2;
    if (body.observaciones !== void 0) actualizacion.observaciones = body.observaciones;
    if (body.clase_nro !== void 0) actualizacion.clase_nro = Number(body.clase_nro);
    if (body.total_clases !== void 0) actualizacion.total_clases = String(body.total_clases);
    if (body.estado_sat !== void 0) actualizacion.estado_sat = body.estado_sat;
    if (body.estado_encuesta !== void 0) actualizacion.estado_encuesta = body.estado_encuesta;
    if (body.estado_tra !== void 0) actualizacion.estado_tra = body.estado_tra;
    const { data, error } = await supabase.from("capacitaciones").update(actualizacion).eq("id_cap", idCap).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (Array.isArray(body.asistentes)) {
      await supabase.from("asistentes").delete().eq("id_cap", idCap);
      if (body.asistentes.length > 0) {
        const listaAsistentes = body.asistentes.map((a) => ({
          id_cap: idCap,
          legajo: String(a.legajo || "").trim(),
          apellido: String(a.apellido || "").trim(),
          nombre: String(a.nombre || "").trim(),
          puesto: a.puesto || "",
          categoria: a.categoria || "",
          direccion: a.direccion || "",
          gerencia: a.gerencia || "",
          jefatura: a.jefatura || "",
          email: a.email || "",
          calificacion: a.calificacion !== void 0 ? String(a.calificacion) : "",
          observaciones: a.observaciones || ""
        }));
        await supabase.from("asistentes").insert(listaAsistentes);
      }
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
capacitacionesRouter.delete("/:id_cap", async (req, res) => {
  try {
    const supabase = getSupabase();
    const idCap = String(req.params.id_cap || "").trim();
    await supabase.from("asistentes").delete().eq("id_cap", idCap);
    const { error } = await supabase.from("capacitaciones").delete().eq("id_cap", idCap);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Capacitaci\xF3n ${idCap} eliminada` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/asistentes.ts
import { Router as Router7 } from "express";
var asistentesRouter = Router7();
asistentesRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id_cap, legajo } = req.query;
    let query = supabase.from("asistentes").select("*");
    if (id_cap) query = query.eq("id_cap", String(id_cap));
    if (legajo) query = query.eq("legajo", String(legajo));
    const { data, error } = await query.order("apellido", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
asistentesRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.id_cap || !body.legajo) {
      return res.status(400).json({ error: "id_cap y legajo son requeridos" });
    }
    const registro = {
      id_cap: String(body.id_cap).trim(),
      legajo: String(body.legajo).trim(),
      apellido: String(body.apellido || "").trim(),
      nombre: String(body.nombre || "").trim(),
      puesto: body.puesto || "",
      categoria: body.categoria || "",
      direccion: body.direccion || "",
      gerencia: body.gerencia || "",
      jefatura: body.jefatura || "",
      email: body.email || "",
      calificacion: body.calificacion !== void 0 ? String(body.calificacion) : "",
      observaciones: body.observaciones || ""
    };
    const { data, error } = await supabase.from("asistentes").insert(registro).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
asistentesRouter.put("/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const body = req.body;
    const actualizacion = {};
    if (body.calificacion !== void 0) actualizacion.calificacion = String(body.calificacion);
    if (body.observaciones !== void 0) actualizacion.observaciones = body.observaciones;
    const { data, error } = await supabase.from("asistentes").update(actualizacion).eq("id", id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
asistentesRouter.delete("/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const { error } = await supabase.from("asistentes").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Asistente ${id} eliminado` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
asistentesRouter.post("/bulk-save", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id_cap, asistentes } = req.body;
    if (!id_cap || !Array.isArray(asistentes)) {
      return res.status(400).json({ error: "id_cap y la lista de asistentes son requeridos" });
    }
    await supabase.from("asistentes").delete().eq("id_cap", id_cap);
    if (asistentes.length > 0) {
      const registros = asistentes.map((a) => ({
        id_cap,
        legajo: String(a.legajo || "").trim(),
        apellido: String(a.apellido || "").trim(),
        nombre: String(a.nombre || "").trim(),
        puesto: a.puesto || "",
        categoria: a.categoria || "",
        direccion: a.direccion || "",
        gerencia: a.gerencia || "",
        jefatura: a.jefatura || "",
        email: a.email || "",
        calificacion: a.calificacion !== void 0 ? String(a.calificacion) : "",
        observaciones: a.observaciones || ""
      }));
      const { data, error } = await supabase.from("asistentes").insert(registros).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, count: data.length, data });
    }
    return res.json({ success: true, count: 0, data: [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/evaluaciones.ts
import { Router as Router8 } from "express";
var evaluacionesRouter = Router8();
evaluacionesRouter.get("/satisfaccion", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id_cap } = req.query;
    let query = supabase.from("evaluaciones_satisfaccion").select("*");
    if (id_cap) query = query.eq("id_cap", String(id_cap));
    const { data, error } = await query.order("fecha_registro", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
evaluacionesRouter.post("/satisfaccion", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    const id = body.id || `EVA-${Date.now()}`;
    const idCap = body.id_cap ? String(body.id_cap).trim() : null;
    const registro = {
      id,
      id_cap: idCap,
      instructor: body.instructor || "",
      puntaje_objetivos: Number(body.puntaje_objetivos) || 0,
      puntaje_aplicabilidad: Number(body.puntaje_aplicabilidad) || 0,
      puntaje_instructor: Number(body.puntaje_instructor) || 0,
      puntaje_material: Number(body.puntaje_material) || 0,
      puntaje_entorno: Number(body.puntaje_entorno) || 0,
      puntaje_general: Number(body.puntaje_general) || 0,
      puntaje_docente: Number(body.puntaje_docente || body.puntaje_instructor) || 0,
      puntaje_contenido: Number(body.puntaje_contenido || body.puntaje_objetivos) || 0,
      destacados: body.destacados || "",
      sugerencias: body.sugerencias || "",
      comentarios: body.comentarios || "",
      fecha_registro: body.fecha_registro || (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabase.from("evaluaciones_satisfaccion").upsert(registro, { onConflict: "id" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (idCap) {
      await supabase.from("capacitaciones").update({ estado_sat: "Respondida", estado_encuesta: "Respondida" }).eq("id_cap", idCap);
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
evaluacionesRouter.get("/transferencia", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id_cap, legajo } = req.query;
    let query = supabase.from("transferencias").select("*");
    if (id_cap) query = query.eq("id_cap", String(id_cap));
    if (legajo) query = query.eq("legajo", String(legajo));
    const { data, error } = await query.order("fecha_registro", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
evaluacionesRouter.post("/transferencia", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    const idCap = body.id_cap ? String(body.id_cap).trim() : null;
    const registro = {
      id_cap: idCap,
      jefatura: body.jefatura || "",
      nombre_curso: body.nombre_curso || "",
      fecha_curso: body.fecha_curso || "",
      legajo: body.legajo || "",
      nombre: body.nombre || "",
      aplica_contenidos: body.aplica_contenidos || "SI",
      motivo_dificultad: body.motivo_dificultad || "",
      plan_accion: body.plan_accion || "",
      firma_responsable: body.firma_responsable || "",
      fecha_registro: body.fecha_registro || (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabase.from("transferencias").insert(registro).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (idCap) {
      await supabase.from("capacitaciones").update({ estado_tra: "Recibida" }).eq("id_cap", idCap);
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/certificaciones.ts
import { Router as Router9 } from "express";
var certificacionesRouter = Router9();
certificacionesRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { estado, legajo, proveedor_id } = req.query;
    let query = supabase.from("certificaciones_externas").select("*");
    if (estado) query = query.eq("estado", String(estado));
    if (legajo) query = query.eq("legajo", Number(legajo));
    if (proveedor_id) query = query.eq("proveedor_id", String(proveedor_id));
    const { data, error } = await query.order("id", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
certificacionesRouter.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const { data, error } = await supabase.from("certificaciones_externas").select("*").eq("id", id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Certificaci\xF3n no encontrada" });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
certificacionesRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    const registro = {
      codigo: body.codigo || `CERT-${Date.now()}`,
      alcance: body.alcance || "",
      categoria: body.categoria || "",
      subcategoria: body.subcategoria || "",
      legajo: body.legajo ? Number(body.legajo) : null,
      apellido_nombre: body.apellido_nombre || "",
      puesto: body.puesto || "",
      area_jefatura: body.area_jefatura || "",
      proveedor_id: body.proveedor_id || "",
      proveedor_ente: body.proveedor_ente || "",
      fecha_emision: body.fecha_emision || "",
      fecha_vencimiento: body.fecha_vencimiento || "",
      tiene_vencimiento: body.tiene_vencimiento !== false,
      archivo_pdf_nombre: body.archivo_pdf_nombre || "",
      archivo_pdf_url: body.archivo_pdf_url || "",
      archivo_pdf_base64: body.archivo_pdf_base64 || body.archivo_pdf_data || "",
      estado: body.estado || "Vigente"
    };
    let { data, error } = await supabase.from("certificaciones_externas").insert(registro).select().single();
    if (error && error.message && error.message.includes("archivo_pdf_url")) {
      delete registro.archivo_pdf_url;
      const resRetry = await supabase.from("certificaciones_externas").insert(registro).select().single();
      data = resRetry.data;
      error = resRetry.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
certificacionesRouter.put("/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const body = req.body;
    const actualizacion = {};
    if (body.codigo !== void 0) actualizacion.codigo = body.codigo;
    if (body.alcance !== void 0) actualizacion.alcance = body.alcance;
    if (body.categoria !== void 0) actualizacion.categoria = body.categoria;
    if (body.subcategoria !== void 0) actualizacion.subcategoria = body.subcategoria;
    if (body.legajo !== void 0) actualizacion.legajo = body.legajo ? Number(body.legajo) : null;
    if (body.apellido_nombre !== void 0) actualizacion.apellido_nombre = body.apellido_nombre;
    if (body.puesto !== void 0) actualizacion.puesto = body.puesto;
    if (body.area_jefatura !== void 0) actualizacion.area_jefatura = body.area_jefatura;
    if (body.proveedor_id !== void 0) actualizacion.proveedor_id = body.proveedor_id;
    if (body.proveedor_ente !== void 0) actualizacion.proveedor_ente = body.proveedor_ente;
    if (body.fecha_emision !== void 0) actualizacion.fecha_emision = body.fecha_emision;
    if (body.fecha_vencimiento !== void 0) actualizacion.fecha_vencimiento = body.fecha_vencimiento;
    if (body.tiene_vencimiento !== void 0) actualizacion.tiene_vencimiento = body.tiene_vencimiento;
    if (body.archivo_pdf_nombre !== void 0) actualizacion.archivo_pdf_nombre = body.archivo_pdf_nombre;
    if (body.archivo_pdf_url !== void 0) actualizacion.archivo_pdf_url = body.archivo_pdf_url;
    if (body.archivo_pdf_base64 !== void 0) actualizacion.archivo_pdf_base64 = body.archivo_pdf_base64;
    if (body.archivo_pdf_data !== void 0) actualizacion.archivo_pdf_data = body.archivo_pdf_data;
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    let { data, error } = await supabase.from("certificaciones_externas").update(actualizacion).eq("id", id).select().maybeSingle();
    if (error && error.message && error.message.includes("archivo_pdf_url")) {
      delete actualizacion.archivo_pdf_url;
      const resRetry = await supabase.from("certificaciones_externas").update(actualizacion).eq("id", id).select().maybeSingle();
      data = resRetry.data;
      error = resRetry.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
certificacionesRouter.delete("/:id", async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const { error } = await supabase.from("certificaciones_externas").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Certificaci\xF3n ${id} eliminada` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/proveedores.ts
import { Router as Router10 } from "express";
var proveedoresRouter = Router10();
proveedoresRouter.get("/", async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("proveedores").select("*").order("razon_social", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
proveedoresRouter.post("/", async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    if (!body.razon_social) {
      return res.status(400).json({ error: "La raz\xF3n social es obligatoria" });
    }
    let codigo = (body.codigo_proveedor || "").trim();
    if (!codigo) {
      const { data: ultimos } = await supabase.from("proveedores").select("codigo_proveedor").order("codigo_proveedor", { ascending: false }).limit(1);
      const ultimo = ultimos && ultimos[0] ? ultimos[0].codigo_proveedor : "";
      const match = ultimo.match(/\d+$/);
      const siguienteNum = match ? parseInt(match[0], 10) + 1 : 1;
      codigo = `PRV-${String(siguienteNum).padStart(3, "0")}`;
    }
    const registro = {
      codigo_proveedor: codigo,
      razon_social: String(body.razon_social).trim(),
      ente: body.ente || "",
      rubro: body.rubro || "",
      contacto: body.contacto || "",
      telefono: body.telefono || "",
      email: body.email || "",
      estado: body.estado || "Activo",
      carpetas_seguimiento: body.carpetas_seguimiento || []
    };
    const { data, error } = await supabase.from("proveedores").upsert(registro, { onConflict: "codigo_proveedor" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
proveedoresRouter.put("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const body = req.body;
    const actualizacion = {};
    if (body.razon_social !== void 0) actualizacion.razon_social = body.razon_social;
    if (body.ente !== void 0) actualizacion.ente = body.ente;
    if (body.rubro !== void 0) actualizacion.rubro = body.rubro;
    if (body.contacto !== void 0) actualizacion.contacto = body.contacto;
    if (body.telefono !== void 0) actualizacion.telefono = body.telefono;
    if (body.email !== void 0) actualizacion.email = body.email;
    if (body.estado !== void 0) actualizacion.estado = body.estado;
    if (body.carpetas_seguimiento !== void 0) actualizacion.carpetas_seguimiento = body.carpetas_seguimiento;
    let { data, error } = await supabase.from("proveedores").update(actualizacion).eq("codigo_proveedor", codigo).select().maybeSingle();
    if (!data && !error) {
      const resUpsert = await supabase.from("proveedores").upsert({ ...actualizacion, codigo_proveedor: codigo }, { onConflict: "codigo_proveedor" }).select().single();
      data = resUpsert.data;
      error = resUpsert.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
proveedoresRouter.delete("/:codigo", async (req, res) => {
  try {
    const supabase = getSupabase();
    const codigo = String(req.params.codigo || "").trim();
    const { error } = await supabase.from("proveedores").delete().eq("codigo_proveedor", codigo);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Proveedor ${codigo} eliminado` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/stats.ts
import { Router as Router11 } from "express";
var statsRouter = Router11();
statsRouter.get("/dashboard", async (_req, res) => {
  try {
    const supabase = getSupabase();
    const [
      { count: totalDotacion },
      { count: totalCursos },
      { count: totalInstructores },
      { count: totalProgramas },
      { data: capacitaciones },
      { data: certificaciones }
    ] = await Promise.all([
      supabase.from("dotacion").select("*", { count: "exact", head: true }).eq("estado", "Activo"),
      supabase.from("cursos").select("*", { count: "exact", head: true }).eq("estado", "Activo"),
      supabase.from("instructores").select("*", { count: "exact", head: true }).eq("estado", "Activo"),
      supabase.from("programas").select("*", { count: "exact", head: true }).eq("estado", "Activo"),
      supabase.from("capacitaciones").select("id_cap, estado, fecha, total_clases, nombre_curso"),
      supabase.from("certificaciones_externas").select("id, estado, fecha_vencimiento")
    ]);
    const caps = capacitaciones || [];
    const certs = certificaciones || [];
    const capsFinalizadas = caps.filter((c) => c.estado === "Finalizado" || c.estado === "Completada").length;
    const capsEnCurso = caps.filter((c) => c.estado === "En Curso").length;
    const capsProgramadas = caps.filter((c) => c.estado === "Programado" || c.estado === "Planificada").length;
    const certsVigentes = certs.filter((c) => c.estado === "Vigente").length;
    const certsPorVencer = certs.filter((c) => c.estado === "Por Vencer").length;
    const certsVencidas = certs.filter((c) => c.estado === "Vencido").length;
    return res.json({
      dotacion: totalDotacion || 0,
      cursos: totalCursos || 0,
      instructores: totalInstructores || 0,
      programas: totalProgramas || 0,
      capacitaciones: {
        total: caps.length,
        finalizadas: capsFinalizadas,
        enCurso: capsEnCurso,
        programadas: capsProgramadas
      },
      certificaciones: {
        total: certs.length,
        vigentes: certsVigentes,
        porVencer: certsPorVencer,
        vencidas: certsVencidas
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/routes/usuarios.ts
import { Router as Router12 } from "express";
import bcrypt2 from "bcryptjs";
var usuariosRouter = Router12();
usuariosRouter.get("/", requireAdmin, async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("profiles").select("id, usuario, nombre, email, rol, estado, creado_el, created_at").order("usuario", { ascending: true });
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ data: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
usuariosRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { usuario, clave, nombre, email, rol = "Operador", estado = "Activo" } = req.body;
    const userClean = String(usuario || "").trim();
    const passClean = String(clave || "").trim();
    if (!userClean || !passClean) {
      return res.status(400).json({ error: "Usuario y contrase\xF1a son requeridos" });
    }
    const { data: existente } = await supabase.from("profiles").select("id").ilike("usuario", userClean).maybeSingle();
    if (existente) {
      return res.status(409).json({ error: `El usuario '${userClean}' ya se encuentra registrado` });
    }
    const salt = await bcrypt2.genSalt(10);
    const hashClave = await bcrypt2.hash(passClean, salt);
    const nuevoPerfil = {
      usuario: userClean,
      clave: hashClave,
      nombre: String(nombre || userClean).trim(),
      email: String(email || "").trim(),
      rol: String(rol).trim(),
      estado: String(estado).trim()
    };
    const { data, error } = await supabase.from("profiles").insert(nuevoPerfil).select("id, usuario, nombre, email, rol, estado, created_at").single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
usuariosRouter.put("/:usuario", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const usuarioParam = String(req.params.usuario || "").trim();
    const { clave, nombre, email, rol, estado } = req.body;
    const actualizacion = {};
    if (nombre !== void 0) actualizacion.nombre = String(nombre).trim();
    if (email !== void 0) actualizacion.email = String(email).trim();
    if (rol !== void 0) actualizacion.rol = String(rol).trim();
    if (estado !== void 0) actualizacion.estado = String(estado).trim();
    if (clave && String(clave).trim() !== "") {
      const salt = await bcrypt2.genSalt(10);
      actualizacion.clave = await bcrypt2.hash(String(clave).trim(), salt);
    }
    const { data, error } = await supabase.from("profiles").update(actualizacion).ilike("usuario", usuarioParam).select("id, usuario, nombre, email, rol, estado, created_at").maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: `Usuario '${usuarioParam}' no encontrado` });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
usuariosRouter.delete("/:usuario", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const usuarioParam = String(req.params.usuario || "").trim();
    const currentUser = req.user;
    if (currentUser && currentUser.usuario.toLowerCase() === usuarioParam.toLowerCase()) {
      return res.status(400).json({ error: "No es posible eliminar tu propio usuario en sesi\xF3n activa" });
    }
    if (usuarioParam.toLowerCase() === "admin") {
      return res.status(403).json({ error: "El usuario maestro Admin no puede ser eliminado" });
    }
    const { error } = await supabase.from("profiles").delete().ilike("usuario", usuarioParam);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, message: `Usuario '${usuarioParam}' eliminado correctamente` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// server/api.ts
var apiRouter = Router13();
apiRouter.get("/health", async (_req, res) => {
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    if (error) {
      return res.status(503).json({
        status: "degraded",
        database: "error",
        error: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return res.json({
      status: "ok",
      database: "connected",
      profilesCount: count,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      database: "unreachable",
      error: err.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
apiRouter.use("/auth", authRouter);
apiRouter.use("/dotacion", dotacionRouter);
apiRouter.use("/cursos", cursosRouter);
apiRouter.use("/programas", programasRouter);
apiRouter.use("/instructores", instructoresRouter);
apiRouter.use("/capacitaciones", capacitacionesRouter);
apiRouter.use("/asistentes", asistentesRouter);
apiRouter.use("/evaluaciones", evaluacionesRouter);
apiRouter.use("/certificaciones", certificacionesRouter);
apiRouter.use("/proveedores", proveedoresRouter);
apiRouter.use("/stats", statsRouter);
apiRouter.use("/usuarios", usuariosRouter);

// server/app.ts
function createServerApp() {
  const app2 = express();
  app2.use(express.json({ limit: "10mb" }));
  app2.use(express.urlencoded({ extended: true }));
  app2.use("/api", apiRouter);
  app2.use("/", apiRouter);
  return app2;
}

// server/entry.ts
var app = createServerApp();
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
