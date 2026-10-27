import { connection } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  await connection();

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('watchlist get error', error);
      return Response.json({ error: 'No se pudo obtener la lista' }, { status: 502 });
    }

    return Response.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('watchlist get failed', error);
    return Response.json({ error: 'Supabase no configurado' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  await connection();

  try {
    const body = await request.json();
    const { origin, destination, departureDate, returnDate, maxPriceUsd } = body ?? {};

    if (!origin || !destination) {
      return Response.json({ error: 'Faltan origin y destination' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('watchlist')
      .insert({
        origin: String(origin).toUpperCase(),
        destination: String(destination).toUpperCase(),
        departure_date: departureDate || null,
        return_date: returnDate || null,
        max_price_usd: maxPriceUsd ? Number(maxPriceUsd) : null,
        active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('watchlist post error', error);
      return Response.json({ error: 'No se pudo guardar' }, { status: 502 });
    }

    return Response.json({ item: data }, { status: 201 });
  } catch (error) {
    console.error('watchlist post failed', error);
    return Response.json({ error: 'Supabase no configurado' }, { status: 503 });
  }
}
