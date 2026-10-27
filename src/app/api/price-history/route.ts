import { connection } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  await connection();

  const url = new URL(request.url);
  const origin = url.searchParams.get('origin');
  const destination = url.searchParams.get('destination');
  const departureDate = url.searchParams.get('departureDate');

  if (!origin || !departureDate) {
    return Response.json({ error: 'Faltan origin y departureDate' }, { status: 400 });
  }

  try {
    const supabase = createServerSupabaseClient();
    let query = supabase
      .from('price_history')
      .select('price_usd, observed_at, airline_code')
      .eq('origin', origin.toUpperCase())
      .eq('departure_date', departureDate)
      .order('observed_at', { ascending: false })
      .limit(30);

    if (destination) {
      query = query.eq('destination', destination.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error('price-history error', error);
      return Response.json({ error: 'No se pudo obtener el historial' }, { status: 502 });
    }

    return Response.json({ history: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('price-history failed', error);
    return Response.json({ error: 'Supabase no configurado' }, { status: 503 });
  }
}
