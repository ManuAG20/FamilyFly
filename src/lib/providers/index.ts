import { IgnavProvider } from "@/lib/providers/ignav";
import { MockProvider } from "@/lib/providers/mock";
import { TravelpayoutsProvider } from "@/lib/providers/travelpayouts";
import type { FlightProvider, FlightProviderId } from "@/lib/providers/types";

let mockProvider: MockProvider | undefined;
let travelpayoutsProvider: TravelpayoutsProvider | undefined;
let ignavProvider: IgnavProvider | undefined;

export function getConfiguredProviderId(): FlightProviderId {
  const configured = process.env.FLIGHT_PROVIDER?.toLowerCase();

  if (configured === "travelpayouts" || configured === "ignav") {
    return configured;
  }

  return "mock";
}

export function getFlightProvider(): FlightProvider {
  const providerId = getConfiguredProviderId();

  if (providerId === "mock") {
    mockProvider ??= new MockProvider();
    return mockProvider;
  }

  if (providerId === "travelpayouts") {
    travelpayoutsProvider ??= new TravelpayoutsProvider();
    return travelpayoutsProvider;
  }

  if (providerId === "ignav") {
    ignavProvider ??= new IgnavProvider();
    return ignavProvider;
  }

  throw new Error(
    'Proveedor de vuelos no configurado correctamente. Usa FLIGHT_PROVIDER=mock, travelpayouts o ignav.',
  );
}
