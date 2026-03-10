---
name: email-triage
description: >
  Reads the user's Gmail inbox and classifies every email as Suspected Junk,
  Action Needed, Informational, Unknown, or a user-defined custom label based
  on a user-provided triage-rules.md file. Then applies Gmail labels and
  archives emails via a Google Apps Script web app.

  Use this skill whenever the user says "triage my email", "label my email",
  "sort my email", "clean up my inbox", "process my email", or anything that
  sounds like they want their inbox organized, filtered, or prioritized. Also
  trigger if the user mentions email labeling, email archiving, or inbox zero
  workflows.
license: MIT
---

# Email Triage

Scan a Gmail inbox, classify every message using the user's own rules, apply
Gmail labels, and archive suspected junk — all in one pass.

## Overview

This skill connects two tools together: the Gmail MCP connector (for reading
emails) and a Google Apps Script web app (for applying labels and archiving via
the Gmail API). The user supplies a `triage-rules.md` file that defines which
emails matter and which don't. The skill reads those rules, scans the inbox,
classifies each email, builds a JSON action plan, and sends it to the Apps
Script via Python for execution.

The Apps Script runs under the user's own Google account, has native Gmail API
access, and executes label/archive operations in seconds. Communication with
the Apps Script uses Python `urllib.request` executed via Bash, which follows
Apps Script's cross-origin redirects natively without CORS issues.

The whole flow is designed around transparency. Every "Suspected Junk",
"Unknown", and archived custom label classification gets logged with reasoning
so the user can audit decisions and correct mistakes. Over time this feedback
loop makes the rules more accurate.

---

## Step 0 — Check connectors and configuration

Before doing anything, confirm that the required connector and configuration are
in place.

**Gmail MCP connector**
Try calling `search_gmail_messages` with a simple query like `in:inbox`. If the
tool is not available or errors out, tell the user:

> The Gmail connector isn't connected. Please add it from the connectors menu
> so I can read your inbox.

**Apps Script configuration**
Read `email-triage-config.json` from the user's working folder. This file must
contain `apps_script_url` and `apps_script_secret`. If the file is missing or
either field is empty, tell the user:

> I need your Apps Script configuration to apply labels. Please follow the setup
> guide in `references/apps-script-setup.md` to deploy the Gmail Actions script
> and create `email-triage-config.json` in your working folder.

Then read and show the template from `references/email-triage-config-template.json`
so the user knows what to fill in.

**Health check** (optional but recommended)
If the config file exists, run a quick health check via Bash:

```bash
python3 -c "
import urllib.request, json
r = urllib.request.urlopen('<apps_script_url>')
print(r.read().decode())
"
```

The output should be `{"status":"ok","service":"gmail-calendar-actions",...}`.
If it errors or returns unexpected output, tell the user the Apps Script
deployment may not be working and point them to the troubleshooting section in
the setup guide.

Do not proceed until the Gmail connector is confirmed working and the config file
is loaded.

---

## Step 1 — Load the rules

Read `triage-rules.md` from the user's working folder.

If the file is missing, tell the user and point them to the template:

> I couldn't find `triage-rules.md` in your folder. This file tells me how to
> classify your emails. I've included a template at
> `reference/triage-rules-template.md` inside this skill — you can copy it to
> your working folder, customize it with your own rules, and then ask me to
> triage again.

Then read the template from `references/triage-rules-template.md` and show
its contents so the user can see what to fill in.

Once you have the rules file, parse it carefully. Pay attention to:

- The **mode** setting (review vs auto) — this controls whether you present
  results for approval or act immediately.
- Each **rule** with its signals and exceptions.
- The **Custom Labels** section — these define additional labels beyond the four
  built-in ones (Suspected Junk, Action Needed, Informational, Unknown). Each
  custom label specifies its own name, matching criteria, and archive behavior.
  Custom labels are applied **before** the standard classification — if an email
  matches a custom label rule, it gets that label instead of a built-in one.
- The **Trusted Domains** list — senders from these domains are almost always
  kept.
- The **Trusted Sources** list — specific senders or newsletters to keep.
- The **Decision Framework** priority order — follow it exactly as written.

---

## Step 2 — Scan the inbox

Use `search_gmail_messages` with a query that excludes already-labeled emails.
Build the exclusion query dynamically by including the three built-in labels
**plus** any custom labels defined in the `Custom Labels` section of
`triage-rules.md`. For example, if the rules file defines a custom label
`RSS: Newsletters`, the query becomes:

