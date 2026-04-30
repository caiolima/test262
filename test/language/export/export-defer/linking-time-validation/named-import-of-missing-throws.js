// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-resolveexport
description: A consumer that statically imports a deferred binding the source does not export throws SyntaxError at link time
info: |
  ResolveExport on `nonexistent` traverses bad-defer-barrel's deferred
  re-export to dep. dep has no entry for `nonexistent`, so ResolveExport
  fails with SyntaxError per the proposal's optional-indirect-export
  resolution rules.

flags: [module, async]
features: [export-defer, dynamic-import]
includes: [asyncHelpers.js]
---*/

asyncTest(async () => {
  let err;
  await import("./consumer-named_FIXTURE.js").catch((e) => { err = e; });
  assert.sameValue(err instanceof SyntaxError, true, "named import of missing deferred binding throws SyntaxError");
});
