import { connection } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getFlightProvider } from '@/lib/providers';

function checkAuth(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-cron-secret') ?? request.headers.get('authorization')?.replace('Bearer ', '');
  return header === secret;
}

export async function GET(request: Request) {
  await connection();
  if (!checkAuth(request)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: watchlist, error } = await supabase.from('watchlist').select('*').eq('active', true);

    if (error) {
      console.error('alerts watchlist error', error);
      return Response.json({ error: 'Error' }, { status: 502 });
    }

    const provider = getFlightProvider();
    const results = [];

    for (const item of watchlist ?? []) {
      try {
        const offers = await provider.searchFlights({
          origin: item.origin,
          destination: item.destination,
          departureDate: item.departure_date ?? new Date().toISOString().slice(0, 10),
          returnDate: item.return_date,
          passengers: 1,
          maxStops: null,
        });

        const cheapest = offers.sort((a, b) => a.price.amount - b.price.amount)[0];
        if (cheapest && item.max_price_usd && cheapest.price.amount <= Number(item.max_price_usd)) {
          results.push({ watchlistId: item.id, price: cheapest.price.amount, deepLink: cheapest.deepLink });
          await sendTelegram(item.user_id, `Precio bajo: ${item.origin}-${item.destination} ${cheapest.price.amount} USD\n${cheapest.deepLink}`);
        }
      } catch (err) {
        console.error('alert check failed', err);
      }
    }

    return Response.json({ checked: watchlist?.length ?? 0, alerts: results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('alerts run failed', error);
    return Response.json({ error: 'Supabase no configurado' }, { status: 503 });
  }
}

async function sendTelegram(userId: string | null, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = userId ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error('telegram send failed', err);
  }
}
