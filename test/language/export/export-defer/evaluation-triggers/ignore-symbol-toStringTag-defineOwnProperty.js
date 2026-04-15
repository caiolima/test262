// This file was procedurally generated from the following sources:
// - src/export-defer/defineOwnProperty.case
// - src/export-defer/trigger-on-exported/symbol-toStringTag.template
/*---
description: _ [[DefineOwnProperty]] (of @@toStringTag, does not trigger evaluation)
esid: sec-module-namespace-exotic-objects
features: [deferred-reexports]
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

      The key is a Symbol (@@toStringTag), so [[Get]] short-circuits at
      step 1 and delegates to OrdinaryGet before reaching the evaluation
      trigger. The deferred source is not evaluated.


    [[DefineOwnProperty]] ( _P_, _Desc_ )
      1. If _P_ is a Symbol, return OrdinaryDefineOwnProperty(_O_, _P_, _Desc_).
      1. Let _current_ be ? _O_.[[GetOwnProperty]](_P_).
      1. If _current_ is *undefined*, return *false*.
      1. ...

---*/


import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"],
  "barrel evaluated eagerly; deferred source not yet evaluated");

var key = Symbol.toStringTag;

try {
  Object.defineProperty(ns, key, { value: "hi" });
} catch (_) {}

assert.compareArray(globalThis.evaluations, ["barrel"],
  "operation with @@toStringTag does not trigger deferred-source evaluation");
