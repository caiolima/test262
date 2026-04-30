// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-getexportednames
description: '`import * as ns` causes loading and validation of all-but-default deferred re-exports; an unresolvable deferred re-export throws SyntaxError'
info: |
  GetExportedNames combined with `import * as ns` requires resolving every
  non-default exported name, including those re-exported via `export defer`.
  An unresolvable name throws SyntaxError per ResolveExport.

flags: [module, async]
features: [export-defer, dynamic-import]
includes: [asyncHelpers.js]
---*/

asyncTest(async () => {
  let err;
  await import("./consumer-star_FIXTURE.js").catch((e) => { err = e; });
  assert.sameValue(err instanceof SyntaxError, true, "import * forces resolution of deferred re-exports; unresolvable name throws SyntaxError");
});
