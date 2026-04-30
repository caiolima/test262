// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-resolveexport
description: Validation through `export defer * as ns` of a chain whose inner deferred re-export is unresolvable throws SyntaxError
info: |
  Resolving `ns` from outer requires y's namespace; y's namespace requires
  resolving y's deferred re-exports; `nonexistent` is not exported by z, so
  ResolveExport fails with SyntaxError. The error surfaces when the consumer
  forces evaluation of the namespace chain.

flags: [module, async]
features: [export-defer, dynamic-import]
includes: [asyncHelpers.js]
---*/

asyncTest(async () => {
  let err;
  await import("./consumer_FIXTURE.js").catch((e) => { err = e; });
  assert.sameValue(err instanceof SyntaxError, true, "nested deferred namespace validation surfaces unresolvable inner binding as SyntaxError");
});
