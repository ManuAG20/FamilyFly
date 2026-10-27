import { connection } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;

  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('watchlist').update({ active: false }).eq('id', id);

    if (error) {
      console.error('watchlist delete error', error);
      return Response.json({ error: 'No se pudo eliminar' }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('watchlist delete failed', error);
    return Response.json({ error: 'Supabase no configurado' }, { status: 503 });
  }
}
