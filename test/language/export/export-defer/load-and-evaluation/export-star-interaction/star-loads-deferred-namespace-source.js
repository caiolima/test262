// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-ImportedNames
description: >
  `export * from` forces evaluation of a deferred-namespace re-export source because the namespace binding is a named (non-default) export
info: |
  ImportedNames ~all-but-default~ includes any non-default named binding.
  `export defer * as ns from "y"` produces a non-default `ns` binding whose
  resolution requires y's exports to be known, forcing y's loading and
  evaluation.

flags: [module]
features: [export-defer]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";
import "./entry-defer-namespace_FIXTURE.js";

assert.sameValue(
  globalThis.evaluations.includes("y"),
  true,
  "y SHOULD be evaluated — `ns` is a named binding included by `export *`"
);
assert.compareArray(
  globalThis.evaluations,
  ["y", "x-defer-namespace", "entry-defer-namespace"],
  "y evaluates first (eager dep of x's deferred namespace re-export), then x, then entry"
);
