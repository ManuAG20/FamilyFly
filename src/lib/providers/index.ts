import { MockProvider } from "@/lib/providers/mock";
import { TravelpayoutsProvider } from "@/lib/providers/travelpayouts";
import type { FlightProvider, FlightProviderId } from "@/lib/providers/types";

let mockProvider: MockProvider | undefined;
let travelpayoutsProvider: TravelpayoutsProvider | undefined;

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

  throw new Error(
    'El proveedor "ignav" todavía no está disponible. Usa FLIGHT_PROVIDER=travelpayouts o mock.',
  );
}
