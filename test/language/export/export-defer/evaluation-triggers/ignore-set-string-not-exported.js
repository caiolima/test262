// This file was procedurally generated from the following sources:
// - src/export-defer/set-string-not-exported.case
// - src/export-defer/no-trigger/no-trigger.template
/*---
description: _ [[Set]] of a string which is not an export name (does not trigger evaluation)
esid: sec-module-namespace-exotic-objects
features: [export-defer]
flags: [generated, module]
includes: [compareArray.js]
info: |
    [[Get]] ( _P_, _Receiver_ ) — proposal-deferred-reexports amendment
      1. If _P_ is a Symbol, return OrdinaryGet(_O_, _P_, _Receiver_).
      1. Let _exports_ be _O_.[[Exports]].
      1. If _exports_ does not contain _P_, return *undefined*.
      1. Let _m_ be _O_.[[Module]].
      1. If _m_ is a Cyclic Module Record and _m_.GetOptionalIndirectExportsModuleRequests(« _P_ ») is not empty, then
        1. Perform ? EvaluateModuleSync(_m_, « _P_ »).
      1. ...

      EvaluateModuleSync is only inserted into [[Get]] by this proposal.
      Operations that do not route through [[Get]] do not reach it,
      even for a deferred-reexported name.


    [[Set]] ( _P_, _V_, _Receiver_ )
      1. Return *false*.

---*/


import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"],
  "barrel evaluated eagerly; deferred source not yet evaluated");

try {
  ns.notExported = "hi";
} catch (_) {}

assert.compareArray(globalThis.evaluations, ["barrel"],
  "operation does not route through [[Get]], so deferred source is not evaluated");
