/**
 * Clean Architecture dependency rule, checked in CI (`npm run lint:arch`):
 * source code dependencies only point inwards  presentation → application → domain,
 * and infrastructure → application → domain. Only the composition root may see every layer.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment: "The domain holds business rules only: no other layer and no npm packages (React, Supabase, i18n…).",
      severity: "error",
      from: { path: "^src/domain" },
      to: { pathNot: ["^src/domain"] },
    },
    {
      name: "application-depends-on-domain-only",
      comment: "Use cases talk to the outside world through ports, never through adapters, UI code or packages.",
      severity: "error",
      from: { path: "^src/application" },
      to: { pathNot: ["^src/application", "^src/domain"] },
    },
    {
      name: "infrastructure-does-not-know-ui",
      comment: "Adapters implement ports; they must not import the presentation layer or the composition root.",
      severity: "error",
      from: { path: "^src/infrastructure" },
      to: { path: ["^src/presentation", "^src/composition-root"] },
    },
    {
      name: "presentation-does-not-know-adapters",
      comment: "The UI gets the application through ServicesProvider; it never imports Supabase or the demo backend.",
      severity: "error",
      from: { path: "^src/presentation" },
      to: { path: ["^src/infrastructure", "^src/composition-root", "^node_modules/@supabase"] },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "\\.(css|json)$" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default", "types"] },
  },
};
