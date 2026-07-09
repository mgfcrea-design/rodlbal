import { getSupabaseClient } from './supabaseClient.js';

const supabase = getSupabaseClient();

export const supabaseRepo = {
  async getCierreEnProgreso() {
    const { data, error } = await supabase
      .from('cierres')
      .select('id, fecha, n_codigos')
      .eq('estado', 'en_progreso')
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, fecha: data.fecha, nCodigos: data.n_codigos } : null;
  },

  async crearCierre(fecha) {
    const { data, error } = await supabase
      .from('cierres')
      .insert({ fecha, estado: 'en_progreso' })
      .select('id, fecha')
      .single();
    if (error) throw error;
    return data;
  },

  async getCodigosGuardados(cierreId) {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('codigo')
      .eq('cierre_id', cierreId);
    if (error) throw error;
    return new Set(data.map((fila) => fila.codigo));
  },

  async guardarLecturas(cierreId, articulos) {
    if (articulos.length === 0) return;

    const { error: errorProductos } = await supabase.from('productos').upsert(
      articulos.map((a) => ({
        codigo: a.codigo,
        descripcion: a.descripcion,
        ultima_vez_visto: new Date().toISOString().slice(0, 10),
      })),
      { onConflict: 'codigo' }
    );
    if (errorProductos) throw errorProductos;

    const { error } = await supabase.from('lecturas_stock').upsert(
      articulos.map((a) => ({
        cierre_id: cierreId,
        codigo: a.codigo,
        cantidad_total: a.cantidadTotal,
        cantidad_barcelona: a.cantidadBarcelona,
        precio_neto: a.precioNeto,
      })),
      { onConflict: 'cierre_id,codigo' }
    );
    if (error) throw error;

    const { count, error: errorCount } = await supabase
      .from('lecturas_stock')
      .select('id', { count: 'exact', head: true })
      .eq('cierre_id', cierreId);
    if (errorCount) throw errorCount;

    const { error: errorUpdate } = await supabase
      .from('cierres')
      .update({ n_codigos: count })
      .eq('id', cierreId);
    if (errorUpdate) throw errorUpdate;
  },

  async getCodigosDeCierre(cierreId) {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('codigo')
      .eq('cierre_id', cierreId);
    if (error) throw error;
    return data.map((fila) => fila.codigo);
  },

  async getUltimoCierreFinalizado(antesDeCierreId) {
    const { data: cierreActual, error: errorActual } = await supabase
      .from('cierres')
      .select('fecha')
      .eq('id', antesDeCierreId)
      .single();
    if (errorActual) throw errorActual;

    const { data, error } = await supabase
      .from('cierres')
      .select('id, fecha')
      .eq('estado', 'finalizado')
      .lt('fecha', cierreActual.fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async finalizarCierre(cierreId) {
    const { error } = await supabase
      .from('cierres')
      .update({ estado: 'finalizado', finalizado_at: new Date().toISOString() })
      .eq('id', cierreId);
    if (error) throw error;
  },

  async listarCierres() {
    const { data, error } = await supabase
      .from('cierres')
      .select('id, fecha, estado, n_codigos')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async eliminarCierre(cierreId) {
    const { error } = await supabase.from('cierres').delete().eq('id', cierreId);
    if (error) throw error;
  },

  async listarProductosConLecturas() {
    const { data: productos, error: errorProductos } = await supabase
      .from('productos')
      .select('codigo, descripcion');
    if (errorProductos) throw errorProductos;

    const { data: lecturas, error: errorLecturas } = await supabase
      .from('lecturas_stock')
      .select('codigo, cantidad_total, cierres(fecha)');
    if (errorLecturas) throw errorLecturas;

    const lecturasPorCodigo = new Map();
    for (const l of lecturas) {
      const lista = lecturasPorCodigo.get(l.codigo) || [];
      lista.push({ fecha: l.cierres.fecha, cantidadTotal: l.cantidad_total });
      lecturasPorCodigo.set(l.codigo, lista);
    }

    return productos.map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      lecturas: lecturasPorCodigo.get(p.codigo) || [],
    }));
  },

  async buscarProducto(query) {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion')
      .or(`codigo.ilike.%${query}%,descripcion.ilike.%${query}%`)
      .limit(20);
    if (error) throw error;
    return data;
  },

  async getLecturasProducto(codigo) {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('cantidad_total, cantidad_barcelona, precio_neto, cierres(fecha)')
      .eq('codigo', codigo);
    if (error) throw error;
    return data
      .map((l) => ({
        fecha: l.cierres.fecha,
        cantidadTotal: l.cantidad_total,
        cantidadBarcelona: l.cantidad_barcelona,
        precioNeto: l.precio_neto,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  async getTodasLasLecturas() {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('codigo, cantidad_total, cantidad_barcelona, precio_neto, productos(descripcion), cierres(fecha)')
      .order('codigo');
    if (error) throw error;
    return data.map((l) => ({
      codigo: l.codigo,
      descripcion: l.productos.descripcion,
      fecha: l.cierres.fecha,
      cantidadTotal: l.cantidad_total,
      cantidadBarcelona: l.cantidad_barcelona,
      precioNeto: l.precio_neto,
    }));
  },
};
