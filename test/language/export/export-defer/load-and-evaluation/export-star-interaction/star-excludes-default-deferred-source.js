// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-ImportedNames
description: >
  `export * from` does not force evaluation of a deferred re-export source that only exports the default binding
info: |
  ImportedNames for `export * from` is the special value ~all-but-default~.
  When x has only `export defer { foo as default } from "y"`, the
  ImportedNames intersection with x's exports is empty (default is excluded),
  so y is not gathered into the eager evaluation phase.

flags: [module]
features: [export-defer]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";
import "./entry-default-only_FIXTURE.js";

assert.sameValue(
  globalThis.evaluations.includes("y"),
  false,
  "y should NOT be evaluated — `export *` excludes the default binding"
);
assert.compareArray(
  globalThis.evaluations,
  ["x-default-only", "entry-default-only"],
  "only x and entry evaluated; y is untouched because the only deferred re-export targets `default`"
);
