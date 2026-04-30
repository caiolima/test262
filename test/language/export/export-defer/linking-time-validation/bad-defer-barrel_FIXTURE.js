// Copyright (C) 2026 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

globalThis.evaluations.push("bad-defer-barrel");
export defer { nonexistent } from "./dep_FIXTURE.js";
export const ok = "ok";
