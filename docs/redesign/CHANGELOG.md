# Redesign Changelog

Newest first. One entry per completed roadmap step.

Format:
```
## <date> — <step id> <title>
Branch: redesign/...
Changed: files / areas
Verified: type-check · lint · tests · screens checked · roles checked
Notes: follow-ups, decisions
```

---

## 2026-10-02 — Research, palette & WIP commit
Branch: main
Changed:
- Committed pending feature work as `9c4b7d5` (payroll attendance/LWOP/OT/loan sync, attendance report fixes). Type-check clean, 192/192 tests pass. Not pushed.
- Added `05-functional-research.md`: references (Business Central, SAP Fiori, TallyPrime, NepalHRM, RigoHR, Hajir), Nepal statutory facts, gap analysis, 17 prioritised functional enhancements (F1–F17).
- Palette switched to the **logo forest green** (`#1E7F12`, AA 5.1:1) with **light chrome** and the logo red as a brand-only accent. Added design enhancements E1–E12 to `02-design-system.md`.
- Roadmap: added Phase F (functional tiers) and wired E1–E12 into Phases 2–3.
- Mockup updated to the light forest-green theme with the logo mark, green→red brand strip and working-period selector.
Verified: mockup rendered in browser; contrast ratios computed for the ramp.
Notes: user approved committing WIP and asked for logo colours + lighter chrome.

## 2026-10-02 — Planning
Branch: (none, docs only)
Changed: added `docs/redesign/` (analysis, design system, security plan, roadmap, this changelog) and `mockups/app-frame.html` (clickable static mockup of the desktop frame on the Employees register)
Verified: n/a (documentation)
Notes: 12 security findings recorded (2 High: S1 impersonation-cookie bypass, S2 plaintext temp passwords). WIP on `main` (18 modified, 2 untracked files) must be committed before Phase 0.
