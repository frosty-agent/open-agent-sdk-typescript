# Hardening baseline

## Provenance

- **Fork:** <https://github.com/frosty-agent/open-agent-sdk-typescript>
- **Upstream:** <https://github.com/codeany-ai/open-agent-sdk-typescript>
- **Upstream commit used as the fork point:** `366438d2ef94775a4515301bcf8a58ab866c1731` (`fix: subagent inherits parent agent's provider, model, and apiType`)
- **Upstream default branch:** `main`
- **Upstream history inspected:** three commits, from 2026-04-01 through 2026-04-03 UTC-equivalent commit dates.
- **License:** MIT (as declared by the upstream repository and package manifest).

The local `upstream` remote is configured to the upstream repository; `origin` is the `frosty-agent` fork.

## Release/provenance discrepancy

At the time this baseline was created, the upstream GitHub repository had **no Git tags and no GitHub releases**, while its committed `package.json` declares version `0.2.0`. The npm registry entry for `@codeany/open-agent-sdk` reports version `0.2.1` (with published versions `0.1.0`, `0.2.0`, and `0.2.1`). Therefore, a release cannot be mapped from a Git tag/release to the checked-out upstream commit.

The inherited `package-lock.json` also identified its root package as `@anthropic-ai/claude-agent-sdk@0.1.0`, which did not match the repository's `package.json` (`@codeany/open-agent-sdk@0.2.0`). It has been regenerated so its root metadata matches the package manifest.

## Reproducible dependency baseline

Runtime and development dependencies in `package.json` are exact versions, and `package-lock.json` is committed. `.npmrc` sets `save-exact=true` and `engine-strict=true`; supported Node.js is `>=18.0.0`.

Use:

```sh
npm ci
npm run build
npm test
npm audit
```

`npm test` is a real, offline unit-test baseline using Node's built-in test runner against the built output. It covers token accounting/model limits, compaction thresholds, message normalization and orphan-tool-result handling, retry classification/recovery, and file-cache LRU/clone behavior. It does not invoke an LLM or require API credentials. The former `test` script invoked `examples/01-simple-query.ts`; it has been preserved as `npm run test:examples` because examples are integration demonstrations, not a deterministic test suite.

## Audit results

Initial `npm ci` audit result: **7 vulnerabilities** — 1 low, 4 moderate, 2 high. The vulnerable transitive packages reported were `@hono/node-server`, `esbuild`, `express-rate-limit`/`ip-address`, `fast-uri`, `hono`, and `qs`, all reached through `@modelcontextprotocol/sdk`'s dependency graph.

After updating the lockfile with `npm audit fix --package-lock-only` (without a forced major upgrade) and pinning direct dependencies: **0 vulnerabilities** from `npm audit`.

Audit results are time-sensitive. Re-run `npm audit` during dependency updates and before release.
