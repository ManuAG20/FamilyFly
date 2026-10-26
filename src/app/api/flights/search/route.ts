import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { ProviderError, type ProviderErrorCode } from "@/lib/providers/errors";
import { parseFlightQuery, SearchQueryError } from "@/lib/search-params";
import { searchFlights } from "@/lib/services/flights";

const STATUS_BY_CODE: Record<ProviderErrorCode, number> = {
  config: 503,
  auth: 502,
  rate_limit: 429,
  timeout: 504,
  upstream: 502,
  invalid_response: 502,
};

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

    const t = getDictionary();

    if (error instanceof ProviderError) {
      const messages: Record<ProviderErrorCode, string> = {
        config: t.results.providerErrors.config,
        auth: t.results.providerErrors.auth,
        rate_limit: t.results.providerErrors.rateLimit,
        timeout: t.results.providerErrors.timeout,
        upstream: t.results.providerErrors.upstream,
        invalid_response: t.results.providerErrors.invalidResponse,
      };

      console.error("Flight provider failed", error.code, error.message);
      return Response.json(
        { error: messages[error.code] },
        {
          status: STATUS_BY_CODE[error.code],
          headers: error.code === "rate_limit" ? { "Retry-After": "60" } : undefined,
        },
      );
    }

    console.error("Flight search failed", error);
    return Response.json({ error: t.results.errorText }, { status: 502 });
  }
}
