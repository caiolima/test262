// This file was procedurally generated from the following sources:
// - src/export-defer/super-property-set-exported.case
// - src/export-defer/no-trigger-on-exported/string-exported.template
/*---
description: _ [[Set]] called on super access (of a string that is a deferred-reexported name, does not trigger evaluation)
esid: sec-module-namespace-exotic-objects
features: [export-defer]
flags: [generated, module]
includes: [compareArray.js]
info: |
    EvaluateModuleSync is only inserted into [[Get]] by this proposal.
    Operations that do not route through [[Get]] do not reach it,
    even for a deferred-reexported name.


    [[Set]] ( _P_, _V_, _Receiver_ )
      1. Return *false*.

    SuperProperty : super [ Expression ]
      1. Let _env_ be GetThisEnvironment().
      1. Let _actualThis_ be ? _env_.GetThisBinding().
      1. Let _propertyNameReference_ be ? Evaluation of |Expression|.
      1. Let _propertyNameValue_ be ? GetValue(_propertyNameReference_).
      1. Let _strict_ be IsStrict(this |SuperProperty|).
      1. Return MakeSuperPropertyReference(_actualThis_, _propertyNameValue_, _strict_).

    MakeSuperPropertyReference ( _actualThis_, _propertyKey_, _strict_ )
      1. Let _env_ be GetThisEnvironment().
      1. Assert: _env_.HasSuperBinding() is *true*.
      1. Assert: _env_ is a Function Environment Record.
      1. Let _baseValue_ be GetSuperBase(_env_).
      1. Return the Reference Record { [[Base]]: _baseValue_, [[ReferencedName]]: _propertyKey_, [[Strict]]: _strict_, [[ThisValue]]: _actualThis_ }.

    PutValue ( _V_, _W_ )
      1. If _V_ is not a Reference Record, throw a *ReferenceError* exception.
      ...
      1. If IsPropertyReference(_V_) is *true*, then
        1. Let _baseObj_ be ? ToObject(_V_.[[Base]]).
        ...
        1. Let _succeeded_ be ? _baseObj_.[[Set]](_V_.[[ReferencedName]], _W_, GetThisValue(_V_)).
        1. If _succeeded_ is *false* and _V_.[[Strict]] is *true*, throw a *TypeError* exception.
        1. Return ~unused~.
      ...

---*/


import "./setup_FIXTURE.js";

import * as ns from "./barrel_FIXTURE.js";

assert.compareArray(globalThis.evaluations, ["barrel"],
  "barrel evaluated eagerly; deferred source not yet evaluated");

var key = "exported";

class A { constructor() { return ns; } };
class B extends A {
  constructor() {
    super();
    super[key] = 14;
  }
};

try {
  new B();
} catch (_) {}

assert.compareArray(globalThis.evaluations, ["barrel"],
  "operation does not route through [[Get]], so deferred source is not evaluated");
