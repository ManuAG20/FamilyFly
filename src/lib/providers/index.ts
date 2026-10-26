import { MockProvider } from "@/lib/providers/mock";
import type { FlightProvider, FlightProviderId } from "@/lib/providers/types";

let mockProvider: MockProvider | undefined;

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

  throw new Error(
    `El proveedor "${providerId}" se implementará en la Fase 2. Usa FLIGHT_PROVIDER=mock.`,
  );
}
