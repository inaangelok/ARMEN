# ADR 0002: Queries go straight to read ports, commands go through use cases

**Status:** Accepted · October 2026

## Context

Most screens only list or show data (stations, alerts, telemetry). Wrapping each read in its own use case class would add about twenty files that only forward a call.

## Decision

`createAppServices` exposes two groups:

* `queries`: thin pass-throughs to the read ports, used by React Query hooks in `presentation/hooks/data.ts`.
* `commands`: use cases for every write. They validate with domain rules before any adapter is called.

Derived read models that involve rules (the fleet overview, health labels, remaining life) are computed by domain functions, not in components.

## Consequences

* No business rule can be skipped on a write, because the UI has no other way to write.
* Reads stay simple and cache-friendly.
* If a read ever needs rules (for example filtering by permission in the app), it gets its own use case.
