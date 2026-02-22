---
title: Pricing Strategy
type: note
permalink: topics/pricing-strategy
---

# Pricing Strategy

## Observations
- [current_pricing] $9/mo per seat (team plan), free for solo developers
- [mrr] $2,100 (as of Feb 12)
- [paying_teams] 65
- [free_users] 340 solo users
- [enterprise_inquiries] 2 (both want SSO + audit logs)

## Current Model
- **Free tier:** Unlimited repos, single user, all CLI features
- **Team plan:** $9/seat/month, team analytics, shared dashboards, webhook integrations
- **Enterprise:** Not yet available — 2 inquiries pending (SSO + audit logs required)

## Free Tier Discussion (Ongoing)
- Maya considering capping free tier at 3 repos (raised Feb 5)
- Concern: 12 "solo" users have >5 repos and >3 active contributors — gaming the system
- These 12 accounts generate 18% of API traffic but pay $0
- If capped at 3 repos: ~30 users affected, ~8 would likely convert to paid
- Estimated impact: +$200-400/mo MRR
- Raj argues against caps: "developers hate artificial limits"
- Decision deferred — Maya reviewing usage data (as of Feb 14)

## Competitive Pricing
- LinearB: $30/seat/month (enterprise-focused)
- Sleuth: $20/seat/month
- Swarmia: $15/seat/month
- Our $9/seat is the cheapest — positioned for small teams and startups

## Potential Enterprise Tier
- SSO (SAML/OIDC)
- Audit logs
- Custom data retention
- Dedicated support
- Estimated pricing: $25-30/seat/month
- Not on roadmap until Q2 2026

## Relations
- owned_by [[Maya Chen]]
- relates_to [[Competitive Landscape]]
- relates_to [[Cortex AI]]