```
in:inbox -label:Suspected-Junk -label:Action-Needed -label:Informational -label:RSS-/-Newsletters
```

Gmail label names with spaces become hyphenated in search queries, and nested
labels use `-/-` as the separator (e.g., `RSS: Newsletters` → `RSS-/-Newsletters`).
The colon-space in `RSS: Newsletters` maps to `-/-` because Gmail treats `:` in
label names as a nesting separator.

This filters out emails that were classified in a previous session so you only
see new, unprocessed messages.

The search results include sender, subject, and a snippet for each message.
That's usually enough to classify an email. Only call `read_gmail_message` for
the full body when classification is genuinely ambiguous from the metadata
alone — for example, when the subject is vague and the snippet doesn't contain
enough signal to match any rule confidently.

### Batch size — hard limit of 25 emails

**Never classify more than 25 emails in a single pass.** This applies whether
the emails come from a Gmail search or are listed directly in the user's
message. If there are more than 25 to process, stop after 25, complete all
remaining steps (label, log), and then ask:

> There are more unprocessed emails in your inbox. Want me to process the next
> batch?

This keeps each session manageable and gives the user a natural checkpoint to
review results, correct mistakes, or stop. If the user says yes, process the
next 25 and repeat.

---

## Step 3 — Classify each email

For every email that wasn't skipped, run it through the decision framework
from the user's `triage-rules.md`. The framework typically works as a priority
chain — check each condition in order and stop at the first match.

First, check the email against any **Custom Labels** defined in `triage-rules.md`.
Custom label rules are evaluated before the built-in labels. If an email matches
a custom label's criteria, assign that custom label and use the archive behavior
specified for it — then move on to the next email without checking built-in labels.

If no custom label matches, assign one of the built-in labels:

| Label | Meaning |
|---|---|
| **Suspected Junk** | Email the user doesn't want to see. Matches an archive rule and no exception applies. |
| **Action Needed** | Email the user needs to respond to or take action on. |
| **Informational** | Worth reading, but no response or action required. |
| **Unknown** | Doesn't clearly match any rule. When in doubt, classify here rather than guessing wrong. |

For each email, note which rule matched (or "no match") and a brief reason why.
You'll need this for the summary and the log.

**Key principle:** False negatives are better than false positives. If you're
unsure whether something is junk, classify it as Unknown — not Suspected Junk.
The user can always reclassify, but accidentally archiving an important email
is much worse than leaving a junk email in the inbox.

**Trusted domains are not bulletproof.** The decision framework gives trusted
domains high priority, but most rules files carve out an exception: automated
notifications (Rule 3) from trusted domains should still be archived. A storage
quota warning or routine sign-in alert from the user's own company domain is
still noise. Read the framework carefully — if it says "KEEP (unless it's a
Rule 3 automated notification)", honor the exception. Only security alerts
about suspicious or unrecognized activity should be kept.

---

## Step 4 — Summarize results

How you present results depends on the mode setting in the rules file.

### Review mode

Present a summary table with your proposed classification for every email.
Include these columns:

| From | Subject | Label | Rule | Reasoning |
|---|---|---|---|---|

The user can then:
- **Approve all** — proceed to labeling.
- **Reject specific classifications** — you'll reclassify those as the user
  directs.
- **Ask questions** — explain your reasoning for any email.

Do not proceed to labeling until the user gives the go-ahead.

### Auto mode

Skip the approval step. Instead, present a brief summary after labeling is
complete:

> Processed **N** emails:
> - Suspected Junk: X
> - Action Needed: Y
> - Informational: Z
> - Unknown: W
> - [Custom Label Name]: C (include a line for each custom label that was applied)

---

## Step 5 — Label and archive via Apps Script

This step sends the classification results to the Google Apps Script web app,
which applies Gmail labels and archives emails via the Gmail API.

### Build the action plan

From your classification results, build a JSON action plan. Each email that
needs a label gets one entry. Emails classified as Unknown don't get a label
and should be omitted.

```json
{
  "secret": "<from email-triage-config.json>",
  "actions": [
    {
      "messageId": "<gmail message ID>",
      "addLabels": ["Suspected Junk"],
      "archive": true
    },
    {
      "messageId": "<gmail message ID>",
      "addLabels": ["Action Needed"],
      "archive": false
    },
    {
      "messageId": "<gmail message ID>",
      "addLabels": ["Informational"],
      "archive": false
    },
    {
      "messageId": "<gmail message ID>",
      "addLabels": ["RSS: Newsletters"],
      "archive": true
    }
  ]
}
```

