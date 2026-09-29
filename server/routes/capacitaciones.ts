import { Router, Request, Response } from 'express';
import { getSupabase } from '../db';

export const capacitacionesRouter = Router();

// GET /api/capacitaciones - Listar capacitaciones con filtros opcionales
capacitacionesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { estado, fecha, curso, id_cap, con_asistentes } = req.query;

    let query = supabase.from('capacitaciones').select('*').order('fecha', { ascending: false });

    if (id_cap) query = query.eq('id_cap', String(id_cap));
    if (estado) query = query.eq('estado', String(estado));
    if (fecha) query = query.eq('fecha', String(fecha));
    if (curso) query = query.ilike('nombre_curso', `%${String(curso)}%`);

    const { data: capacitaciones, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Si se solicitó con asistentes incluidos
    if (con_asistentes === 'true' && capacitaciones && capacitaciones.length > 0) {
      const ids = capacitaciones.map(c => c.id_cap);
      const { data: asistentes } = await supabase
        .from('asistentes')
        .select('*')
        .in('id_cap', ids);

      const mapaAsistentes = (asistentes || []).reduce((acc: any, asis: any) => {
        if (!acc[asis.id_cap]) acc[asis.id_cap] = [];
        acc[asis.id_cap].push(asis);
        return acc;
      }, {});

      const resultado = capacitaciones.map(c => ({
        ...c,
        asistentes: mapaAsistentes[c.id_cap] || []
      }));

      return res.json({ data: resultado });
    }

    return res.json({ data: capacitaciones || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/capacitaciones/:id_cap - Obtener capacitación individual con sus asistentes
capacitacionesRouter.get('/:id_cap', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const idCap = req.params.id_cap.trim();

    const { data: cap, error } = await supabase
      .from('capacitaciones')
      .select('*')
      .eq('id_cap', idCap)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!cap) return res.status(404).json({ error: `Capacitación ${idCap} no encontrada` });

    // Obtener lista de asistentes
    const { data: asistentes } = await supabase
      .from('asistentes')
      .select('*')
      .eq('id_cap', idCap)
      .order('apellido', { ascending: true });

    return res.json({
      data: {
        ...cap,
        asistentes: asistentes || []
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/capacitaciones - Registrar nueva capacitación (con asistentes opcionales)
capacitacionesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    if (!body.nombre_curso) {
      return res.status(400).json({ error: 'El nombre del curso es obligatorio' });
    }

    let idCap = (body.id_cap || '').trim();
    if (!idCap) {
      // Generar ID correlativo CAP-YYYY-NNNN
      const anio = new Date().getFullYear();
      const { data: ultimos } = await supabase
        .from('capacitaciones')
        .select('id_cap')
        .like('id_cap', `CAP-${anio}-%`)
        .order('id_cap', { ascending: false })
        .limit(1);

      let proxNum = 1;
      if (ultimos && ultimos[0] && ultimos[0].id_cap) {
        const match = ultimos[0].id_cap.match(/\d+$/);
        if (match) proxNum = parseInt(match[0], 10) + 1;
      }
      idCap = `CAP-${anio}-${String(proxNum).padStart(4, '0')}`;
    }

    const registroCap: Record<string, any> = {
      id_cap: idCap,
      programa: body.programa || '',
      nombre_curso: String(body.nombre_curso).trim(),
      estado: body.estado || 'Programado',
      tema: body.tema || '',
      fecha: body.fecha || new Date().toISOString().split('T')[0],
      hs_inicio: body.hs_inicio || '',
      hs_fin: body.hs_fin || '',
      lugar: body.lugar || '',
      centro: body.centro || '',
      instructor_1: body.instructor_1 || '',
      instructor_2: body.instructor_2 || '',
      observaciones: body.observaciones || '',
      clase_nro: Number(body.clase_nro) || 1,
      total_clases: String(body.total_clases || '1'),
      estado_tra: body.estado_tra || 'Pendiente',
      estado_sat: body.estado_sat || body.estado_encuesta || 'Pendiente',
      estado_encuesta: body.estado_encuesta || body.estado_sat || 'Pendiente',
    };

    const { data: capCreada, error: errorCap } = await supabase
      .from('capacitaciones')
      .upsert(registroCap, { onConflict: 'id_cap' })
      .select()
      .single();

    if (errorCap) return res.status(500).json({ error: errorCap.message });

    // Si se enviaron asistentes, guardarlos
    let asistentesInsertados: any[] = [];
    if (Array.isArray(body.asistentes) && body.asistentes.length > 0) {
      const listaAsistentes = body.asistentes.map((a: any) => ({
        id_cap: idCap,
        legajo: String(a.legajo || '').trim(),
        apellido: String(a.apellido || '').trim(),
        nombre: String(a.nombre || '').trim(),
        puesto: a.puesto || '',
        categoria: a.categoria || '',
        direccion: a.direccion || '',
        gerencia: a.gerencia || '',
        jefatura: a.jefatura || '',
        email: a.email || '',
        calificacion: a.calificacion !== undefined ? String(a.calificacion) : '',
        observaciones: a.observaciones || '',
      }));

      // Borrar anteriores para evitar duplicados en caso de reescritura
      await supabase.from('asistentes').delete().eq('id_cap', idCap);

      const { data: asisData, error: errAsis } = await supabase
        .from('asistentes')
        .insert(listaAsistentes)
        .select();

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/capacitaciones/:id_cap - Actualizar capacitación
capacitacionesRouter.put('/:id_cap', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const idCap = req.params.id_cap.trim();
    const body = req.body;

    const actualizacion: Record<string, any> = {};
    if (body.programa !== undefined) actualizacion.programa = body.programa;
    if (body.nombre_curso !== undefined) actualizacion.nombre_curso = body.nombre_curso;
    if (body.estado !== undefined) actualizacion.estado = body.estado;
    if (body.tema !== undefined) actualizacion.tema = body.tema;
    if (body.fecha !== undefined) actualizacion.fecha = body.fecha;
    if (body.hs_inicio !== undefined) actualizacion.hs_inicio = body.hs_inicio;
    if (body.hs_fin !== undefined) actualizacion.hs_fin = body.hs_fin;
    if (body.lugar !== undefined) actualizacion.lugar = body.lugar;
    if (body.centro !== undefined) actualizacion.centro = body.centro;
    if (body.instructor_1 !== undefined) actualizacion.instructor_1 = body.instructor_1;
    if (body.instructor_2 !== undefined) actualizacion.instructor_2 = body.instructor_2;
    if (body.observaciones !== undefined) actualizacion.observaciones = body.observaciones;
    if (body.clase_nro !== undefined) actualizacion.clase_nro = Number(body.clase_nro);
    if (body.total_clases !== undefined) actualizacion.total_clases = String(body.total_clases);
    if (body.estado_sat !== undefined) actualizacion.estado_sat = body.estado_sat;
    if (body.estado_encuesta !== undefined) actualizacion.estado_encuesta = body.estado_encuesta;
    if (body.estado_tra !== undefined) actualizacion.estado_tra = body.estado_tra;

    const { data, error } = await supabase
      .from('capacitaciones')
      .update(actualizacion)
      .eq('id_cap', idCap)
      .select()
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    // Si se enviaron asistentes, reemplazar
    if (Array.isArray(body.asistentes)) {
      await supabase.from('asistentes').delete().eq('id_cap', idCap);
      if (body.asistentes.length > 0) {
        const listaAsistentes = body.asistentes.map((a: any) => ({
          id_cap: idCap,
          legajo: String(a.legajo || '').trim(),
          apellido: String(a.apellido || '').trim(),
          nombre: String(a.nombre || '').trim(),
          puesto: a.puesto || '',
          categoria: a.categoria || '',
          direccion: a.direccion || '',
          gerencia: a.gerencia || '',
          jefatura: a.jefatura || '',
          email: a.email || '',
          calificacion: a.calificacion !== undefined ? String(a.calificacion) : '',
          observaciones: a.observaciones || '',
        }));
        await supabase.from('asistentes').insert(listaAsistentes);
      }
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/capacitaciones/:id_cap - Eliminar capacitación (asistentes se eliminan en cascada)
capacitacionesRouter.delete('/:id_cap', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const idCap = req.params.id_cap.trim();

    // Eliminar asistentes y capacitación
    await supabase.from('asistentes').delete().eq('id_cap', idCap);
    const { error } = await supabase.from('capacitaciones').delete().eq('id_cap', idCap);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: `Capacitación ${idCap} eliminada` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
