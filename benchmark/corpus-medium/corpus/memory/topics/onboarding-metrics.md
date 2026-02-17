---
title: Onboarding Metrics
type: note
permalink: topics/onboarding-metrics
---

# Onboarding Metrics

## Observations
- [source] Posthog analytics
- [last_updated] 2026-02-06
- [trial_to_paid_conversion] 23%
- [target_conversion] 30%

## Current Funnel (7-Step Flow)
- Step 1 — Install CLI: 100%
- Step 2 — Create account: 89%
- Step 3 — Verify email: 71%
- Step 4 — Create team: 52%
- Step 5 — Invite members: 38%
- Step 6 — Connect GitHub: 34%
- Step 7 — View dashboard: 28%

## Key Drop-offs
- Step 3→4 (email verification → create team): 19% drop — email verification is friction
- Step 5→6 (invite members → connect GitHub): 4% drop — OAuth flow is confusing
- Overall: only 28% of users who install ever see their first metric

## New Flow (3-Step, In Progress)
- Step 1 — Install CLI
- Step 2 — Connect GitHub (PKCE OAuth)
- Step 3 — See first metric
- Target: 60%+ completion rate
- "Time to first value" target: under 60 seconds
- Email verification moved to settings page
- Team invite becomes optional post-onboarding

## Impact Projections
- If completion rate doubles (28% → 56%): estimated +15 paying teams/month
- At $9/seat avg 3 seats: +$405/mo MRR
- Combined with free tier cap changes: potential +$600-800/mo MRR

## Relations
- relates_to [[Onboarding Redesign]]
- relates_to [[Lena Vogt]]
- relates_to [[Pricing Strategy]]