Key rules for building the plan:

- **messageId**: Use the message ID from the Gmail MCP connector's search
  results. This is the unique identifier that the Apps Script uses to find the
  email.
- **addLabels**: Always a single-element array with the classification label.
  For custom labels, use the exact label name from the Custom Labels section
  of `triage-rules.md` (e.g., `"RSS: Newsletters"`). The Apps Script will
  create nested labels automatically — `RSS: Newsletters` becomes a
  `Newsletters` label nested under an `RSS` parent label in Gmail.
- **archive**: Set to `true` for Suspected Junk and for any custom label whose
  rules specify archiving. Set to `false` for Action Needed, Informational,
  and any custom label that should stay in the inbox. Always check the custom
  label's definition in `triage-rules.md` for its archive behavior.
- **Unknown emails**: Omit from the action plan entirely — they don't get a
  label or archive action.

### Execute the action plan

POST the JSON to the Apps Script URL using Python `urllib.request` via Bash.
Python follows Apps Script's cross-origin redirect natively (from
`script.google.com` to `script.googleusercontent.com`) without CORS issues.

First, write the JSON action plan to a temporary file, then POST it:

```bash
cat > /tmp/action-plan.json << 'PAYLOAD'
<json_action_plan>
PAYLOAD

python3 -c "
import urllib.request, json

with open('/tmp/action-plan.json') as f:
    payload = f.read().encode()

req = urllib.request.Request(
    '<apps_script_url>',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
resp = urllib.request.urlopen(req)
print(resp.read().decode())
"
```

Read the `apps_script_url` and `apps_script_secret` from the
`email-triage-config.json` file loaded in Step 0.

**Important:** Always write the JSON to a temporary file first rather than
inlining it in the command. This avoids shell escaping issues with large
payloads containing special characters.

### Parse the response

The Apps Script returns a JSON response:

```json
{
  "success": true,
  "processed": 5,
  "results": [
    { "messageId": "18e3a...", "status": "ok" },
    { "messageId": "18e3b...", "status": "error", "error": "Message not found" }
  ],
  "errors": []
}
```

Check the response:

- If `success` is `true`, all labels were applied and archives executed.
- If `success` is `false`, check `results` for individual failures. Report
  which specific emails failed and why.
- If Python raises an exception (network error, timeout, HTTP error), report
  the error and suggest the user check their Apps Script deployment.

### Retry failures

If any individual actions failed:

1. Collect the failed messageIds and their intended actions.
2. Build a smaller retry payload with just the failures.
3. POST again.
4. If the retry also fails, report the persistent failures to the user. They may
   need to apply those labels manually in Gmail.

---

## Step 5b — Verify labels were applied

Even with the Apps Script approach, always verify that labels were applied
correctly.

### Verification procedure

1. **Run the exclusion query.** Use `search_gmail_messages` with a query that
   excludes all built-in labels **and** all custom labels (same dynamic query
   from Step 2):

   ```
   in:inbox -label:Suspected-Junk -label:Action-Needed -label:Informational -label:<custom-label-1> ...
   ```

   This surfaces any inbox emails that are missing all labels. Note: emails
   that were archived (Suspected Junk or custom labels with archive behavior)
   won't appear in this query since they're no longer `in:inbox` — that's
   expected.

