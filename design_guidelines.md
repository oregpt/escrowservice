# Escrow Service Design Guidelines

## Design Approach
**Selected Framework:** Stripe-inspired Design System
**Rationale:** Financial applications demand trust, clarity, and professional polish. Following Stripe's design language ensures users feel secure while maintaining modern aesthetics.

## Core Design Principles
1. **Trust Through Clarity** - Every transaction step is visually explicit
2. **Professional Minimalism** - Clean interfaces that inspire confidence
3. **Guided Interactions** - Clear visual hierarchy guides users through complex flows
4. **Responsive Precision** - Flawless experience across all devices

## Typography
- **Primary Font:** Inter (Google Fonts)
- **Secondary Font:** JetBrains Mono (for transaction IDs, amounts)
- **Hierarchy:**
  - H1: 3xl/4xl, font-semibold (page titles)
  - H2: 2xl/3xl, font-semibold (section headers)
  - H3: xl/2xl, font-medium (card headers)
  - Body: base/lg, font-normal
  - Small/Meta: sm/xs, font-medium (labels, timestamps)
  - Numbers/Amounts: text-2xl/3xl, font-bold (transaction values)

## Layout System
**Spacing Units:** Tailwind 4, 6, 8, 12, 16, 24 for consistent rhythm
- Page containers: max-w-7xl with px-4 md:px-6 lg:px-8
- Section spacing: py-16 md:py-24
- Component spacing: gap-6 md:gap-8
- Card padding: p-6 md:p-8

## Component Library

### Landing Page Components
**Hero Section (80vh):**
- Split layout: Left = headline + CTA, Right = dashboard preview image
- Headline emphasizes security and simplicity
- Primary CTA: "Create Escrow" + Secondary: "How It Works"
- Background: Subtle gradient with floating geometric shapes
- Trust indicators below CTAs: "Bank-level encryption • Instant settlements • 24/7 support"

**How It Works (3-step process):**
- Horizontal timeline with large step numbers
- Each step: Icon + Title + Description in card format
- Visual connectors between steps

**Features Grid (3 columns desktop, 1 mobile):**
- Security features, payment methods, dispute resolution
- Icons from Heroicons (shield, credit-card, scale)
- Each card: Icon + Title + 2-line description

**Trust Section:**
- Security badges, compliance logos
- Statistics cards: "Transactions Protected" "Success Rate" "Average Settlement Time"
- 2-column layout with metrics

**CTA Section:**
- Centered, generous padding
- Single focused message about getting started
- Large primary button

### Dashboard Interface
**Navigation:**
- Left sidebar (fixed, w-64): Logo + nav items + user profile at bottom
- Top bar: Search + notifications + profile dropdown
- Mobile: Collapsible hamburger menu

**Transaction Cards:**
- Status badge (pending/completed/disputed) - top right
- Transaction ID (monospace font)
- Amount (large, bold)
- Parties involved with avatars
- Timeline progress bar
- Action buttons (Release Funds, Dispute, View Details)

**Data Tables:**
- Zebra striping for rows
- Sortable column headers
- Inline status badges
- Row actions on hover
- Pagination at bottom

**Forms:**
- Floating labels on focus
- Clear field validation with inline messages
- Progress indicators for multi-step forms
- Disabled states clearly differentiated

## Icons
**Library:** Heroicons (Outline for navigation, Solid for actions)
- Security: shield-check, lock-closed
- Transactions: arrows-right-left, credit-card
- Users: user-circle, users
- Actions: check-circle, x-circle, exclamation-triangle

## Images

**Hero Image:**
- Large hero image: Modern dashboard screenshot showing clean transaction interface
- Position: Right 50% of hero section on desktop, below headline on mobile
- Style: Floating with subtle shadow, slight tilt (2-3 degrees)

**Feature Section Images:**
- Security section: Abstract lock/shield illustration
- Dashboard preview: Actual interface screenshot
- Mobile app mockup: Phone frame showing mobile interface

**Trust Badges:**
- Bank partnership logos (grayscale, consistent sizing)
- Security certifications (SSL, PCI compliance)

## Page-Specific Layouts

**Landing Page:**
1. Hero with dashboard preview image
2. How It Works timeline
3. Features grid (3-column)
4. Security/Trust section with badges
5. Testimonials (2-column cards)
6. FAQ accordion
7. Final CTA section
8. Footer with links, social, newsletter signup

**Dashboard:**
- Sidebar navigation
- Main content area with page title + action button
- Summary cards row (4 metrics)
- Transaction table/list
- Pagination

**Transaction Details:**
- Breadcrumb navigation
- Transaction header (ID, amount, status)
- Two-column layout: Timeline left, Details/Actions right
- Chat/messaging section at bottom
- Document uploads area

## Animations
Minimal, purposeful only:
- Button hover: subtle scale (1.02)
- Card hover: soft shadow transition
- Page transitions: fade only
- Status changes: smooth badge color transition
- NO scroll animations, parallax, or complex motion

## Special Considerations
- All monetary amounts use consistent formatting ($X,XXX.XX)
- Status colors must be immediately distinguishable
- Critical actions (Release Funds) require confirmation modal
- All timestamps show relative time with absolute on hover
- Buttons on images have backdrop-blur-sm background

This design creates a professional, trust-inspiring platform that balances visual appeal with functional clarity essential for financial transactions.