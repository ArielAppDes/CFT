import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSupabase } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'siga_cft_secure_jwt_token_key_2026';

export interface UserSession {
  id: number | string;
  usuario: string;
  nombre: string;
  email: string;
  rol: string;
  exp: number;
}

// Generador de tokens firmados
export function generateToken(user: { id: number | string; usuario: string; nombre: string; email: string; rol: string }): string {
  const payload: UserSession = {
    id: user.id,
    usuario: user.usuario,
    nombre: user.nombre || user.usuario,
    email: user.email || '',
    rol: user.rol || 'Operador',
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 días de validez
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

// Verificador de tokens firmados
export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
    if (signature !== expectedSignature) return null;

    const data: UserSession = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// Middleware de autenticación requerida
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ error: 'No autorizado: Token de sesión ausente' });
  }

  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido' });
  }

  (req as any).user = session;
  next();
}

// Middleware de verificación de rol (RBAC)
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      const user = (req as any).user as UserSession;
      if (!user) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      const rolUsuario = (user.rol || '').toLowerCase().trim();
      const rolesPermitidos = allowedRoles.map(r => r.toLowerCase().trim());

      // Si el rol es admin o coincide con los permitidos
      const esAdmin = rolUsuario === 'administrador' || rolUsuario === 'admin';
      const tienePermiso = esAdmin || rolesPermitidos.includes(rolUsuario);

      if (!tienePermiso) {
        return res.status(403).json({
          error: `Acceso denegado: Esta acción requiere perfil [${allowedRoles.join(', ')}]. Tu rol actual es '${user.rol}'.`
        });
      }

      next();
    });
  };
}

export const requireAdmin = requireRole('Administrador', 'Admin');
export const requireOperatorOrAdmin = requireRole('Administrador', 'Admin', 'Operador');

export const authRouter = Router();

// Endpoint: POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { usuario, clave } = req.body || {};
  const userClean = (usuario || '').trim();
  const passClean = (clave || '').trim();

  if (!userClean || !passClean) {
    return res.status(400).json({ error: 'Debe ingresar usuario y contraseña' });
  }

  try {
    // Verificación inmediata de credenciales maestras de Administrador (garantiza acceso siempre)
    if (userClean.toLowerCase() === 'admin' && passClean.toUpperCase() === 'CFT2026') {
      const token = generateToken({
        id: 1,
        usuario: 'Admin',
        nombre: 'Ariel Pizzutto',
        email: 'ariel.pizzutto@alumnos.udemm.edu.ar',
        rol: 'Administrador',
      });
      return res.json({
        success: true,
        token,
        user: {
          id: 1,
          usuario: 'Admin',
          nombre: 'Ariel Pizzutto',
          email: 'ariel.pizzutto@alumnos.udemm.edu.ar',
          rol: 'Administrador',
          estado: 'Activo',
        },
      });
    }

    const supabase = getSupabase();

    // Buscar usuario en PostgreSQL insensible a mayúsculas
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('usuario', userClean)
      .limit(1);

    if (error) {
      console.error('[API Auth] Error consultando Supabase:', error);
      return res.status(500).json({ error: 'Error al conectar con la base de datos' });
    }

    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (user.estado && user.estado.toLowerCase() === 'inactivo') {
      return res.status(403).json({ error: 'El usuario se encuentra inactivo. Comuníquese con el Administrador.' });
    }

    // Verificar contraseña (soporta texto plano existente en base o hash bcrypt)
    let passwordMatch = false;
    if (user.clave && user.clave.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(passClean, user.clave);
    } else {
      passwordMatch = user.clave === passClean || (user.clave && user.clave.toUpperCase() === passClean.toUpperCase());
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Emitir sesión
    const token = generateToken({
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre || user.usuario,
      email: user.email || '',
      rol: user.rol || 'Operador',
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
        estado: user.estado,
      },
    });
  } catch (err: any) {
    console.error('[API Auth] Error en login:', err);
    return res.status(500).json({ error: 'Error interno en el servidor de autenticación' });
  }
});

// Endpoint: GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No autenticado' });
  }

  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ authenticated: false, error: 'Token inválido o expirado' });
  }

  return res.json({
    authenticated: true,
    user: {
      id: session.id,
      usuario: session.usuario,
      nombre: session.nombre,
      email: session.email,
      rol: session.rol,
    },
  });
});

// Endpoint: POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  return res.json({ success: true, message: 'Sesión finalizada correctamente' });
});
