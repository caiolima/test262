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

The table below is this spec's **working classification**. Step 1 of the implementation plan is to verify each row against the `proposal-deferred-reexports` spec edits to the module-namespace-exotic-object internal methods, plus the clarifications in [issue #5010](https://github.com/tc39/test262/issues/5010) and its comments. If the spec verification reclassifies a row, the affected `.case` file's template mapping is adjusted (case → `trigger/` vs. `ignore/`) before generation. The set of `.case` files does not change.

**Rows that warrant extra care during verification** (because the baseline ECMA-262 module-namespace algorithm does not obviously reach `[[Get]]`, yet we classify them as triggers):

- `[[Delete]]` on a deferred-exported name — baseline `[[Delete]]` returns `false` when the name is in `[[Exports]]` without calling `[[GetOwnProperty]]`. Classified as `trigger` per the brainstorm discussion; confirm the proposal amends this path (or otherwise reclassify to `ignore`).
- `[[DefineOwnProperty]]` on a deferred-exported name — routes through `[[GetOwnProperty]]` → `[[Get]]`, so this should trigger; verify no proposal-level short-circuit was added.

Every operation is applied with the namespace `ns` as the target. The "deferred-exported name" column is the behavior when the property key is `"exported"` (a deferred re-exported name); the "other" column is for symbol keys, non-exported string keys, and the like.

**`trigger/` bucket — triggers `EvaluateModuleSync` on `dep`:**

| Operation | Surface syntax | Why it triggers |
|-----------|----------------|-----------------|
| `[[Get]]` (exported key) | `ns.exported`, `ns[key]` | Spec calls `EvaluateModuleSync` when `[[Deferred]]` is set on the binding. |
| `[[Get]]` via prototype | `Object.create(ns).exported` | Still routes through `ns`'s `[[Get]]`. |
| `[[Get]]` via super | `class C { m() { return super.x } }` with `C.prototype.__proto__ = ns` | Same trap. |
| `[[Get]]` of `"then"` when exported | `ns.then` where barrel has `export defer { then } from ...` | `then` being an exported string name overrides the symbol-like short-circuit; routes to the exports path. |
| `[[GetOwnProperty]]` (exported key) | `Object.getOwnPropertyDescriptor(ns, "exported")` | Populates `[[Value]]` via `[[Get]]`. |
| `[[DefineOwnProperty]]` (exported key) | `Object.defineProperty(ns, "exported", desc)` | Validates `desc` against current descriptor via `[[GetOwnProperty]]`. |
| `[[Delete]]` (exported key) | `delete ns.exported` | Resolves binding via `[[GetOwnProperty]]` before returning `false`. |

**`ignore/` bucket — does NOT trigger evaluation:**

| Operation | Surface syntax | Why it does not trigger |
|-----------|----------------|-----------------|
| `[[HasProperty]]` (any key) | `"exported" in ns`, `"notExported" in ns` | Resolved against the link-time export list. |
| `[[OwnPropertyKeys]]` | `Reflect.ownKeys(ns)`, `Object.getOwnPropertyNames(ns)`, `Object.getOwnPropertySymbols(ns)` | Export list is populated at link time. |
| `[[Set]]` (any key, exported or not) | `ns.exported = 1`, `ns.notExported = 1` | Module namespace `[[Set]]` returns `false` unconditionally; never consults the exports list. |
| Super-property `[[Set]]` of exported | `super.exported = 1` with `ns` as home prototype | Same — routes to `[[Set]]` which returns `false`. |
| Symbol key access (other) | `ns[Symbol.iterator]` | `IsSymbolLikeNamespaceKey` short-circuits on symbols. |
| `Symbol.toStringTag` | `ns[Symbol.toStringTag]` | Same short-circuit. |
| `[[Get]]` of `"then"` NOT exported | `ns.then` where `then` is not exported | Short-circuits via the "not in exports list" path — never reaches `EvaluateModuleSync`. |
| Any op on a not-exported name | `ns.notExported`, `Object.getOwnPropertyDescriptor(ns, "notExported")`, `delete ns.notExported`, `Object.defineProperty(ns, "notExported", …)` | Name is not in the exports list; operation short-circuits before evaluation. |
| `[[GetPrototypeOf]]` | `Object.getPrototypeOf(ns)` | Returns `null` without touching exports. |
| `[[SetPrototypeOf]]` | `Object.setPrototypeOf(ns, null)` / non-null | Returns `true` for `null`, `false` otherwise — no exports-list consultation. |
| `[[IsExtensible]]` | `Reflect.isExtensible(ns)` | Returns `false`. |
| `[[PreventExtensions]]` | `Object.preventExtensions(ns)` | Already non-extensible. |
| Private-name access | `#x in ns` (where feasible) | Short-circuits. |

### `then` special-case pair

Two dedicated test pairs — both necessary because the "symbol-like key" short-circuit in `[[Get]]` exists specifically so that `import()` promise-unwrapping doesn't accidentally trigger evaluation:

- `trigger-then-exported-get.js` — `then` IS a deferred-reexported name. `ns.then` DOES trigger. (Barrel: `export defer { then } from "./dep-then_FIXTURE.js"`.)
- `ignore-not-exported-then-get.js` — `then` is NOT an exported name. `ns.then` does NOT trigger. (Barrel: the ordinary `barrel_FIXTURE.js`.)

## Expected output file list

Roughly the same set the `import-defer` side produces, reshuffled per the buckets above. Final names come from template `path:` + case base-name. Rough count: ~25 generated files in `test/language/export/export-defer/evaluation-triggers/`, plus the 5 fixture files.

Files that were `ignore-*` for `import-defer` but become `trigger-*` here:
- `getOwnProperty`, `defineOwnProperty`, `delete` when the key is exported.

Files that were `trigger-*` for `import-defer` but become `ignore-*` here:
- `hasProperty`, `hasProperty-in-prototype`, `ownPropertyKeys`, `ownPropertyKey-names`.

Files unchanged in bucket:
- Symbol keys, `set-*`, `getPrototypeOf`, `setPrototypeOf`, `isExtensible`, `preventExtensions`, private-name-access → remain in `ignore`.
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

## Linting and test262 conventions

- All fixture filenames end in `_FIXTURE.js` and do not use harness bindings.
- Files end in a newline.
- `includes` in flow style.
- Lint command (inside pyvenv): `python tools/lint/lint.py --exceptions lint.exceptions test/language/export/export-defer/evaluation-triggers/ src/export-defer/`.

## PR assembly

- `src/export-defer/**` (templates + `.case` files) is committed. Generated tests under `test/language/export/export-defer/evaluation-triggers/**` are NOT committed — per the convention noted in `CLAUDE.md` ("PRs should not include generated test outputs — they are built from `src/` after merge").
- Fixture files (`*_FIXTURE.js`) under `test/language/export/export-defer/evaluation-triggers/` ARE committed (they are not generated).
- Verification during development: run `./make.py` locally to generate, lint the output, run the harness self-tests.
