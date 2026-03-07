# Email Archive Rules

These rules define which emails should be archived and labeled "Suspected Junk"
during email triage.

## Mode

**current_mode: review**

Options: `review` (present recommendations before archiving) | `auto` (archive
automatically and log results)

---

## Rules

### 1. Vendor Solicitations & Cold Outreach

Archive emails that are unsolicited sales pitches, product demos, or partnership
requests from companies the user has no existing relationship with.

**Signals:**

- Sender is not from a known domain (see Trusted Domains below)
- Subject contains phrases like: "demo", "free trial", "partnership opportunity",
  "quick call", "touching base", "following up" (with no prior thread)
- Body contains sales language: "I'd love to show you", "are you the right person",
  "boost your", "save you time", "schedule a call"
- Sent from sales/marketing platforms (outreach.io, salesloft, hubspot tracking links,
  mailchimp, etc.)

**Exceptions — DO NOT archive:**

- None

### 2. Newsletters & Marketing Emails

Archive bulk marketing emails, promotional content, and subscription newsletters.

**Signals:**

- Contains "unsubscribe" link in footer
- Sent via bulk email platforms (Mailchimp, Constant Contact, SendGrid marketing,
  HubSpot)
- Subject contains: "newsletter", "digest", "weekly roundup", "monthly update"
  (from non-trusted-domain senders)
- From addresses with patterns like: marketing@, news@, hello@, noreply@
  (from non-trusted-domain senders)

**Exceptions — DO NOT archive:**

- Newsletters the user has explicitly opted into (see Trusted Sources below)

### 3. Automated Platform Notifications

Archive routine automated notifications that don't require action.

**Signals:**

- Zoom: recording ready, meeting summary notifications (from no-reply@zoom.us)
  — ALWAYS archive these
- Google Workspace: storage warnings, security alerts for routine sign-ins
- LinkedIn: "who viewed your profile", "jobs you may be interested in"

**Exceptions — DO NOT archive:**

- Calendar invites from known contacts
- Security alerts about suspicious or unrecognized sign-ins

### 4. Booking Confirmations & Order Notifications

Archive automated booking confirmations, order confirmations, and shipping
notifications that simply confirm a transaction or reservation already made.

**Signals:**

- Subject contains: "booking confirmation", "order confirmation", "shipped",
  "delivery", "tracking", "your order", "reservation confirmed"
- From automated systems for gyms, fitness classes, restaurants, travel, etc.
- Amazon order/shipping notifications

**Exceptions — DO NOT archive:**

- Emails requesting payment or containing invoices that need review
- Delivery problem notifications (failed delivery, return required)
- Emails where the user needs to take action (e.g., check in, print ticket)

### 5. Social Media & Community Notifications

Archive social media notifications and community digest emails.

**Signals:**

- From LinkedIn, Twitter/X, Facebook, Reddit, Quora, Medium
- Subject contains: "new connection", "trending", "digest", "you appeared in"

**Exceptions — DO NOT archive:**

- Direct messages from people (as opposed to platform notifications)

---

## Trusted Domains (NEVER archive)

- `testcompany.com` — user's company domain

## Trusted Sources (newsletters to KEEP)

- `*@substack.com` — All Substack newsletters (pattern match)
- Money Stuff newsletter (Matt Levine)

---

## Decision Framework

When evaluating an email, follow this priority order:

1. **Is the sender from a Trusted Domain?** → KEEP (unless it's a Rule 3 automated
   notification)
2. **Is the user in the To/CC field and the email is part of an ongoing thread?**
   → KEEP
3. **Does the email require a response or action from the user?** → KEEP
4. **Does the email match any archive rule above?** → ARCHIVE
5. **When in doubt** → KEEP (false negatives are better than false positives)
