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
- Newsletters that match a Custom Label rule (they get that label instead)

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

These specific newsletter senders should never be archived as Suspected Junk:

- (None currently — Substack newsletters are routed to custom labels below)

---

## Custom Labels

Custom labels are applied **before** the standard classification rules. If an
email matches a custom label, it receives that label and follows the archive
behavior specified here — it is not evaluated against the built-in rules.

### RSS: Newsletters

**Label:** `RSS: Newsletters`
**Archive after labeling:** Yes

Emails matching this label are tagged for the user's RSS reader pipeline and
removed from the inbox.

**Matching criteria:**

- `*@substack.com` — All Substack newsletters (any sender with a substack.com
  domain, including custom subdomains like `newsletter@example.substack.com`)
- Money Stuff newsletter by Matt Levine (from Bloomberg, typically sent from
  `noreply@mail.bloombergbusiness.com` or similar Bloomberg addresses with
  subject containing "Money Stuff")

**Exceptions — do NOT apply this label if:**

- The email is a direct personal reply or conversation (not a bulk newsletter
  send)
- The email is an account notification from Substack (e.g., password reset,
  billing) rather than a newsletter post

---

## Decision Framework

When evaluating an email, follow this priority order:

1. **Does the email match a Custom Label rule?** → Apply that custom label and
   follow its archive behavior. Stop here — do not evaluate further.
2. **Is the sender from a Trusted Domain?** → KEEP
3. **Is the user in the To/CC field and the email is part of an ongoing thread?** → KEEP
4. **Does the email require a response or action from the user?** → KEEP
5. **Does the email match any archive rule above?** → ARCHIVE
6. **When in doubt** → KEEP
