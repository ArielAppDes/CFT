import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const certificacionesRouter = Router();

// Función auxiliar para extraer URL de PDF y calcular estado dinámico
function procesarCertificadoParaCliente(cert: any) {
  if (!cert) return cert;

  let archivo_pdf_url = cert.archivo_pdf_url || '';
  let obs = String(cert.observaciones || '');

  // Si la URL del PDF está embebida en observaciones, extraerla
  const match = obs.match(/\[PDF_URL:\s*([^\]]+)\]/);
  if (match) {
    if (!archivo_pdf_url) {
      archivo_pdf_url = match[1].trim();
    }
    obs = obs.replace(/\[PDF_URL:\s*[^\]]+\]/, '').trim();
  }

  // Calcular estado dinámico
  let estado = 'Vigente';
  if (cert.tiene_vencimiento && cert.fecha_vencimiento) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fVenc = new Date(cert.fecha_vencimiento + 'T00:00:00');
    const diffDias = Math.ceil((fVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      estado = 'Vencido';
    } else if (diffDias <= 60) {
      estado = 'Por Vencer';
    } else {
      estado = 'Vigente';
    }
  }

  return {
    ...cert,
    archivo_pdf_url,
    observaciones: obs,
    estado: cert.estado || estado,
  };
}

// GET /api/certificaciones - Listar certificaciones
certificacionesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { legajo, proveedor_id } = req.query;

    let query = supabase.from('certificaciones_externas').select('*');

    if (legajo) query = query.eq('legajo', Number(legajo));
    if (proveedor_id) query = query.eq('proveedor_id', String(proveedor_id));

    const { data, error } = await query.order('id', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const certsProcesados = (data || []).map(procesarCertificadoParaCliente);
    return res.json({ data: certsProcesados });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/certificaciones/:id - Obtener certificación individual
certificacionesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;

    let query = supabase.from('certificaciones_externas').select('*');
    if (/^\d+$/.test(id)) {
      query = query.eq('id', Number(id));
    } else {
      query = query.eq('codigo', id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Certificación no encontrada' });

    return res.json({ data: procesarCertificadoParaCliente(data) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/certificaciones - Crear certificación
certificacionesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    // Embeber la URL del PDF en observaciones para garantizar persistencia sin alterar esquema SQL
    let observacionesFinal = String(body.observaciones || '').trim();
    const pdfUrl = body.archivo_pdf_url || '';
    if (pdfUrl && !observacionesFinal.includes('[PDF_URL:')) {
      observacionesFinal = observacionesFinal 
        ? `${observacionesFinal}\n\n[PDF_URL: ${pdfUrl}]` 
        : `[PDF_URL: ${pdfUrl}]`;
    }

    // Objeto limpio con las columnas EXACTAS existentes en Supabase PostgreSQL
    const registro = {
      codigo: String(body.codigo || `CERT-${Date.now()}`).trim(),
      alcance: String(body.alcance || '').trim(),
      categoria: String(body.categoria || '').trim(),
      subcategoria: String(body.subcategoria || '').trim(),
      legajo: body.legajo ? Number(body.legajo) : null,
      apellido_nombre: String(body.apellido_nombre || '').trim(),
      puesto: String(body.puesto || '').trim(),
      area_jefatura: String(body.area_jefatura || '').trim(),
      proveedor_id: String(body.proveedor_id || '').trim(),
      proveedor_ente: String(body.proveedor_ente || '').trim(),
      fecha_emision: body.fecha_emision || '',
      fecha_vencimiento: body.fecha_vencimiento || null,
      tiene_vencimiento: body.tiene_vencimiento !== false,
      archivo_pdf_nombre: String(body.archivo_pdf_nombre || '').trim(),
      observaciones: observacionesFinal,
    };

    const { data, error } = await supabase
      .from('certificaciones_externas')
      .insert(registro)
      .select()
      .single();

    if (error) {
      console.error('[Certificaciones API] Error al insertar en Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, data: procesarCertificadoParaCliente(data) });
  } catch (err: any) {
    console.error('[Certificaciones API] Excepción al crear certificado:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/certificaciones/:id - Actualizar certificación
certificacionesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.codigo !== undefined) actualizacion.codigo = String(body.codigo).trim();
    if (body.alcance !== undefined) actualizacion.alcance = String(body.alcance).trim();
    if (body.categoria !== undefined) actualizacion.categoria = String(body.categoria).trim();
    if (body.subcategoria !== undefined) actualizacion.subcategoria = String(body.subcategoria).trim();
    if (body.legajo !== undefined) actualizacion.legajo = body.legajo ? Number(body.legajo) : null;
    if (body.apellido_nombre !== undefined) actualizacion.apellido_nombre = String(body.apellido_nombre).trim();
    if (body.puesto !== undefined) actualizacion.puesto = String(body.puesto).trim();
    if (body.area_jefatura !== undefined) actualizacion.area_jefatura = String(body.area_jefatura).trim();
    if (body.proveedor_id !== undefined) actualizacion.proveedor_id = String(body.proveedor_id).trim();
    if (body.proveedor_ente !== undefined) actualizacion.proveedor_ente = String(body.proveedor_ente).trim();
    if (body.fecha_emision !== undefined) actualizacion.fecha_emision = body.fecha_emision;
    if (body.fecha_vencimiento !== undefined) actualizacion.fecha_vencimiento = body.fecha_vencimiento || null;
    if (body.tiene_vencimiento !== undefined) actualizacion.tiene_vencimiento = body.tiene_vencimiento !== false;
    if (body.archivo_pdf_nombre !== undefined) actualizacion.archivo_pdf_nombre = String(body.archivo_pdf_nombre).trim();

    // Gestionar observaciones y posible URL de Storage
    let obsFinal = body.observaciones !== undefined ? String(body.observaciones).trim() : null;
    const pdfUrl = body.archivo_pdf_url;
    if (pdfUrl) {
      const urlTag = `[PDF_URL: ${pdfUrl}]`;
      if (obsFinal !== null) {
        if (!obsFinal.includes('[PDF_URL:')) {
          obsFinal = obsFinal ? `${obsFinal}\n\n${urlTag}` : urlTag;
        }
      } else {
        const { data: prevCert } = await supabase.from('certificaciones_externas').select('observaciones').eq('id', id).maybeSingle();
        let prevObs = prevCert?.observaciones || '';
        if (!prevObs.includes('[PDF_URL:')) {
          obsFinal = prevObs ? `${prevObs}\n\n${urlTag}` : urlTag;
        }
      }
    }
    if (obsFinal !== null) {
      actualizacion.observaciones = obsFinal;
    }

    let query = supabase.from('certificaciones_externas').update(actualizacion);
    if (/^\d+$/.test(id)) {
      query = query.eq('id', Number(id));
    } else {
      query = query.eq('codigo', id);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      console.error('[Certificaciones API] Error al actualizar en Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data: procesarCertificadoParaCliente(data) });
  } catch (err: any) {
    console.error('[Certificaciones API] Excepción al actualizar:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/certificaciones/:id - Eliminar certificación
certificacionesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const id = req.params.id;

    let query = supabase.from('certificaciones_externas').delete();
    if (/^\d+$/.test(id)) {
      query = query.eq('id', Number(id));
    } else {
      query = query.eq('codigo', id);
    }

    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
