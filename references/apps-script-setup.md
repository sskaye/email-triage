# Apps Script Setup Guide

This guide walks you through deploying the Gmail Actions script that the
email-triage skill uses to apply labels and archive emails.

## Prerequisites

- A Google account with Gmail
- Access to Google Apps Script (https://script.google.com)

## Step 1 — Create the script project

1. Go to https://script.google.com
2. Click **New project**
3. Click "Untitled project" at the top and rename it to **Email Triage Actions**
4. Delete any existing code in the editor

## Step 2 — Paste the script code

1. Open `scripts/gmail-calendar-actions.gs` from this skill's repository
2. Copy the entire contents
3. Paste it into the Apps Script editor, replacing everything

## Step 3 — Set your shared secret

Near the top of the script, find this line:

```javascript
var SHARED_SECRET = "CHANGE_ME_TO_A_RANDOM_SECRET";
```

Replace `CHANGE_ME_TO_A_RANDOM_SECRET` with a strong, unique passphrase. This
secret authenticates requests from the skill. Example:

```javascript
var SHARED_SECRET = "myRandomSecret-8f3k2j5n9x";
```

You can generate a random string however you like. Keep it private — anyone with
this secret and your deployment URL can modify your Gmail labels.

## Step 4 — Deploy as a web app

1. Click **Deploy** → **New deployment** (top right)
2. Click the gear icon next to "Select type" and choose **Web app**
3. Fill in the settings:
   - **Description**: Email Triage Actions (or anything you like)
   - **Execute as**: **Me** (the script runs with your Gmail permissions)
   - **Who has access**: **Anyone** (so the skill can POST to it from outside Google)
4. Click **Deploy**
5. Google will ask you to authorize the script. Click **Authorize access**, choose
   your Google account, and grant Gmail permissions when prompted.
6. Copy the **Web app URL** — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

## Step 5 — Create the config file

In your working folder (the same folder that has `triage-rules.md`), create a
file called `email-triage-config.json`:

```json
{
  "apps_script_url": "https://script.google.com/macros/s/AKfycb.../exec",
  "apps_script_secret": "myRandomSecret-8f3k2j5n9x"
}
```

Replace the URL with your deployment URL and the secret with the one you set in
Step 3.

## Step 6 — Test the deployment

You can verify the script is working with a simple health check:

```bash
curl https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

You should get back:

```json
{"status":"ok","service":"gmail-calendar-actions","capabilities":["gmail","calendar","email"],"timestamp":"..."}
```

## Updating the script

If the script code is updated in a future version of the skill:

1. Open your Apps Script project at https://script.google.com
2. Replace the code with the new version
3. Click **Deploy** → **Manage deployments**
4. Click the pencil icon on your existing deployment
5. Under **Version**, select **New version**
6. Click **Deploy**

The URL stays the same — no need to update your config file.

## Troubleshooting

**"Invalid or missing secret" error**: The secret in your `email-triage-config.json`
doesn't match the one in the Apps Script. Double-check both values.

**"Message not found" error**: The message ID from Gmail may have changed or the
email was deleted. The skill will report which specific emails failed.

**Authorization errors**: Re-open the Apps Script project, click **Deploy** →
**Test deployments**, and re-authorize if prompted.

**Script timeout**: Apps Script has a 6-minute execution limit. The script caps
batch size at 50 actions per request to stay well within this limit. If you hit
timeouts, try reducing the batch size.
