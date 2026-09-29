import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../db';
import { requireAdmin, UserSession } from '../auth';

export const usuariosRouter = Router();

// GET /api/usuarios - Listar todos los usuarios del sistema (solo administradores)
usuariosRouter.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, usuario, nombre, email, rol, estado, creado_el, created_at')
      .order('usuario', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/usuarios - Registrar nuevo usuario con clave encriptada (solo administradores)
usuariosRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { usuario, clave, nombre, email, rol = 'Operador', estado = 'Activo' } = req.body;

    const userClean = String(usuario || '').trim();
    const passClean = String(clave || '').trim();

    if (!userClean || !passClean) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Verificar si ya existe el usuario
    const { data: existente } = await supabase
      .from('profiles')
      .select('id')
      .ilike('usuario', userClean)
      .maybeSingle();

    if (existente) {
      return res.status(409).json({ error: `El usuario '${userClean}' ya se encuentra registrado` });
    }

    // Encriptar contraseña con bcrypt (cost factor 10)
    const salt = await bcrypt.genSalt(10);
    const hashClave = await bcrypt.hash(passClean, salt);

    const nuevoPerfil = {
      usuario: userClean,
      clave: hashClave,
      nombre: String(nombre || userClean).trim(),
      email: String(email || '').trim(),
      rol: String(rol).trim(),
      estado: String(estado).trim(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(nuevoPerfil)
      .select('id, usuario, nombre, email, rol, estado, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:usuario - Actualizar datos o resetear clave (solo administradores)
usuariosRouter.put('/:usuario', requireAdmin, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const usuarioParam = req.params.usuario.trim();
    const { clave, nombre, email, rol, estado } = req.body;

    const actualizacion: Record<string, any> = {};

    if (nombre !== undefined) actualizacion.nombre = String(nombre).trim();
    if (email !== undefined) actualizacion.email = String(email).trim();
    if (rol !== undefined) actualizacion.rol = String(rol).trim();
    if (estado !== undefined) actualizacion.estado = String(estado).trim();

    // Si se envía una nueva clave, encriptarla con bcrypt
    if (clave && String(clave).trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      actualizacion.clave = await bcrypt.hash(String(clave).trim(), salt);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(actualizacion)
      .ilike('usuario', usuarioParam)
      .select('id, usuario, nombre, email, rol, estado, created_at')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: `Usuario '${usuarioParam}' no encontrado` });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usuarios/:usuario - Eliminar usuario (solo administradores)
usuariosRouter.delete('/:usuario', requireAdmin, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const usuarioParam = req.params.usuario.trim();
    const currentUser = (req as any).user as UserSession;

    // Impedir eliminarse a uno mismo
    if (currentUser && currentUser.usuario.toLowerCase() === usuarioParam.toLowerCase()) {
      return res.status(400).json({ error: 'No es posible eliminar tu propio usuario en sesión activa' });
    }

    // Impedir eliminar el administrador maestro del sistema
    if (usuarioParam.toLowerCase() === 'admin') {
      return res.status(403).json({ error: 'El usuario maestro Admin no puede ser eliminado' });
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .ilike('usuario', usuarioParam);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, message: `Usuario '${usuarioParam}' eliminado correctamente` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