2. **Compare against your classification list.** Cross-reference the search
   results with the emails you classified in this session:
   - If an email from your list appears in the results, its label was **not
     applied** — it needs to be fixed.
   - If the only emails in the results are ones you intentionally classified as
     Unknown (which don't get a label), that's expected.

3. **Fix any missing labels.** Build a new action plan with just the missing
   emails and send it to the Apps Script again using the same Python approach
   from Step 5.

4. **Re-verify.** Run the exclusion query again. Repeat until clean.

5. **Report results to the user.** State how many labels were verified
   successfully on the first pass and how many needed to be re-applied. For
   example:

   > Verification complete. 12 of 14 labels applied successfully on the first
   > pass. Re-applied labels to 2 emails (Amazon shipping, LinkedIn digest).
   > All emails are now correctly labeled.

---

## Step 6 — Log results

Update (or create) `email-triage-log.md` in the user's working folder.

### Log format

The log is a Markdown table with these columns:

| Date | From | Subject | Label | Rule | Reason | Feedback |
|---|---|---|---|---|---|---|

- **Date**: The date of triage (today's date), not the email's sent date.
- **From**: Sender name (not full email address, to keep the table readable).
- **Subject**: Email subject line, truncated if very long.
- **Label**: The classification applied (Suspected Junk, Unknown, etc.).
- **Rule**: Which rule from triage-rules.md triggered the match (e.g.,
  "Rule 2 — Newsletters") or "No match" for Unknown.
- **Reason**: A brief explanation of why the rule matched (e.g., "Contains
  unsubscribe link, sent from noreply@example.com via Mailchimp").
- **Feedback**: Left empty — this column is for the user to annotate later
  (e.g., "false positive", "correct", "should be Action Needed").

### What to log

Log all emails classified as **Suspected Junk**, **Unknown**, or **any custom
label that archives the email**. These are the decisions most likely to need
user review because the email is removed from the inbox.

You don't need to log Action Needed or Informational emails — those stay in the
inbox and the user will see them naturally. Custom labels that don't archive
also don't need to be logged.

### Append behavior

Add new entries at the **top** of the table (newest first), below the header
row. If the file doesn't exist yet, create it with the header row and then add
entries. If the file already has entries from previous sessions, preserve them
and add new rows above.

---

## Step 7 — Reflect and log improvements

After every run, briefly review what happened and decide whether anything is
worth recording. The goal is to capture issues and opportunities that the user
would otherwise never see because the skill runs unattended.

### When to write an entry

Add an entry to `improvement-log.md` in the user's working folder **only** when
one of these occurred during the run:

- **Error**: An Apps Script call failed, a label wasn't applied, verification
  caught missing labels, a retry was needed, or the health check returned
  something unexpected.
- **Reliability concern**: Something worked but felt fragile — e.g., a
  classification was borderline and could easily go wrong next time, or the
  batch hit exactly 25 emails suggesting more were left unprocessed.
- **Efficiency opportunity**: You noticed a pattern that could be handled more
  cheaply — e.g., the same sender keeps showing up as Unknown and should
  probably get a rule, or a large fraction of emails were from one source that
  could be filtered earlier.
- **Rule refinement**: You classified something but weren't confident, or you
  noticed a gap in the rules — a new category of email that doesn't fit any
  existing rule or custom label.

If the run was clean and unremarkable, **skip this step entirely**. The log
should be high-signal, not a diary.

### How to write an entry

Read the template at `references/improvement-log-template.md` for the exact
format. Each entry includes:

- **Date and short title** — e.g., "2026-03-09 — Apps Script timeout on large batch"
- **Category** — one of: `error`, `reliability`, `efficiency`, `rule-refinement`
- **Run summary** — how many emails were processed, labeled, archived
- **What happened** — specific details: email subjects, sender patterns, error
  messages, unexpected classifications
- **What was tried** — if you took corrective action (retry, reclassify, skip),
  what you did and whether it worked
- **Proposed fix** — a concrete suggestion: a rule update, a SKILL.md change,
  a config tweak, or an investigation the user should run
- **Priority** — `low`, `medium`, or `high`

### Append behavior

Add new entries at the **top** of the file (newest first), below the header.
If `improvement-log.md` doesn't exist yet, create it by copying the template
from `references/improvement-log-template.md` and then adding your entry.

---

## Adapting the rules

After triage is complete, if the user points out mistakes (false positives or
false negatives), offer to update `triage-rules.md` to prevent the same error
in future sessions. Common updates include:

- Adding a sender or domain to the Trusted Domains list.
- Adding a newsletter to the Trusted Sources list.
- Adding a new exception to an existing rule.
- Creating a new rule pattern for a category of email the rules don't cover yet.

Always explain what change you'd make and why before editing the file. The user
should approve rule changes since they affect all future triage sessions.

---

## Reference files

| File | Purpose |
|---|---|
| `references/triage-rules-template.md` | Blank template the user copies and customizes with their own rules. Share this if `triage-rules.md` is missing from the working folder. |
| `references/apps-script-setup.md` | Step-by-step guide for deploying the Gmail Actions Apps Script. Share this if `email-triage-config.json` is missing. |
| `references/email-triage-config-template.json` | Template for the config file the user creates in their working folder. |
| `references/improvement-log-template.md` | Format template for the improvement log. Copy this to create `improvement-log.md` in the working folder on first use. |
| `scripts/gmail-calendar-actions.gs` | Google Apps Script source code. The user pastes this into a new Apps Script project and deploys it as a web app. |
