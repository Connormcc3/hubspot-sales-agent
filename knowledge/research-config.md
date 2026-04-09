# Research Configuration

> Define WHAT the `research-outreach` skill should audit for each lead.
> This file is read by the agent before running `skills/research-outreach.md`.
> Edit it to match your sales offering and the value you can provide.

---

## What Should the Agent Research?

Pick ONE audit type below (or combine multiple) that aligns with what you sell. The agent will use this as the research approach when auditing lead websites/businesses.

### Option 1: SEO Audit
Best if you sell: SEO services, content marketing, web design

**What to check:**
- H1 structure (how many H1s? are they descriptive?)
- Image alt texts (how many missing?)
- Meta descriptions and titles
- Content depth and frequency
- Schema markup / structured data
- Mobile optimization
- Page load performance

**Research prompt template:**
```
SEO audit: Check H1 structure (how many H1s?), image alt texts (missing?),
meta description, content depth, blog/content section, schema markup,
mobile optimization, page load issues. Return concise findings with
specific issues and their business impact.
```

---

### Option 2: UX / Conversion Audit
Best if you sell: conversion rate optimization, UX design, web design

**What to check:**
- Clear value proposition above the fold
- Primary CTA visibility and placement
- Form friction (fields, length, errors)
- Mobile experience (thumb zones, scroll depth)
- Trust signals (testimonials, case studies, logos)
- Navigation clarity

**Research prompt template:**
```
UX audit: Check value proposition clarity on homepage, primary CTA placement
and prominence, form usability, mobile responsiveness, trust signals
(testimonials, case studies, social proof), navigation clarity. Return
specific friction points and their conversion impact.
```

---

### Option 3: Brand / Positioning Audit
Best if you sell: branding, strategy consulting, positioning services

**What to check:**
- Clarity of value proposition
- Differentiation from competitors
- Target audience clarity
- Tone consistency across pages
- Visual identity coherence
- Messaging hierarchy

**Research prompt template:**
```
Brand positioning audit: Is the value proposition clear within 5 seconds?
What makes them different from competitors? Who is the target audience?
Is tone consistent? Is visual identity coherent? Return specific messaging
gaps and their impact on customer clarity.
```

---

### Option 4: Tech Stack / Performance Audit
Best if you sell: development, DevOps, performance optimization

**What to check:**
- Frontend framework and bundle size
- Page load times (LCP, FID, CLS)
- Third-party scripts and trackers
- Image optimization
- Security headers
- Accessibility issues

**Research prompt template:**
```
Tech stack and performance audit: Detect framework, estimate bundle size,
check third-party scripts, evaluate image optimization, check security
headers and HTTPS, identify accessibility issues. Return concrete
performance/security issues and their business impact.
```

---

### Option 5: Content Strategy Audit
Best if you sell: content marketing, SEO, editorial services

**What to check:**
- Blog frequency and depth
- Topical authority in their niche
- Content format variety
- Call-to-action integration
- Email capture mechanisms
- Content update frequency

**Research prompt template:**
```
Content strategy audit: Check blog frequency, content depth per post,
topical authority in their niche, variety of content formats,
CTA integration in content, email capture mechanisms. Return gaps
in their content strategy and missed audience opportunities.
```

---

### Option 6: Competitive Analysis
Best if you sell: market research, strategy, competitive intelligence

**What to check:**
- Top 3 competitors in their space
- Positioning differences
- Pricing transparency
- Service offering comparison
- Messaging differentiation

**Research prompt template:**
```
Competitive audit: Identify 2-3 main competitors, compare positioning,
service offerings, messaging, and differentiation. Return where this
lead is stronger/weaker vs competitors and what gaps they could
exploit.
```

---

### Option 7: Custom (Define Your Own)

If none of the above fits, define your own audit approach here:

```
[YOUR CUSTOM RESEARCH PROMPT]

Describe what the agent should check on the lead's website/business,
what constitutes a "finding", and what business impact to report.

Example structure:
- What to check: [list]
- What counts as a finding: [criteria]
- How to frame impact: [business language]
```

---

## Configuration

**Active audit type:** `[EDIT THIS LINE to pick one: seo | ux | brand | tech | content | competitive | custom]`

**How to generate the email hook:**
- Use the top-3 findings as an HTML table in the email body
- Frame each finding as: **1 sentence what's wrong + 1 sentence business impact**
- Keep the rest in the full markdown report at `output/research-reports/<domain>.md`
- Always include 1-2 positive observations ("What's working") — this builds trust

**What makes a finding actionable:**
- Specific (not "content could be better" but "no H1 tag on the homepage")
- Measurable (not "slow" but "3.2 seconds page load")
- Tied to business impact (not "missing schema" but "missing schema = invisible in rich search results = lost clicks")

---

## Example Output Structure

The agent will generate reports following this template (see `skills/research-outreach.md`):

```markdown
# Research Report: example.com
**Company Name** — Industry/description
Created: 2026-04-08

## Overall Assessment
[Table with area + rating + priority]

## What's Working
- Point 1
- Point 2

## Critical Issues (Top 3 for email)
1. Issue name — description + impact
2. Issue name — description + impact
3. Issue name — description + impact

## Additional Optimization Points
- Medium-priority finding
- Medium-priority finding

## Quick Wins
- Immediately actionable item
- Immediately actionable item
```
