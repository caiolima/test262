// Copyright (C) 2026 Caio Lima. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

import defer * as nsD from "./d_FIXTURE.js";

// This module must execute only after the async cycle {A, B} in the deferred
// graph of D has been fully evaluated.
globalThis.evaluations.push("Middle-before-nsD.z");
nsD.z;
globalThis.evaluations.push("Middle-after-nsD.z");
