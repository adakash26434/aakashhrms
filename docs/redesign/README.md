# AakashHRMS Redesign & Hardening

This folder is the **single source of truth** for the desktop-style redesign
and the security hardening of AakashHRMS. Read it before changing any UI or
auth code.

| Doc | Purpose |
|---|---|
| [01-project-analysis.md](01-project-analysis.md) | What the system is today: architecture, modules, routes, UI audit, metrics |
| [02-design-system.md](02-design-system.md) | Target look and feel: app frame, tokens, typography, component kit, screen templates, shortcuts |
| [03-security-plan.md](03-security-plan.md) | Security findings (S1–S12), fixes, and the standing rules for all redesign work |
| [04-roadmap.md](04-roadmap.md) | Phased, step-by-step plan with checklists, verification gate and sign-off points |
| [05-functional-research.md](05-functional-research.md) | Research on payroll software (Business Central, Fiori, Tally, Nepal competitors), Nepal statutory facts, gap analysis, proposed functional enhancements F1–F17 |
| [mockups/app-frame.html](mockups/app-frame.html) | Clickable mockup of the desktop frame (light chrome, logo forest green) |
| [CHANGELOG.md](CHANGELOG.md) | Running log of every completed step |

**In one sentence:** keep the proven backend (services, engines,
repositories, RBAC). Close the security gaps first. Then reskin globally
through design tokens, replace the shell with a desktop-style frame (title
bar, module rail, section navigator, command toolbar, status bar, Ctrl+K
palette), and migrate each module onto shared Register / Editor / Process /
Report / Settings templates.
