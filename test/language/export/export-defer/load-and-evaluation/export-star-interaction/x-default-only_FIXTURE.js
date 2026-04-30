// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations.push("x-default-only");
export defer { foo as default } from "./y_FIXTURE.js";
