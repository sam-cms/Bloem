# Prebloom — Pricing Strategy

> **Last Updated:** 2026-02-01  
> **Status:** Draft for Review

---

## Competitive Landscape

### Direct Competitors (Idea Validation)

| Tool | Pricing | Model | Key Differentiator |
|------|---------|-------|-------------------|
| **Torrn** | Free (3/mo), $5/mo (30), $19 one-time (200) | Per-scan | 10+ AI personas, brutally honest |
| **ValidatorAI** | $49 for 3 calls | Per-session | Live chat with AI, landing page builder |
| **IdeaProof** | Free | Freemium | Market analysis in 120s |
| **ProductGapHunt** | Free/Paid | Freemium | Gap analysis focus |
| **Founderpal** | Free | Free | Quick 10-second validation |

### Key Insights

1. **Free tier is table stakes** — Every competitor offers free validation
2. **Price per scan: $0.10-0.25** is the sweet spot for paid tiers
3. **One-time purchases** are popular with indie hackers (no subscription fatigue)
4. **Brutal honesty** is a selling point (Torrn leads here)
5. **Multi-agent/persona** is a differentiator (Torrn has 10+, we have 4)

---

## Prebloom's Positioning

### Unique Value Props

1. **Multi-agent council** — Bull/bear debate, not just single opinion
2. **Voice-first input** — Talk through your idea naturally
3. **13 European languages** — Underserved market
4. **Privacy-focused** — Local processing options
5. **Deep Research** (planned) — On-demand market research

### Target Segments

| Segment | Need | Willingness to Pay |
|---------|------|-------------------|
| **Indie Hackers** | Quick validation, budget-conscious | $5-20/mo or one-time |
| **First-time Founders** | Comprehensive feedback | $29-49/report |
| **Accelerators/VCs** | Deal flow screening | $99-499/mo (volume) |
| **Banks/Corporates** | Innovation screening | $500-2000/mo (enterprise) |

---

## Recommended Pricing Model

### Tier 1: Free (Lead Generation)

**$0/forever**
- 2 evaluations per month
- Basic TL;DR report
- No deep research
- Prebloom watermark on exports

**Purpose:** Top of funnel, try before buy

---

### Tier 2: Founder ($19 one-time)

**$19 one-time — "Pay Once, Own Forever"**
- 25 evaluations (never expires)
- Full report + Pipeline view
- PDF export
- Email delivery
- ~$0.76/evaluation

**Purpose:** Indie hackers who hate subscriptions

---

### Tier 3: Pro ($9/month)

**$9/month**
- 15 evaluations/month
- Everything in Founder
- Deep Research feature
- Iteration mode (refine & re-evaluate)
- Priority processing
- History & comparison view

**Purpose:** Serious builders, serial entrepreneurs

---

### Tier 4: Team ($29/month)

**$29/month**
- 50 evaluations/month
- Everything in Pro
- Team sharing
- API access
- Batch evaluation
- Webhook integrations

**Purpose:** Small teams, agencies, early-stage VCs

---

### Tier 5: Enterprise (Custom)

**Starting at $199/month**
- Unlimited evaluations
- White-label option
- Custom personas/criteria
- SSO & admin controls
- Dedicated support
- Custom integrations

**Purpose:** Accelerators, banks, corporates

---

## Pricing Psychology

### Why These Numbers?

- **$19 one-time** — Below impulse buy threshold, feels like a deal
- **$9/month** — Less than a lunch, monthly commitment is low
- **$29/month** — Standard SaaS "starter team" price point
- **$199+ enterprise** — Signals "serious" without being offensive

### Competitor Positioning

```
                    CHEAP                                    PREMIUM
     |______________|_______________|_______________|_______________|
     $0            $5              $20             $50            $200+
     
     Founderpal    Torrn           Prebloom        ValidatorAI    Enterprise
     (free)        ($5/mo)         ($19 one-time)  ($49/3 calls)
```

Prebloom sits in the "premium indie" position — more value than Torrn, more accessible than ValidatorAI.

---

## Launch Strategy

### Phase 1: Free Beta (Current)
- Unlimited free access during beta
- Collect feedback, testimonials
- Build email list

### Phase 2: Soft Launch
- Introduce Founder tier ($19 one-time)
- Keep generous free tier (5/month during launch)
- Grandfather early users

### Phase 3: Full Launch
- All tiers active
- Reduce free tier to 2/month
- Add annual discounts (20% off)

---

## Revenue Projections (Conservative)

### Month 1-3 (Soft Launch)
- 100 free users
- 20 Founder purchases = $380
- **MRR: ~$380**

### Month 4-6 (Growth)
- 500 free users
- 100 Founder purchases = $1,900 total one-time
- 30 Pro subscribers = $270/mo
- **MRR: ~$270 + continued one-time sales**

### Month 7-12 (Scale)
- 2,000 free users
- 500 Founder purchases = $9,500 total
- 150 Pro subscribers = $1,350/mo
- 10 Team subscribers = $290/mo
- 2 Enterprise = $400/mo
- **MRR: ~$2,040**

### Year 1 Total
- One-time: ~$10,000
- Recurring: ~$15,000
- **Total: ~$25,000**

---

## Open Questions

1. **Should Founder tier be subscription?** One-time is popular but doesn't compound.
2. **Is $19 too cheap?** Could test $29 or $39 with deep research included.
3. **Enterprise pricing?** Need discovery calls to validate.
4. **Annual discount?** Industry standard is 20%, could do more.

---

## Next Steps

1. [ ] Validate pricing with 5-10 target users
2. [ ] Build Stripe integration with all tiers
3. [ ] Create upgrade prompts in free tier
4. [ ] Design pricing page
5. [ ] Set up usage tracking/limits

---

## Decision: Recommended Launch Pricing

| Tier | Price | Evals | Features |
|------|-------|-------|----------|
| **Free** | $0 | 2/month | Basic report |
| **Founder** | $19 one-time | 25 total | Full features |
| **Pro** | $9/month | 15/month | + Deep Research |
| **Enterprise** | Custom | Unlimited | White-label, API |

**Skip Team tier initially** — Focus on individual users first, add team features based on demand.
