# Design: `export defer` Namespace Object Evaluation Triggers

**Date:** 2026-04-15
**Issue:** [tc39/test262#5010](https://github.com/tc39/test262/issues/5010) — Namespace Object sub-section of "Load and Evaluation"
**Proposal:** [tc39/proposal-deferred-reexports](https://tc39.es/proposal-deferred-reexports/)
**Scope:** Which operations performed on the namespace object of a module consuming an `export defer` barrel do (or do not) trigger evaluation of the deferred source module.

## Overview

When a consumer does `import * as ns from "./barrel.js"` over a barrel that re-exports a binding `x` with `export defer { x } from "./dep.js"`, the barrel is loaded and evaluated eagerly (standard module graph semantics). The deferred source module `dep.js` is loaded at link time but its evaluation is gated on a specific subset of namespace operations touching `x`. This PR adds the matrix of tests that verify the trigger/no-trigger classification per operation.

## Goals

- Cover every operation on a module namespace exotic object and classify whether it triggers evaluation of the deferred source module when applied to a deferred-reexported name.
- Reuse existing `src/import-defer/` test-generation infrastructure via a sibling `src/export-defer/` tree (self-contained, matches the per-feature convention in `src/`).
- Mirror the directory layout and conventions of `test/language/import/import-defer/evaluation-triggers/`.

## Non-goals

- No `import defer * as ns` form. The interaction between `import defer` and `export defer` is a distinct semantic (both the barrel and the source are deferred) and belongs in its own PR.
- No `import { x } from "./barrel"` direct-binding form. Direct imports of a deferred re-exported name trigger evaluation at the barrel's load time (or at the entrypoint's first synchronous evaluation tick), which is a load-and-evaluation concern already covered by the sibling PR — not a namespace-object concern.
- No `export defer * as ns from "mod"` (deferred namespace re-export). Separate future PR.
- No async / top-level-await interaction.
- No error cases beyond the normal completion of each operation (error propagation has its own plan items).

## Scope — import form and fixture tracking

**Single import form:** `import * as ns from "./barrel_FIXTURE.js"`, where the barrel contains `export defer { exported } from "./dep_FIXTURE.js"` (or, for the `then` variants, `export defer { then } from "./dep-then_FIXTURE.js"`).

**Dual tracking:** `globalThis.evaluations` captures both `'barrel'` and `'dep'` pushes. Every test asserts the state **before** the operation (`['barrel']` — barrel eager, dep not yet) and **after** the operation (either `['barrel']` for the `ignore` bucket, or `['barrel', 'dep']` for the `trigger` bucket).

## Architecture

### Test location

```
test/language/export/export-defer/evaluation-triggers/
```

Sibling of `test/language/export/export-defer/syntax/` and `.../load-and-evaluation/`. Mirrors `test/language/import/import-defer/evaluation-triggers/`.

### Generated — template sources

New sibling tree under `src/`:

```
src/export-defer/
  # case files — one per operation. Bucket-agnostic (each just performs the op).
  get.case
  get-in-prototype.case
  super-get.case
  hasProperty.case
  hasProperty-in-prototype.case
  getOwnProperty.case
  defineOwnProperty.case
  delete.case
  set-string-exported.case
  set-string-not-exported.case
  super-property-set-exported.case
  super-property-define.case
  getPrototypeOf.case
  setPrototypeOf.case
  isExtensible.case
  preventExtensions.case
  ownPropertyKeys.case
  ownPropertyKey-names.case
  ownPropertyKeys-symbols.case
  private-name-access.case

  # "does trigger" templates
  trigger/
    trigger.template                # name-agnostic trigger (e.g. ownPropertyKeys)
  trigger-on-possible-export/
    string-exported.template        # body uses an exported-name key
    then-exported.template          # body uses "then" when it IS exported

  # "does not trigger" templates
  ignore/
    ignore.template                 # name-agnostic no-trigger
  ignore-on-possible-export/        # (naming follows src/import-defer convention)
    string-not-exported.template    # body uses a not-exported name → no trigger
    symbol-other.template
    symbol-toStringTag.template
    then-not-exported.template      # body uses "then" when NOT exported → no trigger
```

The `.case` files are copied verbatim from `src/import-defer/` — their bodies (`/*{ body }*/` substitutions) are identical. Only the templates change, because the surrounding setup and assertions differ.

### Template body (illustrative)

`src/export-defer/trigger/trigger.template`:

```js
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
path: language/export/export-defer/evaluation-triggers/trigger-
name: triggers evaluation
esid: sec-module-namespace-exotic-objects
flags: [module]
features: [deferred-reexports]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ['barrel'],
  "barrel evaluates eagerly; deferred source does not evaluate on import");

/*{ body }*/

assert.compareArray(globalThis.evaluations, ['barrel', 'dep'],
  "operation on deferred-reexported name triggers source evaluation");
```

`src/export-defer/ignore/ignore.template` has the same setup; the final assertion is `['barrel']` (unchanged).

`src/export-defer/trigger-on-possible-export/string-exported.template` adds `var key = "exported";` before `/*{ body }*/` and uses the `trigger` assertion pair. The `then-exported.template` variant imports from `barrel-then_FIXTURE.js` and sets `var key = "then";`.

`src/export-defer/ignore-on-possible-export/string-not-exported.template` adds `var key = "notExported";` and uses the `ignore` assertion pair. `then-not-exported.template` imports from `barrel_FIXTURE.js` (where `then` is not exported) with `var key = "then";`.

### Fixtures (under `test/language/export/export-defer/evaluation-triggers/`)

```
setup_FIXTURE.js:
  globalThis.evaluations = [];

dep_FIXTURE.js:
  globalThis.evaluations.push('dep');
  export let exported = 3;

dep-then_FIXTURE.js:
  globalThis.evaluations.push('dep');
  export let then = 3;

barrel_FIXTURE.js:
  globalThis.evaluations.push('barrel');
  export defer { exported } from "./dep_FIXTURE.js";

barrel-then_FIXTURE.js:
  globalThis.evaluations.push('barrel');
  export defer { then } from "./dep-then_FIXTURE.js";
```

All fixtures end in `_FIXTURE.js`, push to `globalThis.evaluations`, and do not use harness bindings.

## Per-operation classification

**Authoritative classification** (verified against <https://tc39.es/proposal-deferred-reexports/> and its base <https://tc39.es/proposal-defer-import-eval/> on 2026-04-15).

Key spec facts used to derive the table:

- The `proposal-deferred-reexports` spec edits **only** `[[Get]]` (§10.4.6.8). It inserts a new step after step 4: *"If `m` is a Cyclic Module Record and `m.GetOptionalIndirectExportsModuleRequests(« P »)` is not empty, then Perform `? EvaluateModuleSync(m, « P »)`."* This is the sole insertion point of `EvaluateModuleSync` in the module-namespace internal methods for a deferred re-export.
- The namespace over the barrel (`ns` in our tests) is an **ordinary** namespace, created via `import * as ns from "./barrel.js"`. Therefore `ns.[[Deferred]]` is **false** (set by `ModuleNamespaceCreate` when `phase` is `evaluation`; see proposal-defer-import-eval §10.4.6.12).
- Because `ns.[[Deferred]]` is false: (a) `IsSymbolLikeNamespaceKey(P, ns)` (proposal-defer-import-eval §10.4.6.13) returns false for every String `P`, including `"then"`; and (b) `GetModuleExportsList(ns)` (proposal-defer-import-eval §10.4.6.14) returns `ns.[[Exports]]` immediately (its evaluation branch is gated on `[[Deferred]] = true`).
- `[[GetOwnProperty]]` (§10.4.6.5) step 4 performs `? O.[[Get]](P, O)` when the name is in `[[Exports]]`. So any operation that routes through `[[GetOwnProperty]]` for a deferred-reexported name transitively reaches the `[[Get]]` insertion above.
- `[[DefineOwnProperty]]` (§10.4.6.6) step 2 performs `? O.[[GetOwnProperty]](P)` when the key is an exported string, routing to `[[Get]]`.
- `[[Delete]]` (§10.4.6.10) does **not** call `[[GetOwnProperty]]` or `[[Get]]`: after the `IsSymbolLikeNamespaceKey` short-circuit, it consults `GetModuleExportsList` and returns `false` without touching the binding. For the barrel's ordinary namespace, `GetModuleExportsList` is itself a no-op (see above). Therefore `[[Delete]]` of a deferred-reexported name does **not** trigger `EvaluateModuleSync`.
- `[[HasProperty]]`, `[[OwnPropertyKeys]]`, `[[Set]]`, `[[GetPrototypeOf]]`, `[[SetPrototypeOf]]`, `[[IsExtensible]]`, `[[PreventExtensions]]`, and symbol-key access all either short-circuit before consulting `ResolveExport`/`[[Get]]`, return an ordinary primitive, or go through `GetModuleExportsList` which is a no-op for an ordinary namespace.

Every operation is applied with the namespace `ns` as the target. The "deferred-exported name" column is the behavior when the property key is `"exported"` (a deferred re-exported name); the "other" column is for symbol keys, non-exported string keys, and the like.

**`trigger/` bucket — triggers `EvaluateModuleSync` on `dep`:**

| Operation | Surface syntax | Spec citation | Why it triggers |
|-----------|----------------|---------------|-----------------|
| `[[Get]]` (exported key) | `ns.exported`, `ns[key]` | proposal-deferred-reexports §10.4.6.8, step 5 (the `GetOptionalIndirectExportsModuleRequests` → `EvaluateModuleSync` insertion) | Direct call to `EvaluateModuleSync(m, « P »)`. |
| `[[Get]]` via prototype | `Object.create(ns).exported` | §10.4.6.8 step 5 (same trap) | `OrdinaryGet` on the child walks the prototype chain and reaches `ns.[[Get]]`. |
| `[[Get]]` via super | `class C { m() { return super.x } }` with `C.prototype.__proto__ = ns` | §10.4.6.8 step 5 (same trap) | Super-property access routes to `ns.[[Get]]` with adjusted receiver. |
| `[[Get]]` of `"then"` when exported | `ns.then` where barrel has `export defer { then } from ...` | §10.4.6.8 step 5; proposal-defer-import-eval §10.4.6.13 step 2 (short-circuit gated on `[[Deferred]] = true`) | `ns` is an ordinary namespace (`[[Deferred]]` false), so `IsSymbolLikeNamespaceKey("then", ns)` returns false and `"then"` flows to the exports-list path. |
| `[[GetOwnProperty]]` (exported key) | `Object.getOwnPropertyDescriptor(ns, "exported")` | proposal-defer-import-eval §10.4.6.5 step 4 (`? O.[[Get]](P, O)`) → §10.4.6.8 step 5 | Descriptor's `[[Value]]` is populated via `[[Get]]`. |
| `[[DefineOwnProperty]]` (exported key) | `Object.defineProperty(ns, "exported", desc)` | proposal-defer-import-eval §10.4.6.6 step 2 (`? O.[[GetOwnProperty]](P)`) → §10.4.6.5 step 4 → §10.4.6.8 step 5 | Validation against current descriptor forces `[[GetOwnProperty]]` → `[[Get]]`. The proposal-defer-import-eval editorial note on §10.4.6.6 step 3 confirms: *"If `O.[[Deferred]]` is true, the step above will ensure that the module is evaluated"* — the same wiring applies to a deferred re-export through `GetOptionalIndirectExportsModuleRequests`. |

**`ignore/` bucket — does NOT trigger evaluation:**

| Operation | Surface syntax | Spec citation | Why it does not trigger |
|-----------|----------------|---------------|-------------------------|
| `[[HasProperty]]` (any key) | `"exported" in ns`, `"notExported" in ns` | proposal-defer-import-eval §10.4.6.7 | Consults `GetModuleExportsList(O)` (no-op for ordinary `ns`) and the exports list; never calls `EvaluateModuleSync`. |
| `[[OwnPropertyKeys]]` | `Reflect.ownKeys(ns)`, `Object.getOwnPropertyNames(ns)`, `Object.getOwnPropertySymbols(ns)` | proposal-defer-import-eval §10.4.6.11 | Returns `GetModuleExportsList(O)` concatenated with symbol keys; `GetModuleExportsList` is a no-op for ordinary `ns`. |
| `[[Set]]` (any key, exported or not) | `ns.exported = 1`, `ns.notExported = 1` | proposal-defer-import-eval §10.4.6.9 | Single step: `Return false`. Never consults exports or `[[Get]]`. |
| Super-property `[[Set]]` of exported | `super.exported = 1` with `ns` as home prototype | §10.4.6.9 | Same — routes to `[[Set]]` which returns `false`. |
| `[[Delete]]` (exported key) | `delete ns.exported` | proposal-defer-import-eval §10.4.6.10 | Step 1 `IsSymbolLikeNamespaceKey` is false for string `"exported"` on an ordinary namespace; step 2 `GetModuleExportsList` is a no-op; step 3 returns `false` since `"exported"` is in `ns.[[Exports]]`. **No call to `[[GetOwnProperty]]` or `[[Get]]`.** |
| Symbol key access (other) | `ns[Symbol.iterator]` | proposal-defer-import-eval §10.4.6.13 step 1 | `IsSymbolLikeNamespaceKey` returns true for any Symbol; traps short-circuit to `Ordinary*`. |
| `Symbol.toStringTag` | `ns[Symbol.toStringTag]` | §10.4.6.13 step 1 + §10.4.6.12 (last step creates a data property) | Short-circuits to `OrdinaryGet`, which reads the own data property installed at namespace creation. |
| `[[Get]]` of `"then"` NOT exported | `ns.then` where `then` is not exported | proposal-deferred-reexports §10.4.6.8 step 3 (`If exports does not contain P, return undefined.`) | `"then"` not in exports → early return before reaching step 5. |
| Any op on a not-exported name | `ns.notExported`, `Object.getOwnPropertyDescriptor(ns, "notExported")`, `delete ns.notExported`, `Object.defineProperty(ns, "notExported", …)` | §10.4.6.5 step 3; §10.4.6.8 step 3; §10.4.6.10 step 3 (which returns `true` when not in exports, without side effects) | Name not in exports → each trap short-circuits before reaching the `EvaluateModuleSync` insertion in `[[Get]]`. |
| `[[GetPrototypeOf]]` | `Object.getPrototypeOf(ns)` | ECMA-262 §10.4.6.1 | Unchanged by the proposal; returns `null`. |
| `[[SetPrototypeOf]]` | `Object.setPrototypeOf(ns, null)` / non-null | ECMA-262 §10.4.6.2 | Unchanged; `SetImmutablePrototype` — no exports consultation. |
| `[[IsExtensible]]` | `Reflect.isExtensible(ns)` | ECMA-262 §10.4.6.3 | Unchanged; returns `false`. |
| `[[PreventExtensions]]` | `Object.preventExtensions(ns)` | ECMA-262 §10.4.6.4 | Unchanged; returns `true`. |
| Private-name access | `#x in ns` (where feasible) | N/A (private brand check on `ns` fails before any namespace trap runs) | Short-circuits. |

### Change from the pre-verification working classification

- `[[Delete]]` on a deferred-reexported name was working-classified as `trigger` with a caveat. Spec verification reclassifies it to `ignore`: proposal-defer-import-eval §10.4.6.10 does not call `[[GetOwnProperty]]` or `[[Get]]`, and the deferred-reexports proposal does not edit `[[Delete]]`. The `delete.case` file must therefore be mapped to `ignore/ignore-on-possible-export/string-exported.template` (not to `trigger-on-possible-export`).
- `[[DefineOwnProperty]]` on a deferred-reexported name is confirmed as `trigger`: the base chain `[[DefineOwnProperty]]` step 2 → `[[GetOwnProperty]]` step 4 → `[[Get]]` — combined with the deferred-reexports edit to `[[Get]]` — forces evaluation. No proposal-level short-circuit was added.
- All other rows stand.

### `then` special-case pair

Two dedicated test pairs — both necessary because the "symbol-like key" short-circuit in `[[Get]]` exists specifically so that `import()` promise-unwrapping doesn't accidentally trigger evaluation:

- `trigger-then-exported-get.js` — `then` IS a deferred-reexported name. `ns.then` DOES trigger. (Barrel: `export defer { then } from "./dep-then_FIXTURE.js"`.)
- `ignore-not-exported-then-get.js` — `then` is NOT an exported name. `ns.then` does NOT trigger. (Barrel: the ordinary `barrel_FIXTURE.js`.)

## Expected output file list

Roughly the same set the `import-defer` side produces, reshuffled per the buckets above. Final names come from template `path:` + case base-name. Rough count: ~25 generated files in `test/language/export/export-defer/evaluation-triggers/`, plus the 5 fixture files.

Files that were `ignore-*` for `import-defer` but become `trigger-*` here:
- `getOwnProperty`, `defineOwnProperty` when the key is exported.

Files that were `trigger-*` for `import-defer` but become `ignore-*` here:
- `hasProperty`, `hasProperty-in-prototype`, `ownPropertyKeys`, `ownPropertyKey-names`.

Files unchanged in bucket:
- Symbol keys, `set-*`, `getPrototypeOf`, `setPrototypeOf`, `isExtensible`, `preventExtensions`, private-name-access, `delete` → remain in `ignore`. (`delete.case` stays in the `ignore` bucket because proposal-defer-import-eval §10.4.6.10 does not reach `[[GetOwnProperty]]`/`[[Get]]` and the deferred-reexports proposal does not edit `[[Delete]]`.)
- `get`, `get-in-prototype`, `super-get`, `then-exported-get` → remain in `trigger`.

## Frontmatter conventions

- `flags: [module, generated]`
- `features: [deferred-reexports]`
- `includes: [compareArray.js]`
- `esid: sec-module-namespace-exotic-objects` (or the proposal-specific anchor if more precise)
- `info:` block quotes the relevant spec steps (the proposal's edits to `[[Get]]` / `[[GetOwnProperty]]` / etc. plus `GetModuleExportsList` and `IsSymbolLikeNamespaceKey`) so the reviewer can verify the classification without leaving the file.
- Copyright: `2026 Igalia, S.L.`

## Feature flag

Reuses `deferred-reexports` (already in `features.txt`). No new additions.

## Build and lint order

Linting requires the generated test files to exist (templates + `.case` files alone do not lint; the linter operates on the fully assembled test files under `test/`). So the development loop is:

1. Edit `src/export-defer/**` (templates, `.case` files) and/or fixtures under `test/language/export/export-defer/evaluation-triggers/`.
2. Run `./make.py` to regenerate tests into `test/language/export/export-defer/evaluation-triggers/`.
3. Run the linter inside pyvenv: `python tools/lint/lint.py --exceptions lint.exceptions test/language/export/export-defer/evaluation-triggers/ src/export-defer/`.
4. Run the harness self-tests.

Never hand-edit the generated files; always round-trip through `./make.py`.

## Linting and test262 conventions

- All fixture filenames end in `_FIXTURE.js` and do not use harness bindings.
- Files end in a newline.
- `includes` in flow style.
- Lint command (inside pyvenv, after `./make.py`): `python tools/lint/lint.py --exceptions lint.exceptions test/language/export/export-defer/evaluation-triggers/ src/export-defer/`.

## PR assembly

Commit structure (so the reviewer can see template and generated output separately):

1. **Commit 1** — `src/export-defer/**` (templates + `.case` files) and the hand-written `*_FIXTURE.js` files under `test/language/export/export-defer/evaluation-triggers/`.
2. **Commit 2** — the generated test files under `test/language/export/export-defer/evaluation-triggers/` (output of `./make.py`).

This inverts the general test262 convention noted in `CLAUDE.md` ("PRs should not include generated test outputs — they are built from `src/` after merge"): for this PR we include the generated output in its own commit so reviewers can verify the matrix and the per-operation classifications without running `./make.py` themselves. Mention this explicitly in the PR description.

Verification during development: run `./make.py` locally between template edits, lint the generated output, run the harness self-tests.
