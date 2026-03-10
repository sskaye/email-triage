# Email Triage Skill

An Agent Skill for Claude that scans your Gmail inbox, classifies every message using your own rules, applies Gmail labels, and archives suspected junk

## What it does

1. Reads your `triage-rules.md` file to learn what matters and what doesn't
2. Scans your Gmail inbox via the Gmail MCP connector
3. Classifies each email as **Suspected Junk**, **Action Needed**, **Informational**, **Unknown**, or a **custom label** you define (e.g., `RSS: Newsletters`)
4. Builds a JSON action plan and sends it to a Google Apps Script web app
5. The Apps Script applies Gmail labels and archives suspected junk via the Gmail API
6. Verifies all labels were applied, retries any failures
7. Logs decisions for review
8. Reflects on the run and appends to `improvement-log.md` when it spots errors, reliability concerns, or rule-refinement opportunities (skipped on clean runs)

## Requirements

- **Gmail MCP connector** — for reading emails (read-only)
- **Google Apps Script deployment** — for applying labels and archiving (see Setup below)
- **`triage-rules.md`** — your custom rules file in the working folder (a template is provided in `references/`)
- **`email-triage-config.json`** — Apps Script URL and shared secret (a template is provided in `references/`)

## Setup

### 1. Install the skill

Install the `.skill` package through Claude's Settings UI, or copy the skill directory into your skills folder.

### 2. Deploy the Apps Script

Follow the step-by-step guide in `references/apps-script-setup.md`. In short:

1. Create a new project at [script.google.com](https://script.google.com)
2. Paste the code from `scripts/gmail-calendar-actions.gs`
3. Set a shared secret in the script
4. Deploy as a web app
5. Save the URL and secret to `email-triage-config.json` in your working folder

> **Note:** The Apps Script (`gmail-calendar-actions.gs`) is a combined script that also supports Calendar and Email operations for use with other skills. The email-triage skill only uses the Gmail label/archive capabilities.

### 3. Create your rules

Copy `references/triage-rules-template.md` to your working folder as `triage-rules.md` and customize it with your own rules, trusted domains, and trusted sources. You can also define **Custom Labels** in the rules file to route specific senders or patterns to labels beyond the four built-in ones — useful for workflows like RSS feed ingestion.

## Usage

Tell Claude to triage your email:

> "Triage my email"

The skill supports two modes (configured in your `triage-rules.md`):

- **Review mode** — presents a summary table with proposed classifications and waits for your approval before labeling
- **Auto mode** — classifies and labels automatically, then shows a summary of what was done

## Project structure

```
email-triage/
├── SKILL.md                                    # Main skill instructions
├── README.md                                   # This file
├── .gitignore
├── scripts/
│   └── gmail-calendar-actions.gs               # Apps Script source (Gmail + Calendar + Email)
├── references/
│   ├── triage-rules-template.md                # Blank rules template for users
│   ├── apps-script-setup.md                    # Apps Script deployment guide
│   ├── email-triage-config-template.json       # Config file template
│   └── improvement-log-template.md             # Format template for the improvement log
└── evals/
    ├── evals.json                              # Automated test cases
    ├── benchmark-iteration-1.md                # Benchmark results
    └── files/                                  # Test fixtures
        ├── triage-rules-review.md
        ├── triage-rules-auto.md
        └── existing-log.md
```

## Running evals

The `evals/` directory contains test cases covering classification logic, custom label handling, rule parsing, logging, mode handling, Apps Script integration, improvement-log behavior, and edge cases. Run them using the skill-creator framework:

```bash
# Validate the eval file
python3 /path/to/skill-creator/scripts/validate_json.py evals/evals.json

# Prepare a specific eval workspace (0-indexed)
python3 /path/to/skill-creator/scripts/prepare_eval.py email-triage 0 --output-dir workspace/eval-1/with_skill
```

## License

MIT
