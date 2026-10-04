# ADR 0001: Clean Architecture with four layers

**Status:** Accepted · October 2026

## Context

The first version of ARMEN Care put business rules inside React components and in a single `Api` object that the UI called directly. For example, the "signature required" rule lived in the work-order dialog, module-replacement checks lived partly in the dialog and partly in each backend, and the health thresholds were spread across UI helpers. The app has two interchangeable backends (Supabase and an in-browser demo), and the alert engine must also run in a Deno Edge Function. Rules were hard to test without rendering React or starting a database.

## Decision

Organise the code in four layers with dependencies pointing inwards:

* **Domain:** entities and pure business rules, no imports outside the domain.
* **Application:** use cases plus small port interfaces (interface segregation).
* **Infrastructure:** adapters (Supabase, demo, simulator, Web Push, clock) that implement the ports.
* **Presentation:** React UI that receives the application through a context provider.

A single composition root picks the adapter at start-up. Business rules raise `DomainError` with stable codes; the UI translates them (hy / en / ru).

Boundaries are enforced with dependency-cruiser in CI.

## Consequences

* Business rules are unit-tested in milliseconds (75 tests at the time of writing).
* Swapping or adding a backend (for example a .NET API later) means writing one adapter; the UI and use cases stay as they are.
* The alert engine is shared byte-for-byte between browser and Edge Function.
* There is some extra wiring (ports, `createAppServices`). We keep it small with the read-side shortcut in ADR 0002.
