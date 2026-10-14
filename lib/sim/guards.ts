import type { ReservationFailure } from "./types";

export function isReservationFailure(value: unknown): value is ReservationFailure {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === "reservation-exceeded" &&
    typeof record.agentId === "string" &&
    typeof record.turnIndex === "number" &&
    typeof record.requiredBytes === "number" &&
    typeof record.capacityBytes === "number"
  );
}
