---
title: Onboarding Redesign
type: Task
status: active
created: 2026-02-11
current_step: 3
---

# Onboarding Redesign

## Observations
- [description] Simplify onboarding from 7 steps to 3: Install → Connect GitHub → See first metric
- [status] active
- [assigned_to] Lena Vogt
- [started] 2026-02-11
- [current_step] 3
- [priority] high
- [target_date] 2026-02-20

## Steps
1. [x] Design new 3-step flow mockups
2. [x] Get approval from Maya (approved Feb 11)
3. [ ] Implement new onboarding UI — 70% done as of Feb 14
4. [ ] Remove email verification from onboarding flow
5. [ ] Implement PKCE OAuth flow (replacing implicit grant)
6. [ ] User testing with 3 beta testers
7. [ ] Ship to production

## Context
- Old flow: 7 steps (install, verify email, create team, invite members, set preferences, connect GitHub, view dashboard)
- New flow: 3 steps (install, connect GitHub via PKCE OAuth, see first metric)
- Email verification moves to settings page
- Team invite becomes optional post-onboarding
- Key metric: "time to first value" — target under 60 seconds
- Lena's mockups in Figma: figma.com/file/stl-onboarding-v2
- Blocked on OAuth PKCE changes (Raj working on it)
- Trial-to-paid conversion currently 23%, target 30% after redesign

## Relations
- assigned_to [[Lena Vogt]]
- blocked_by [[Raj Patel]]
- relates_to [[Cortex AI]]
