import { connection } from "next/server";
import { parseFlightQuery, SearchQueryError } from "@/lib/search-params";
import { searchFlights } from "@/lib/services/flights";

export async function GET(request: Request) {
  await connection();

  try {
    const query = parseFlightQuery(new URL(request.url).searchParams);
    const response = await searchFlights(query);

    return Response.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof SearchQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error("Flight search failed", error);
    return Response.json(
      { error: "No se pudieron cargar los vuelos. Inténtalo de nuevo en unos minutos." },
      { status: 502 },
    );
  }
}
