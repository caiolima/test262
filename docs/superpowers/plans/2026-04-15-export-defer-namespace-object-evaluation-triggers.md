# `export defer` Namespace Object Evaluation Triggers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generated test matrix covering which module-namespace-exotic-object operations trigger (or do not trigger) evaluation of the deferred source module when a consumer does `import * as ns from "./barrel"` over a barrel with `export defer { x } from "./dep"`.

**Architecture:** Self-contained `src/export-defer/` tree (case files + template families) mirroring the `src/import-defer/` infrastructure. Hand-authored `*_FIXTURE.js` files under `test/language/export/export-defer/evaluation-triggers/`. Tests are produced by `./make.py`. PR is assembled as two commits: (1) sources + fixtures, (2) generated output.

**Tech Stack:** test262 test infrastructure — `./make.py` generator (Python), `tools/lint/lint.py` linter, YAML frontmatter in `.case` / `.template` files, module tests with `globalThis.evaluations` tracking via `compareArray.js`.

**Spec reference:** https://tc39.es/proposal-deferred-reexports/ — especially its amendments to the Module Namespace Exotic Object internal methods and to `ResolveExport`.

**Design doc:** `docs/superpowers/specs/2026-04-15-export-defer-namespace-object-evaluation-triggers-design.md`

**Branch:** `export-defer-ns-objects` (already checked out).

---

## Prerequisites for the implementing engineer

Read these before starting:

