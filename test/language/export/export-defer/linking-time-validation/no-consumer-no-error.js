// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-resolveexport
description: A barrel with a deferred re-export of a missing binding does not error at link time when no consumer requests the binding
info: |
  ResolveExport is only invoked on bindings the consumer actually requests.
  Without a request for `nonexistent`, the deferred edge is never traversed
  and dep is never loaded.

flags: [module]
features: [export-defer]
includes: [compareArray.js]
---*/

import "./setup_FIXTURE.js";
import { ok } from "./bad-defer-barrel_FIXTURE.js";

assert.sameValue(ok, "ok", "barrel evaluated successfully without resolving the bad deferred binding");
assert.compareArray(
  globalThis.evaluations,
  ["bad-defer-barrel"],
  "dep was not loaded — only the barrel was evaluated"
);
