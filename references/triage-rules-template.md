# Email Triage Rules

These rules define how emails should be classified during triage.

## Mode

**current_mode: review**

Options: `review` (present recommendations before labeling) | `auto` (label
automatically and present a summary afterward)

---

## Rules

<!-- Add your rules below. Each rule should describe a category of email to
     classify, the signals that identify it, and any exceptions. -->

### 1. [Rule Name]

[Description of what this rule catches and what label to apply.]

**Signals:**

- [What to look for in the sender, subject, or body]
- [Patterns, keywords, or platform indicators]

**Exceptions — DO NOT apply this label if:**

- [Conditions where this rule should be skipped]

### 2. [Rule Name]

[Description]

**Signals:**

- [Signal]

**Exceptions — DO NOT apply this label if:**

- [Exception]

<!-- Add as many rules as you need. Common categories include:
     - Vendor solicitations & cold outreach → Suspected Junk
     - Newsletters & marketing emails → Suspected Junk
     - Automated platform notifications → Suspected Junk
     - Social media notifications → Suspected Junk
     - Transactional receipts → Informational
     - Calendar invites from known contacts → Action Needed
     - Direct emails from colleagues → Action Needed -->

---

## Trusted Domains (NEVER label as Suspected Junk)

Emails from these domains are always considered important. Never classify them
as Suspected Junk unless they are clearly automated platform notifications
matched by a specific rule.

- `your-company.com` — your company domain

<!-- Add other domains you always want to keep, e.g.:
     - `client-company.com` — key client
     - `school-district.edu` — your kids' school -->

---

## Trusted Sources (specific senders to KEEP)

These specific senders or newsletters should never be classified as Suspected
Junk, even if they match a rule's signals.

- [Newsletter or sender name]

<!-- Examples:
     - `*@substack.com` — all Substack newsletters
     - Money Stuff newsletter (Matt Levine)
     - `updates@service-you-use.com` — a service you actually want updates from -->

---

## Decision Framework

When evaluating an email, follow this priority order:

1. **Is the sender from a Trusted Domain?** → Classify as Action Needed or
   Informational (unless it's an automated notification matched by a rule)
2. **Is the sender in Trusted Sources?** → Classify as Informational
3. **Is the email part of an ongoing thread where the user is in To/CC?** →
   Classify as Action Needed
4. **Does the email require a response or action from the user?** → Action
   Needed
5. **Does the email match a rule above?** → Apply the label specified by that
   rule
6. **None of the above?** → Unknown (err on the side of caution)