1. **Design doc** (linked above) — understand the bucket classification and the scope (single import form, single barrel pattern).
2. **Spec:** https://tc39.es/proposal-deferred-reexports/ — sections on `[[Get]]`, `ResolveExport`, and any edits to module-namespace-exotic-object methods.
3. **Existing siblings** — skim these to understand conventions:
   - `test/language/import/import-defer/evaluation-triggers/` (the target to mirror)
   - `src/import-defer/` (the source tree to mirror)
   - `test/language/export/export-defer/load-and-evaluation/` (sibling branch's conventions for fixtures and tracking)
4. **`CLAUDE.md`** in the repo root — lint must run inside pyvenv; copyright is `2026 Igalia, S.L.`; spec step numbers use `1.` for every step.

## Notes on test262 infrastructure

- `./make.py` generates tests by combining each `.case` file with the `.template` family it references (`template:` field in case frontmatter). A template family is a directory; each file in the directory is one "variant" and produces one generated test per `.case`.
- Template `path:` field is prepended to the case's base filename to produce the output path.
- Template `name:` field concatenates with the case's `desc:` to produce the `description:` frontmatter.
- `info:` blocks from template and case are concatenated in the generated output.
- Fixtures (`*_FIXTURE.js`) live alongside generated tests but are NOT generated — they are hand-authored and committed as-is.
- Lint requires generated files to exist; run `./make.py` before `tools/lint/lint.py`.

---

## Task 0: Verify the per-operation classification against the spec

**Why this task exists:** The design doc's per-operation classification table is a working hypothesis. Before we author any templates, we need to walk the proposal-deferred-reexports spec and confirm which Module Namespace Exotic Object internal methods, applied to a deferred-reexported name, reach `EvaluateModuleSync` (directly or transitively through `[[Get]]` / `[[GetOwnProperty]]`). If any row in the table is wrong, every downstream task changes its template/bucket assignment.

**Files:**
- Read: https://tc39.es/proposal-deferred-reexports/ (section on namespace object semantics and `ResolveExport`).
- Read: https://github.com/tc39/test262/issues/5010 (top-level issue and the comment cited during brainstorming).
- Read: ECMA-262 baseline for Module Namespace Exotic Object internal methods (`[[Get]]`, `[[GetOwnProperty]]`, `[[HasProperty]]`, `[[Delete]]`, `[[DefineOwnProperty]]`, `[[Set]]`, `[[OwnPropertyKeys]]`, `[[GetPrototypeOf]]`, `[[SetPrototypeOf]]`, `[[IsExtensible]]`, `[[PreventExtensions]]`).
- Modify if necessary: `docs/superpowers/specs/2026-04-15-export-defer-namespace-object-evaluation-triggers-design.md`.

**Steps:**

- [ ] **Step 1: Walk each row of the classification table and record the spec justification.**

For each of these operations applied to a property key that names a deferred re-exported binding (e.g., `"exported"` where the barrel has `export defer { exported } from "./dep.js"`):

  - `[[Get]]` — confirm the proposal adds a step that calls `EvaluateModuleSync` (or equivalent) when the resolved binding is deferred.
  - `[[GetOwnProperty]]` — confirm the baseline algorithm populates `[[Value]]` via `[[Get]]`, so it inherits the trigger.
  - `[[DefineOwnProperty]]` — confirm the baseline algorithm reaches `[[GetOwnProperty]]` (to compare against the current descriptor), so it inherits the trigger.
  - `[[Delete]]` — baseline: returns `false` for any name in `[[Exports]]` without calling `[[Get]]`. The design marked this as `trigger` per brainstorming discussion. Verify whether the proposal amends this path. If not, reclassify to `ignore`.
  - `[[HasProperty]]` — baseline: consults exports list only. Confirm the proposal does not amend this for deferred re-exports. Expected: `ignore`.
  - `[[OwnPropertyKeys]]` — baseline: returns keys from `[[Exports]]`. Expected: `ignore`.
  - `[[Set]]` — baseline: returns `false` unconditionally. Expected: `ignore`.
  - `[[GetPrototypeOf]]`, `[[SetPrototypeOf]]`, `[[IsExtensible]]`, `[[PreventExtensions]]` — baseline: do not consult exports list. Expected: `ignore`.

Also re-examine the `"then"` special case. For `import defer * as ns`, `IsSymbolLikeNamespaceKey("then", ns)` returns `true` because the namespace has `[[Deferred]]: true`, causing `ns.then` to short-circuit. For an ordinary `import * as ns` (our case), the namespace is NOT deferred, so `"then"` is treated as a regular string key. This means:
  - `ns.then` where `then` IS deferred-exported → `[[Get]]` finds it in exports, calls `EvaluateModuleSync` → `trigger`.
  - `ns.then` where `then` is NOT exported → short-circuits at "name not in exports" before any evaluation → `ignore`.

Write findings inline in the design doc, replacing the "working classification" preamble with an "Authoritative classification (verified against spec <URL> at <date>)" note. Use `git diff` to inspect the doc after editing.

- [ ] **Step 2: Reclassify affected cases.**

If step 1 changes any row, update the classification table in the design doc. The plan tasks below assume the design's current working classification; when a row moves between buckets, update the relevant task's "which template family this case references" decision.

- [ ] **Step 3: Commit any design updates.**

```bash
git add docs/superpowers/specs/2026-04-15-export-defer-namespace-object-evaluation-triggers-design.md
git commit -m "Spec: lock per-operation classification against proposal-deferred-reexports"
```

Skip the commit if no changes were needed (design remains authoritative as-written).

---

## Task 1: Create the fixture modules

**Files:**
- Create: `test/language/export/export-defer/evaluation-triggers/setup_FIXTURE.js`
- Create: `test/language/export/export-defer/evaluation-triggers/dep_FIXTURE.js`
- Create: `test/language/export/export-defer/evaluation-triggers/dep-then_FIXTURE.js`
- Create: `test/language/export/export-defer/evaluation-triggers/barrel_FIXTURE.js`
- Create: `test/language/export/export-defer/evaluation-triggers/barrel-then_FIXTURE.js`

- [ ] **Step 1: Create `setup_FIXTURE.js`.**

```js
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations = [];
```

- [ ] **Step 2: Create `dep_FIXTURE.js`.**

```js
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations.push("dep");

export let exported = 3;
```

- [ ] **Step 3: Create `dep-then_FIXTURE.js`.**

```js
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations.push("dep");

export let then = 3;
```

- [ ] **Step 4: Create `barrel_FIXTURE.js`.**

The barrel exports `exported` via `export defer` so the source is deferred; but critically, it also re-exports the `then` name non-deferred so `ns.then`-when-not-exported stays a meaningful "not exported" test (since both the barrel and dep have no `then` in this variant, `ns.then` on this barrel is truly not-exported). Actually the simpler design: make the barrel expose ONLY the deferred `exported`. Then `ns.then` lookup on this barrel is "not exported". The `barrel-then_FIXTURE.js` below handles the "then is exported" variant.

```js
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations.push("barrel");

export defer { exported } from "./dep_FIXTURE.js";
```

- [ ] **Step 5: Create `barrel-then_FIXTURE.js`.**

```js
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations.push("barrel");

export defer { then } from "./dep-then_FIXTURE.js";
```

- [ ] **Step 6: Verify the fixtures are read-ready.**

```bash
ls test/language/export/export-defer/evaluation-triggers/
```

Expected output includes the five `*_FIXTURE.js` files and nothing else (no generated tests yet).

---

## Task 2: Scaffold `src/export-defer/` and copy case files

**Files:**
- Create directory: `src/export-defer/`
- Create (by copying from `src/import-defer/`): the 20 `.case` files listed below.

**Note on info-block content:** The case files quote the spec algorithm for the specific operation. When copying from `src/import-defer/`, the existing quotes reference `IsSymbolLikeNamespaceKey` and `GetModuleExportsList` — these are `import-defer` spec constructs. For `export-defer`, the corresponding algorithm for each operation is the baseline ECMA-262 version **plus** the proposal's new trigger step inside `[[Get]]` / `ResolveExport`. Rewrite each case's `info:` block with the baseline spec steps for that operation, and rely on the template's `info:` block to quote the proposal's deferred-evaluation step(s). Reference: https://tc39.es/proposal-deferred-reexports/.

- [ ] **Step 1: Create the `src/export-defer/` directory.**

```bash
mkdir -p src/export-defer
```

- [ ] **Step 2: Copy and adjust each `.case` file.**

For each of the cases below, copy from `src/import-defer/<case>` to `src/export-defer/<case>`, then:
- Update the copyright year to 2026 if not already.
- Rewrite the `info:` block to quote the baseline ECMA-262 algorithm for that internal method (NOT the `import-defer` amendments).
- Update the `template:` field to point to the correct `src/export-defer/` template family per the classification (see mapping below).
- Keep the `esid:` and `desc:` fields as-is (they anchor to the same internal method).
- Keep the `//- body` block as-is unless the body depends on `import-defer`-specific behavior (none of the listed cases do).

**Case → template family mapping** (based on the design's classification; adjust if Task 0 changed the table).

Determine each case's template family by inspecting how the import-defer side uses it (multi-variant cases in `src/import-defer/` reference `trigger-on-possible-export` and produce 6 generated tests; single-variant cases reference `trigger` or `ignore` and produce 1 generated test). The multi-variant-ness is a property of the `.case` body — multi-variant bodies reference a `key` variable; single-variant bodies hard-code the key or have no key at all.

**Group A — multi-variant, `template: trigger-on-exported`** (key-taking ops where `[[Get]]` is reached when the key is an exported string name):

- `get.case`
- `get-in-prototype.case`
- `super-get.case`
- `getOwnProperty.case`
- `defineOwnProperty.case`
- `super-property-define.case`

**Group B — multi-variant, `template: no-trigger-on-exported`** (key-taking ops that never reach `[[Get]]` for any variant):

- `hasProperty.case`
- `hasProperty-in-prototype.case`
- `delete.case` *(pending Task 0 verification; if the proposal amends `[[Delete]]`, move to Group A)*
- `super-property-set-exported.case` *(super-property set routes to `[[Set]]`, which returns `false` unconditionally)*

**Group C — single-variant, `template: no-trigger`** (name-agnostic ops, or ops with their key hard-coded in the case body):

- `set-string-exported.case`
- `set-string-not-exported.case`
- `getPrototypeOf.case`
- `setPrototypeOf.case`
- `isExtensible.case`
- `preventExtensions.case`
- `ownPropertyKeys.case`
- `ownPropertyKey-names.case`
- `ownPropertyKeys-symbols.case`
- `private-name-access.case`

When in doubt, check the matching import-defer case file: if it uses `template: trigger-on-possible-export`, it's multi-variant (Group A or B); if it uses `template: trigger` or `template: ignore`, it's single-variant (Group C). Copy the body verbatim — do not edit it.

Illustrative result for `get.case` (Group A):

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-module-namespace-exotic-objects-get-p-receiver
desc: _ [[Get]]
info: |
  [[Get]] ( _P_, _Receiver_ )
    1. If _P_ is a Symbol, then
      1. Return ! OrdinaryGet(_O_, _P_, _Receiver_).
    1. Let _exports_ be _O_.[[Exports]].
    1. If _exports_ does not contain _P_, return *undefined*.
    1. Let _m_ be _O_.[[Module]].
    1. Let _binding_ be ! _m_.ResolveExport(_P_).
    1. ... (proposal-deferred-reexports inserts the deferred-evaluation step here;
            see template info block for the full citation.)

template: trigger-on-exported
---*/

//- body
ns[key];
```

Illustrative result for `hasProperty.case` (Group B):

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-module-namespace-exotic-objects-hasproperty-p
desc: _ [[HasProperty]]
info: |
  [[HasProperty]] ( _P_ )
    1. If _P_ is a Symbol, then
      1. Return ! OrdinaryHasProperty(_O_, _P_).
    1. Let _exports_ be _O_.[[Exports]].
    1. If _exports_ contains _P_, return *true*.
    1. Return *false*.

template: no-trigger-on-exported
---*/

//- body
key in ns;
```

Illustrative result for `ownPropertyKeys.case` (Group C):

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-module-namespace-exotic-objects-ownpropertykeys
desc: _ [[OwnPropertyKeys]]
info: |
  [[OwnPropertyKeys]] ( )
    1. Let _exports_ be _O_.[[Exports]].
    1. Let _symbolKeys_ be OrdinaryOwnPropertyKeys(_O_).
    1. Return the list-concatenation of _exports_ and _symbolKeys_.

template: no-trigger
---*/

//- body
Reflect.ownKeys(ns);
```

- [ ] **Step 3: Verify all 20 `.case` files exist.**

```bash
ls src/export-defer/*.case | wc -l
```

Expected: `20`.

Do NOT commit here — all `src/export-defer/` content is consolidated in commit 1 at Task 5 after templates exist.

---

## Task 3: Author the template families

**Files:**
- Create: `src/export-defer/trigger-on-exported/string-exported.template`
- Create: `src/export-defer/trigger-on-exported/string-not-exported.template`
- Create: `src/export-defer/trigger-on-exported/symbol-other.template`
- Create: `src/export-defer/trigger-on-exported/symbol-toStringTag.template`
- Create: `src/export-defer/trigger-on-exported/then-exported.template`
- Create: `src/export-defer/trigger-on-exported/then-not-exported.template`
- Create: `src/export-defer/no-trigger-on-exported/string-exported.template`
- Create: `src/export-defer/no-trigger-on-exported/string-not-exported.template`
- Create: `src/export-defer/no-trigger-on-exported/symbol-other.template`
- Create: `src/export-defer/no-trigger-on-exported/symbol-toStringTag.template`
- Create: `src/export-defer/no-trigger-on-exported/then-exported.template`
- Create: `src/export-defer/no-trigger-on-exported/then-not-exported.template`
- Create: `src/export-defer/no-trigger/no-trigger.template`

**Rule for template bucketing (the trigger-vs-ignore decision per variant):**

Within `trigger-on-exported/`:
- `string-exported.template`, `then-exported.template` → path prefix `trigger-exported-string-` / `trigger-exported-then-`; assertion pair is (`['barrel']` → `['barrel', 'dep']`).
- `string-not-exported.template`, `symbol-other.template`, `symbol-toStringTag.template`, `then-not-exported.template` → path prefix `ignore-...-`; assertion pair is (`['barrel']` → `['barrel']`).

Within `no-trigger-on-exported/`:
- ALL SIX variants → path prefix `ignore-...-`; assertion pair is (`['barrel']` → `['barrel']`).

Within `no-trigger/`:
- Single variant, path prefix `ignore-`; assertion pair is (`['barrel']` → `['barrel']`).

**Shared template-level `info:` block** quotes the proposal-deferred-reexports spec's addition — specifically the step in `[[Get]]` that calls `EvaluateModuleSync` when a resolved binding is deferred. Use the exact spec text from https://tc39.es/proposal-deferred-reexports/. The same block goes in both `trigger-on-exported/` and `no-trigger-on-exported/` templates (the shared `info:` tells the reader WHY only `[[Get]]`-routed ops trigger).

- [ ] **Step 1: Create `src/export-defer/trigger-on-exported/string-exported.template`.**

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
path: language/export/export-defer/evaluation-triggers/trigger-exported-string-
name: of a string that is a deferred-reexported name, triggers evaluation
esid: sec-module-namespace-exotic-objects
info: |
  <proposal-deferred-reexports [[Get]] step quoting>
  [[Get]] ( _P_, _Receiver_ )
    1. ...
    1. Let _binding_ be _m_.ResolveExport(_P_).
    1. If _binding_.[[Deferred]] is *true*, perform ? EvaluateModuleSync(_binding_.[[Module]]).
    1. ...

flags: [module]
features: [deferred-reexports]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"],
  "barrel evaluated eagerly; deferred source not yet evaluated");

var key = "exported";

/*{ body }*/

assert.compareArray(globalThis.evaluations, ["barrel", "dep"],
  "operation on deferred-reexported name triggers source evaluation");
```

**Replace `<proposal-deferred-reexports [[Get]] step quoting>` with the exact spec text from the proposal.** Do NOT leave the placeholder in the committed template.

- [ ] **Step 2: Create `src/export-defer/trigger-on-exported/string-not-exported.template`.**

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
path: language/export/export-defer/evaluation-triggers/ignore-not-exported-string-
name: of a string that is not an exported name, does not trigger evaluation
esid: sec-module-namespace-exotic-objects
info: |
  <same proposal [[Get]] quoting as step 1>
  A name not present in the exports list short-circuits before reaching
  the deferred-evaluation step.

flags: [module]
features: [deferred-reexports]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"],
  "barrel evaluated eagerly; deferred source not yet evaluated");

var key = "notExported";

/*{ body }*/

assert.compareArray(globalThis.evaluations, ["barrel"],
  "operation on a non-exported name does not trigger evaluation");
```

- [ ] **Step 3: Create `src/export-defer/trigger-on-exported/symbol-other.template`.**

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
path: language/export/export-defer/evaluation-triggers/ignore-symbol-other-
name: of a symbol that is not a property of the namespace object, does not trigger evaluation
esid: sec-module-namespace-exotic-objects
info: |
  <proposal [[Get]] quoting>
  Symbol keys short-circuit via the symbol check at the top of [[Get]] and
  do not reach the deferred-evaluation step.

flags: [module]
features: [deferred-reexports]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"]);

var key = Symbol();

/*{ body }*/

assert.compareArray(globalThis.evaluations, ["barrel"]);
```

- [ ] **Step 4: Create `src/export-defer/trigger-on-exported/symbol-toStringTag.template`.**

Same as step 3 but with `var key = Symbol.toStringTag;` and `path: language/export/export-defer/evaluation-triggers/ignore-symbol-toStringTag-`, `name: of Symbol.toStringTag, does not trigger evaluation`.

- [ ] **Step 5: Create `src/export-defer/trigger-on-exported/then-exported.template`.**

Same setup as step 1 but:
- `path: language/export/export-defer/evaluation-triggers/trigger-exported-then-`
- `name: of 'then' when it is a deferred-reexported name, triggers evaluation`
- `import * as ns from "./barrel-then_FIXTURE.js";`
- `var key = "then";`
- Trigger assertion pair (`['barrel']` → `['barrel', 'dep']`).

- [ ] **Step 6: Create `src/export-defer/trigger-on-exported/then-not-exported.template`.**

Same setup as step 2 but with `var key = "then";` and:
- `path: language/export/export-defer/evaluation-triggers/ignore-not-exported-then-`
- `name: of 'then' when it is not an exported name, does not trigger evaluation`
- `import * as ns from "./barrel_FIXTURE.js";` (barrel does NOT export `then`).

- [ ] **Step 7: Create the `no-trigger-on-exported/` family (six templates).**

The six variants have the same structure as their `trigger-on-exported/` counterparts EXCEPT:
- ALL SIX use the ignore assertion pair (`['barrel']` → `['barrel']`), including the string-exported and then-exported variants.
- All six use path prefixes starting with `ignore-`:
  - `ignore-exported-string-`, `ignore-not-exported-string-`, `ignore-symbol-other-`, `ignore-symbol-toStringTag-`, `ignore-exported-then-`, `ignore-not-exported-then-`.
- The `name:` line describes WHY the operation does not trigger (e.g., "of a string that is a deferred-reexported name, does not trigger evaluation because [[HasProperty]] / [[Delete]] / etc. do not route through [[Get]]").
- `ignore-exported-then-` uses `./barrel-then_FIXTURE.js`; the other five use `./barrel_FIXTURE.js`.

Example — `src/export-defer/no-trigger-on-exported/string-exported.template`:

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
path: language/export/export-defer/evaluation-triggers/ignore-exported-string-
name: of a string that is a deferred-reexported name, does not trigger evaluation
esid: sec-module-namespace-exotic-objects
info: |
  <proposal [[Get]] quoting>
  This operation does not route through [[Get]] on the module namespace
  exotic object and therefore does not reach the deferred-evaluation step,
  even for a deferred-reexported name.

flags: [module]
features: [deferred-reexports]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"]);

var key = "exported";

/*{ body }*/

assert.compareArray(globalThis.evaluations, ["barrel"]);
```

- [ ] **Step 8: Create `src/export-defer/no-trigger/no-trigger.template`.**

Single-variant, name-agnostic (no `var key = ...`):

```yaml
// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
path: language/export/export-defer/evaluation-triggers/ignore-
name: does not trigger evaluation
esid: sec-module-namespace-exotic-objects
info: |
  <proposal [[Get]] quoting>
  This operation does not consult the deferred binding and therefore does
  not reach the deferred-evaluation step.

flags: [module]
features: [deferred-reexports]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"]);

/*{ body }*/

assert.compareArray(globalThis.evaluations, ["barrel"]);
```

- [ ] **Step 9: Verify all 13 template files exist.**

```bash
find src/export-defer -name "*.template" | sort
```

Expected output: 6 files under `trigger-on-exported/`, 6 files under `no-trigger-on-exported/`, 1 file under `no-trigger/`.

---

## Task 4: Generate tests with `./make.py`

**Files:**
- Produced: `test/language/export/export-defer/evaluation-triggers/*.js` (generated).

- [ ] **Step 1: Activate the pyvenv (per `CLAUDE.md`) and ensure generation dependencies are installed.**

```bash
source bin/activate   # or: source pyvenv.cfg's activate script
python -m pip install --requirement tools/generation/requirements.txt
```

- [ ] **Step 2: Run the generator.**

```bash
./make.py
```

Expected: no errors; the tool reports files written under `test/language/export/export-defer/evaluation-triggers/`.

- [ ] **Step 3: Spot-check the output count.**

```bash
ls test/language/export/export-defer/evaluation-triggers/*.js | grep -v _FIXTURE | wc -l
```

Expected: roughly the sum of (Group A cases × 6) + (Group B cases × 6) + (Group C cases × 1) = (6 × 6) + (4 × 6) + (10 × 1) = 70 generated tests, modulo Task 0's final classification (e.g., if `delete.case` moves from Group B to Group A, the count does not change; if a case is reclassified between single-variant and multi-variant, the count shifts by ±5).

- [ ] **Step 4: Spot-check one file from each bucket for correctness.**

```bash
cat test/language/export/export-defer/evaluation-triggers/trigger-exported-string-get.js
cat test/language/export/export-defer/evaluation-triggers/ignore-not-exported-string-get.js
cat test/language/export/export-defer/evaluation-triggers/ignore-exported-string-hasProperty.js
cat test/language/export/export-defer/evaluation-triggers/ignore-ownPropertyKeys.js
```

Check each for:
- Correct import form (`import * as ns from "./barrel_FIXTURE.js"`).
- Correct assertion pair (matching the template's bucket).
- Correct `var key = ...` (or absence of it for the `no-trigger` template).
- Correct `features: [deferred-reexports]`.
- Correct `includes: [compareArray.js]`.

- [ ] **Step 5: If anything looks wrong, fix the offending template or case and re-run `./make.py`.**

Never hand-edit the generated files. Always round-trip through `./make.py`.

---

## Task 5: Commit 1 — sources and fixtures

**Files:**
- Add: `src/export-defer/**`
- Add: `test/language/export/export-defer/evaluation-triggers/*_FIXTURE.js`

- [ ] **Step 1: Stage only the sources and fixtures (NOT the generated tests).**

```bash
git add src/export-defer/
git add test/language/export/export-defer/evaluation-triggers/setup_FIXTURE.js \
        test/language/export/export-defer/evaluation-triggers/dep_FIXTURE.js \
        test/language/export/export-defer/evaluation-triggers/dep-then_FIXTURE.js \
        test/language/export/export-defer/evaluation-triggers/barrel_FIXTURE.js \
        test/language/export/export-defer/evaluation-triggers/barrel-then_FIXTURE.js
git status
```

Expected: only the 5 fixture files plus the contents of `src/export-defer/` are staged. The generated tests remain unstaged.

- [ ] **Step 2: Commit.**

```bash
git commit -m "Add export defer namespace-object evaluation-triggers sources and fixtures"
```

---

## Task 6: Lint

**Files:**
- Read: `test/language/export/export-defer/evaluation-triggers/**` (generated), `src/export-defer/**` (source).

- [ ] **Step 1: Run the linter (inside pyvenv per `CLAUDE.md`).**

```bash
python tools/lint/lint.py --exceptions lint.exceptions \
  test/language/export/export-defer/evaluation-triggers/ \
  src/export-defer/
```

Expected: exit code 0; no findings.

- [ ] **Step 2: If lint fails, diagnose.**

Common failures and their fix locations:
- Missing final newline → fix the `.template` file, re-run `./make.py`, re-lint.
- `includes` not in flow style → fix the `.template` file, regenerate.
- Feature not in `features.txt` → `deferred-reexports` is already added (commit `bd24fd8404`); if lint still complains, double-check the spelling in the `.template`.
- Unknown frontmatter keys → check against the linter's whitelist in `tools/lint/`.

NEVER edit the generated `.js` files by hand to silence lint.

---

## Task 7: Commit 2 — generated tests

**Files:**
- Add: `test/language/export/export-defer/evaluation-triggers/*.js` (the generated files only; fixtures are already committed).

- [ ] **Step 1: Stage the generated tests.**

```bash
git add test/language/export/export-defer/evaluation-triggers/
git status
```

Expected: only the generated `.js` files are staged (fixtures from Task 5 are already committed).

- [ ] **Step 2: Commit.**

```bash
git commit -m "Generate export defer namespace-object evaluation-triggers tests"
```

The commit message explicitly says "Generate" so reviewers immediately recognize this as `./make.py` output.

---

## Task 8: Verify the branch is ready for PR

- [ ] **Step 1: Inspect the commit series.**

```bash
git log --oneline main..HEAD
```

Expected (in order): the pre-existing commits on `export-defer-ns-objects`, optionally a spec-update commit from Task 0, then `Add export defer namespace-object evaluation-triggers sources and fixtures`, then `Generate export defer namespace-object evaluation-triggers tests`.

- [ ] **Step 2: Inspect final tree.**

```bash
ls src/export-defer/
find src/export-defer -name "*.template"
ls test/language/export/export-defer/evaluation-triggers/ | head -40
```

- [ ] **Step 3: Re-run lint as a sanity check.**

```bash
python tools/lint/lint.py --exceptions lint.exceptions \
  test/language/export/export-defer/evaluation-triggers/ \
  src/export-defer/
```

- [ ] **Step 4: Confirm the PR description will explain the two-commit structure.**

Note for the human who opens the PR: the description should say "Commit 1 is the hand-authored sources and fixtures; commit 2 is the output of `./make.py`. Per test262 convention generated tests are normally omitted from PRs, but for this matrix we include them so reviewers can verify the per-operation classification without running the generator."

---

## Summary

**Expected final state on branch `export-defer-ns-objects`:**

```
src/export-defer/
  get.case, get-in-prototype.case, super-get.case,
  getOwnProperty.case, defineOwnProperty.case,
  hasProperty.case, hasProperty-in-prototype.case, delete.case,
  set-string-exported.case, set-string-not-exported.case,
  super-property-set-exported.case, super-property-define.case,
  getPrototypeOf.case, setPrototypeOf.case,
  isExtensible.case, preventExtensions.case,
  ownPropertyKeys.case, ownPropertyKey-names.case, ownPropertyKeys-symbols.case,
  private-name-access.case,
  trigger-on-exported/
    string-exported.template, string-not-exported.template,
    symbol-other.template, symbol-toStringTag.template,
    then-exported.template, then-not-exported.template
  no-trigger-on-exported/
    string-exported.template, string-not-exported.template,
    symbol-other.template, symbol-toStringTag.template,
    then-exported.template, then-not-exported.template
  no-trigger/
    no-trigger.template

test/language/export/export-defer/evaluation-triggers/
  setup_FIXTURE.js, dep_FIXTURE.js, dep-then_FIXTURE.js,
  barrel_FIXTURE.js, barrel-then_FIXTURE.js,
  <~74 generated trigger-*.js / ignore-*.js files>
```

Two commits on top of the existing branch work, ready for PR.
