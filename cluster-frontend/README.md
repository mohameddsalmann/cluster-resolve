# Cluster Resolve Dashboard

Build and redesign the FRONTEND/UI ONLY for an existing product called:

Cluster Resolve

The frontend must look visually like it belongs to the SAME brand family as the original Cluster website:

https://clusterapp.net/

I am also uploading the original Cluster logo asset.

This is NOT a request to invent a new visual identity.

The goal is:

Take the real Cluster public brand identity and translate it into a modern 2026 B2B operations dashboard.

The result should feel like:

“Cluster built an internal procurement reliability product using the same brand and design system.”

Do NOT make it look like a generic SaaS dashboard with a Cluster logo pasted on top.

IMPORTANT — FRONTEND ONLY

Another coding agent is implementing the real backend/system.

Do NOT modify:

supabase/**
packages/core/**
packages/schemas/**
apps/web/lib/db/**
apps/web/lib/supabase/**
apps/web/lib/imports/**
apps/web/app/api/**
database migrations
generated DB types
environment variables
backend tests


Do NOT:

create Supabase logic

modify database schema

add fake APIs

add Auth

add login/signup

change backend contracts

add mock backend services

You are responsible for:

frontend pages
layouts
navigation
design tokens
components
responsive behavior
loading states
empty states
error states
tables
widgets
charts
visual polish


Use a separate UI branch/worktree if Git is available.

Suggested branch:

ui/cluster-resolve


USE THE ORIGINAL CLUSTER BRAND — NOT A NEW BRAND

Study the public website:

https://clusterapp.net/

and use the supplied Cluster logo.

The following design tokens come from the existing Cluster website and should be treated as the base visual identity.

1. EXACT CLUSTER COLOR SYSTEM

Main Cluster Blue

#2d66eb


Use for:

navigation chrome

application sidebar/header

important brand surfaces

selected navigation treatment where appropriate

This is the dominant structural blue of Cluster.

Deep Cluster Blue

#0e4da4


Use for:

primary CTA buttons

important actions

strong institutional accents

primary hover/active treatment

Bright Cluster Blue

#0f6eff


Use for:

interactive accents

links

selected controls

active tabs

icon chips

secondary actions

focus states

2. ORIGINAL CLUSTER NEUTRALS

Use:

Heading / Ink:
#1c1b2e

Body / Secondary:
#6d859e

Soft Surface:
#f6f9fc

White:
#ffffff

Modern Border:
#dce5f0


The application should be approximately:

70–80% white / very light surfaces
10–15% soft #f6f9fc grouping
brand blue used selectively for navigation/actions


Do NOT make the entire dashboard blue.

3. CLUSTER IS NOT A GRADIENT BRAND

Very important.

Do NOT use:

purple gradients

AI gradients

mesh gradients

aurora backgrounds

glassmorphism

neon

cyberpunk

glowing blobs

huge blurred backgrounds

dark SaaS design

The original Cluster visual identity is:

flat color
+
white space
+
blue navigation
+
blue interaction
+
clean product imagery


Preserve that restraint.

4. LOGO — USE THE SUPPLIED ASSET

Use the uploaded Cluster logo exactly as supplied.

Do NOT:

redraw it

regenerate it with AI

change the wordmark

change spacing

stretch it

recolor it

add another icon beside it

rewrite “cluster” using a font

Preserve its aspect ratio.

Use the full logo in the main desktop navigation.

Preferred desktop width:

130–150px


For mobile or collapsed navigation, use the existing Cluster C mark only if it can be cleanly derived from the supplied asset without redesigning it.

The logo should normally live on a Cluster-blue navigation surface where the white wordmark is clear.

5. TYPOGRAPHY

Use:

Poppins

Load actual weights:

400
500
600
700
800


Do NOT reference font-weight 900 unless you genuinely load it.

Use Poppins everywhere in the English UI.

If Arabic UI is previewed later, use:

Tajawal

as the Arabic companion.

PRODUCT TYPOGRAPHY SCALE

Do NOT copy the giant marketing typography literally.

Translate it to an operational web product.

Use approximately:

Page title:
36–42px / 700–800

Major section:
24–30px / 700

Card/widget heading:
18–20px / 600–700

Body:
16–18px / 400

Table:
14–15px / 400–500

UI label:
13–14px / 500–600

Small metadata:
12–13px / 500


Large headings may use:

letter-spacing: -0.02em


or similarly restrained negative tracking.

Body line-height:

1.5–1.6


The interface should remain spacious and readable.

6. MODERN CLUSTER RADIUS SYSTEM

Use the newer Cluster design language rather than the old inconsistent 5px marketing-template radius.

Use:

8px  → small controls
12px → standard cards, panels, inputs
16px → larger feature surfaces
999px → chips / pills


Primary card/panel radius:

12px

Do NOT create wildly different radii across pages.

7. CLUSTER BORDER SYSTEM

Primary border:

#dce5f0


Use:

1px solid #dce5f0


or restrained equivalents.

Do not box every element aggressively.

Use:

whitespace
+
thin borders
+
soft elevation


to create hierarchy.

8. CLUSTER SHADOW SYSTEM

Cluster uses blue-tinted elevation.

Use this for important elevated cards:

box-shadow: 0 20px 60px rgba(14, 77, 164, 0.12);


Interactive hover may use:

box-shadow: 0 20px 50px rgba(15, 110, 255, 0.20);


Do NOT use:

large grey shadows
black shadows
huge floating cards


Most surfaces should remain relatively flat.

9. INPUT / FOCUS STYLE

Use the modern Cluster form language.

Input resting state:

background: #f6f9fc
border: #dce5f0
radius: 8px


Active:

background: white
border-color: #0f6eff


Focus:

box-shadow: 0 0 0 3px rgba(15, 110, 255, 0.10);


Labels:

14px
600
#1c1b2e


This style is especially important on:

Imports

10. SIGNATURE BLUE ICON CHIP

One of the strongest original Cluster components is:

80×80
#0f6eff
20px radius
white icon


Translate this into a reusable product icon system.

Create variants:

40×40 compact
48×48 standard
64×64 feature
80×80 large/empty state


Keep:

Cluster Bright #0f6eff
+
simple white icon
+
rounded geometry


Use this for:

Imports

Orders

Suppliers

Regulatory

Traceability

Decision Replay sections

empty states

Do NOT use dozens of unrelated icon colors.

11. BUTTON DESIGN

Primary

background: #0e4da4
color: white
radius: 8–12px
height: 44–48px
font: Poppins 600–700


Secondary

background: white
border: 1px solid #0f6eff
color: #0f6eff


Tertiary

transparent
blue text


Preserve a refined version of the original Cluster:

left-to-right button wipe

as a subtle brand interaction.

Do NOT overdo it.

Duration:

200–350ms


Normal UI transitions:

150–250ms


12. APPLICATION SHELL

The original website uses a blue navigation header.

Translate that into a dashboard.

Preferred desktop layout:

┌──────────────────────┬────────────────────────────────────┐
│                      │                                    │
│  Cluster blue        │   White top context bar            │
│  sidebar             │                                    │
│                      ├────────────────────────────────────┤
│  Logo                │                                    │
│                      │                                    │
│  Resolve             │   White-dominant content           │
│  Orders              │                                    │
│  Suppliers           │                                    │
│  Regulatory          │                                    │
│  Traceability        │                                    │
│  Imports             │                                    │
│                      │                                    │
└──────────────────────┴────────────────────────────────────┘


Sidebar:

background: #2d66eb


Desktop width approximately:

220–250px


Logo at top.

Navigation text:

white / translucent white


Selected navigation item:

white or softly translucent blue/white surface

clearly visible

rounded 8–12px

no neon glow

The sidebar is the dashboard translation of Cluster's original blue header.

13. MOBILE NAVIGATION

On mobile:

Use a Cluster-blue top navigation bar.

Include:

Cluster logo

menu button

page title/context if space allows

Navigation opens as an accessible drawer.

No content should disappear between tablet breakpoints.

Test:

1440
1280
1024
768
390


14. CONTENT SHELL

Primary product shell:

max-width: ~1440px


Normal content:

~1200px


Use wider space only for:

large tables

decision comparison

operational queues

Desktop gutters:

24–32px


Mobile:

16–20px


Do not stretch prose to full-screen width.

15. SPACING SYSTEM

Use only a normalized spacing system:

4
8
12
16
24
32
48
64
80
96
128


Do NOT create random margins.

Do NOT use empty spacer divs.

16. PRODUCT DESIGN CHARACTER

The frontend should feel:

pharmaceutical
operational
trustworthy
modern
Egyptian B2B SaaS
clean
confident
high quality
calm


NOT:

consumer fintech
generic admin dashboard
AI startup landing page
crypto dashboard
dark enterprise console
hospital management software


17. MAIN NAVIGATION

Use:

Resolve
Orders
Suppliers
Regulatory
Traceability
Imports


Decision Replay should be opened from relevant orders/decisions rather than permanently cluttering the main navigation.

18. HEADER CONTEXT

White content header.

Show:

page name

contextual subtitle where useful

active dataset

dataset mode

source status

Dataset chips:

SAMPLE
IMPORTED REAL
LIVE


No:

fake avatar

notification bell with fake alerts

account menu

login/logout

organization switcher

This v1 intentionally has no Auth.

19. RESOLVE PAGE

Route:

/


Primary title:

Resolve

Subtitle:

Procurement reliability and regulatory risk

Do NOT make a generic analytics homepage.

Primary question:

What needs attention?

Use a strong operational queue.

Each Attention Item contains:

severity
type icon
title
reason
affected entity
time
impact
drill-down


Example frontend preview:

HIGH

Order ORD-DEMO-1002

Partial fulfillment from SUP-DEMO-02

Requested 120 · Filled 72

View order →


Use synthetic demo IDs only inside clearly UI-only preview fixtures.

20. OPERATIONAL PULSE

Below Needs Attention, create compact metrics.

Not giant KPI cards.

Examples:

Orders evaluated
Orders with exceptions
Suppliers under watch
Decisions evaluable
Regulatory exposures


Each metric should support:

value
coverage
state
evidence


Cards should be:

white

12px radius

thin #dce5f0 border

restrained elevation only if needed

21. ORDERS PAGE

Route:

/orders


Build a clean operational table.

Columns:

Order
Pharmacy
Placed
Supplier
Requested
Filled
Delivery
Exception
Decision Quality
Regulatory


Filters:

All
Healthy
Exceptions
Late
Partial
Cancelled
High Regret
Regulatory


Status chips should be compact rounded pills.

Use semantic colors only for statuses.

Brand blue remains the primary interface color.

Do NOT use status color as the entire card background.

22. ORDER DETAIL

Create a structured order detail page.

Sections:

Order Summary
Requested Items
Supplier
Actual Outcome
Exceptions
Procurement Decision
Regulatory Exposure
Evidence


Use white panels separated by spacing.

Avoid nesting cards inside cards inside cards.

23. DECISION REPLAY — HERO TECHNICAL SCREEN

Route:

/decisions/[id]


This is one of the most important screens.

The visual story should be:

INPUTS
    ↓
AVAILABLE OFFERS
    ↓
SELECTED
    ↓
ACTUAL OUTCOME
    ↓
ALTERNATIVE
    ↓
DECISION QUALITY


Build this as a premium forensic view.

Decision Header

Display:

Decision ID
Time
Agent
Agent Version
Confidence


Order Context

Display:

Pharmacy
Products
Requested Quantities


What Was Known

Create a clean comparison table:

Supplier
Price
Discount
Available
Promised
Feasible
Selected


Selected supplier:

Use restrained:

#0f6eff


highlight.

Not a huge blue block.

Selection Reason

If none:

No selection reason was provided.


Never invent a reason.

Actual Outcome

Use a clean Cluster-styled timeline.

Examples:

Requested
Accepted
Delivered
Partial/Late/Cancelled


Better Alternative

Clean side-by-side comparison.

Decision Quality

Use explainable metrics:

Price difference
Unfilled units
Lateness
Cancellation impact


If monetary operational regret appears:

show a visible:

Estimate


badge.

Evidence

Reusable action:

Show underlying records


24. SUPPLIERS PAGE

Route:

/suppliers


This is reliability only.

Do NOT recreate a supplier ecommerce dashboard.

Columns:

Supplier
Status
Evaluated Orders
Fill Rate
OTIF
Cancellation
Partial Fill
P95 Lead Time
Recent Change


Supplier status:

HEALTHY
WATCH
HIGH
INSUFFICIENT DATA


25. SUPPLIER DETAIL

Use:

Reliability Overview

Compact metric strip.

Then:

Recent vs Baseline

Examples:

Fill Rate
96% → 78%

OTIF
91% → 76%

Cancellation
2% → 9%


Use clean comparison widgets rather than complicated statistical visualizations.

Then:

Why Flagged
Affected Orders
Affected Decisions


26. REGULATORY PAGE

Route:

/regulatory


Tabs:

EDA Alerts
Exposure
Expiry Recovery


Use Cluster Blue active tab treatment.

EDA Alerts

Display:

Official source
Notice number
Type
Publication date
Product
Manufacturer
Batch
Source


Badges:

Official EDA source
Manual-assisted ingestion


Do NOT show fake automatic synchronization.

Exposure

Separate strongly:

Exact Matches


from:

Possible Matches


Never visually imply possible matches are confirmed.

Expiry Recovery

Compact widgets:

Expired
<30 days
30–90 days


Then table:

Supplier
Product
Batch
Expiry
Quantity
Estimated Value
Source Order


Button:

Export recovery preparation CSV


27. TRACEABILITY

Route:

/traceability


Title:

EPTTS Preflight

Subtitle:

Prototype validation against verified rules

Upload area should use the same polished Cluster form language.

Verdict:

PASS
FAIL
NOT EVALUATED


Finding groups:

Blocking Findings
Advisory Findings
Needs Verification


Table:

Row
Rule
Field
Actual
Expected
Message
Verification


Never display:

EDA approved
EDA compliant
EDA will reject


28. IMPORTS PAGE

Route:

/imports


This page needs special visual attention.

Backend is being implemented separately.

Expected real flow:

Dataset
→ Import Type
→ File
→ Direct Supabase upload
→ Processing
→ Result


Design:

Dataset

Clean selector.

Mode badge:

SAMPLE
IMPORTED REAL
LIVE


Import Type

Use 4 clean selection cards or segmented controls:

Orders
Offers
Outcomes
Decisions


Each may use a Cluster blue icon chip.

File Upload

Create a premium dropzone.

Style:

white / #f6f9fc
1–1.5px #dce5f0 border
12px radius
blue active state
large blue upload icon chip


Show:

filename
size
upload progress
upload complete
validating
processing
complete
failed


Processing Result

Status:

SUCCESS
PARTIAL SUCCESS
ALREADY IMPORTED
IN PROGRESS
FAILED


Metrics:

Processed
Accepted
Rejected


Row Errors

Table:

Row
Field
Code
Message
Raw Value


Data Quality

Create compact Cluster widgets for:

Orders ready for evaluation
Outcome coverage
Decisions with offer context
Comparative replay coverage


States:

AVAILABLE
PARTIAL
INSUFFICIENT DATA


Never display “no data” as a real 0%.

29. SHARED COMPONENT SYSTEM

Create reusable frontend components.

Suggested:

AppShell
Sidebar
TopContextBar
MobileNavigation

PageHeader
SectionHeader

ClusterButton
ClusterIconChip

StatusChip
SeverityBadge
DatasetModeChip
SourceBadge

Metric
CoverageMetric
ComparisonMetric

AttentionItem
EvidenceLink

DataTable
ResponsiveDataList

EmptyState
LoadingState
ErrorState

Timeline
FindingBadge

UploadDropzone
UploadProgress
ImportResult


All must share one token system.

30. TABLE DESIGN

Tables are important to this product.

Use:

white background
subtle separators
#f6f9fc table header
#1c1b2e important values
#6d859e secondary text


Header labels:

13–14px / 600


Rows:

48–56px minimum desktop height


Hover:

very subtle soft blue tint.

Selected row:

restrained Cluster Bright indicator.

Avoid full-border spreadsheet appearance.

31. EMPTY STATES

Empty states should use the Cluster blue icon-chip language.

Example:

[blue icon]

No outcome data yet

Import outcomes before supplier reliability can be evaluated.

Import outcomes →


Never fabricate metrics to make empty screens look busy.

32. LOADING STATES

Use skeletons.

Do NOT use a blocking full-page spinner/preloader.

Skeletons should have:

light neutral backgrounds

gentle animation

no flashy shimmer

33. ERROR STATES

Use calm clear messaging.

Do not dump technical errors.

Example:

We couldn't process this file.

3 rows contain invalid timestamps.

Review errors →


Semantic red may be used for true error state only.

34. CHARTS

Use charts only where useful.

Good:

Supplier recent vs baseline
Reliability trend
Fill / OTIF comparison
Exposure composition


Bad:

decorative pie charts
fake analytics
10 charts on one page
meaningless sparklines


Chart styling:

Cluster blues first

semantic colors only when required

very light grid lines

Poppins labels

no gradients

no 3D charts

35. RESPONSIVE

Test:

1440px
1280px
1024px
768px
390px


Desktop is founder-demo priority.

Mobile must still work properly.

Do NOT hide meaningful content at tablet widths.

Tables may become:

scrollable table
or
mobile list/card presentation


depending on information density.

36. ACCESSIBILITY

Include:

visible focus states

semantic headings

keyboard navigation

accessible dialogs

proper table headers

44px minimum important touch targets

sufficient contrast

status communicated through text + icon, not color only

reduced motion support

37. BRAND HONESTY

Because this is not an official Cluster product, show:

Unofficial candidate prototype


in a small unobtrusive area.

Suggested footer text:

Unofficial candidate prototype.
Not connected to Cluster production systems.


Do not make it visually dominant.

Do not alter the Cluster logo to include this label.

38. DO NOT MAKE IT LOOK LIKE SHADCN DEFAULT

If using existing shadcn components, restyle them fully.

The finished design must NOT look like:

default shadcn
default Vercel dashboard
default Tailwind admin
generic Linear clone
generic Stripe clone
generic AI dashboard


The design itself must visibly carry Cluster's identity.

39. MOST IMPORTANT VISUAL TEST

When someone sees the interface without reading the title, they should recognize the same visual family as the original Cluster website because of:

#2d66eb navigation chrome
+
original Cluster logo
+
Poppins
+
white-dominant canvas
+
#f6f9fc surfaces
+
#1c1b2e headings
+
#6d859e secondary text
+
#0e4da4 primary actions
+
#0f6eff active accents
+
12px modern cards
+
blue-tinted shadows
+
blue icon chips
+
flat/no-gradient visual language


40. FINAL VERIFICATION

Before finishing, verify:

Original Cluster logo used correctly: YES
Core Cluster colors used: YES
Poppins used: YES
White-dominant layout: YES
No AI gradients: YES
No dark dashboard theme: YES
No glassmorphism: YES
12px modern Cluster radius language: YES
Blue-tinted shadows: YES
Cluster-style focus state: YES
Cluster blue icon chips: YES
Responsive: YES
Backend files modified: NO
Supabase modified: NO
Database modified: NO
Auth added: NO
Fake production values in real data paths: NO
Unofficial prototype label visible: YES


At the end report:

UI WORK COMPLETE: YES / NO

BACKEND FILES MODIFIED:
NO

SUPABASE MODIFIED:
NO

DATABASE MODIFIED:
NO

AUTH ADDED:
NO

RESPONSIVE:
YES / NO

ORIGINAL CLUSTER VISUAL LANGUAGE:
MATCHED / NOT MATCHED

LOGO:
ORIGINAL SUPPLIED ASSET USED

READY TO MERGE WITH CODEX SYSTEM:
YES / NO

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3ffed25a-1780-4e03-86db-290e9c760821).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
