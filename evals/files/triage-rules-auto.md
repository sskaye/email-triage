# Email Archive Rules

These rules define which emails should be archived and labeled "Suspected Junk"
during email triage.

## Mode

**current_mode: auto**

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

**Exceptions — DO NOT archive:**

- None

### 2. Newsletters & Marketing Emails

Archive bulk marketing emails, promotional content, and subscription newsletters.

**Signals:**

- Contains "unsubscribe" link in footer
- Sent via bulk email platforms (Mailchimp, Constant Contact, SendGrid marketing)
- From addresses with patterns like: marketing@, news@, hello@, noreply@

**Exceptions — DO NOT archive:**

- Newsletters the user has explicitly opted into (see Trusted Sources below)

### 3. Automated Platform Notifications

Archive routine automated notifications that don't require action.

**Signals:**

- Zoom: recording ready, meeting summary notifications
- LinkedIn: "who viewed your profile", "jobs you may be interested in"

**Exceptions — DO NOT archive:**

- Calendar invites from known contacts
- Security alerts about suspicious or unrecognized sign-ins

### 4. Booking Confirmations & Order Notifications

Archive automated booking confirmations, order confirmations, and shipping
notifications.

**Signals:**

- Subject contains: "booking confirmation", "order confirmation", "shipped",
  "delivery", "tracking", "your order"

**Exceptions — DO NOT archive:**

- Delivery problem notifications
- Emails requesting payment or containing invoices

---

## Trusted Domains (NEVER archive)

- `testcompany.com` — user's company domain

## Trusted Sources (newsletters to KEEP)

- `*@substack.com` — All Substack newsletters

---

## Decision Framework

When evaluating an email, follow this priority order:

1. **Is the sender from a Trusted Domain?** → KEEP
2. **Is the user in the To/CC field and the email is part of an ongoing thread?** → KEEP
3. **Does the email require a response or action from the user?** → KEEP
4. **Does the email match any archive rule above?** → ARCHIVE
5. **When in doubt** → KEEP
