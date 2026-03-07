/**
 * Gmail & Calendar Actions — Google Apps Script web app for the
 * email-triage and calendar-scheduling skills.
 *
 * Accepts POST requests with a JSON body describing Gmail label/archive
 * operations and/or Calendar event creation, then executes them via the
 * Gmail and Calendar APIs.
 *
 * This is a combined script — it handles both Gmail operations (from the
 * email-triage skill) and Calendar operations (from the calendar-scheduling
 * skill) in a single deployment. This way the user only needs one Apps
 * Script project and one deployment URL.
 *
 * Deployment:
 *   1. Create a new Apps Script project at https://script.google.com
 *   2. Paste this file as the only script file (replacing Code.gs).
 *   3. Click Deploy → New deployment → Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Authorize when prompted (grants Gmail + Calendar access).
 *   5. Copy the deployment URL and save it in your config file.
 *
 * See references/apps-script-setup.md for detailed instructions.
 *
 * ── Request format ──────────────────────────────────────────────────
 *
 * The request body can contain "actions" (Gmail), "calendarActions", and/or
 * "emailActions". Include whichever sections you need.
 *
 *   POST <deployment-url>
 *   Content-Type: application/json
 *
 *   {
 *     "secret": "<shared-secret>",
 *
 *     "actions": [                          // Gmail label/archive ops
 *       {
 *         "messageId": "18e3a...",
 *         "addLabels": ["Action Needed"],
 *         "removeLabels": [],
 *         "archive": false
 *       }
 *     ],
 *
 *     "calendarActions": [                  // Calendar event ops
 *       {
 *         "action": "createEvent",          // or "updateEvent" or "deleteEvent"
 *         "calendarId": "primary",
 *         "title": "Team Sync",
 *         "startTime": "2026-03-15T10:00:00-05:00",
 *         "endTime": "2026-03-15T11:00:00-05:00",
 *         "description": "Weekly team meeting",
 *         "attendees": ["alice@example.com", "bob@example.com"],
 *         "location": "Zoom",
 *         "reminders": [{"method": "popup", "minutes": 15}],
 *         "attachments": [                  // Optional — uploaded to Drive/Temp, then attached
 *           {
 *             "fileName": "Agenda.pdf",
 *             "mimeType": "application/pdf",
 *             "base64Data": "<base64-encoded file contents>"
 *           }
 *         ]
 *       },
 *       {
 *         "action": "updateEvent",
 *         "calendarId": "primary",
 *         "eventId": "abc123@google.com",
 *         "title": "Updated Title",
 *         "addAttendees": ["carol@example.com"],
 *         "removeAttendees": ["bob@example.com"]
 *       },
 *       {
 *         "action": "deleteEvent",
 *         "calendarId": "primary",
 *         "eventId": "abc123@google.com"
 *       }
 *     ],
 *
 *     "emailActions": [                     // Send email ops
 *       {
 *         "action": "sendEmail",
 *         "to": "candidate@example.com",
 *         "subject": "Your interview schedule",
 *         "body": "HTML or plain text body",
 *         "cc": "recruiter@company.com",
 *         "bcc": "",
 *         "replyTo": "recruiter@company.com"
 *       }
 *     ]
 *   }
 *
 * ── Response format ─────────────────────────────────────────────────
 *
 *   {
 *     "success": true,
 *     "processed": 3,
 *     "results": [
 *       { "type": "gmail", "messageId": "18e3a...", "status": "ok" },
 *       { "type": "calendar", "action": "createEvent", "status": "ok", "eventId": "abc123" },
 *       { "type": "email", "action": "sendEmail", "status": "ok", "to": "candidate@example.com" }
 *     ],
 *     "errors": []
 *   }
 */

// ─── Configuration ──────────────────────────────────────────────────
// IMPORTANT: Change this to a strong, unique secret before deploying.
var SHARED_SECRET = "CHANGE_ME_TO_A_RANDOM_SECRET";

// ─── Entry point ────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Authenticate
    if (!body.secret || body.secret !== SHARED_SECRET) {
      return _jsonResponse({
        success: false,
        processed: 0,
        results: [],
        errors: ["Invalid or missing secret"]
      }, 403);
    }

    var results = [];
    var errorCount = 0;

    // ── Gmail actions (label/archive) ──
    var gmailActions = body.actions || [];
    if (gmailActions.length > 50) {
      return _jsonResponse({
        success: false, processed: 0, results: [],
        errors: ["Too many Gmail actions. Max 50 per request."]
      }, 400);
    }
    for (var i = 0; i < gmailActions.length; i++) {
      var result = _processGmailAction(gmailActions[i]);
      result.type = "gmail";
      results.push(result);
      if (result.status === "error") errorCount++;
    }

    // ── Calendar actions ──
    var calendarActions = body.calendarActions || [];
    if (calendarActions.length > 20) {
      return _jsonResponse({
        success: false, processed: 0, results: [],
        errors: ["Too many calendar actions. Max 20 per request."]
      }, 400);
    }
    for (var j = 0; j < calendarActions.length; j++) {
      var calResult = _processCalendarAction(calendarActions[j]);
      calResult.type = "calendar";
      results.push(calResult);
      if (calResult.status === "error") errorCount++;
    }

    // ── Email actions ──
    var emailActions = body.emailActions || [];
    if (emailActions.length > 10) {
      return _jsonResponse({
        success: false, processed: 0, results: [],
        errors: ["Too many email actions. Max 10 per request."]
      }, 400);
    }
    for (var k = 0; k < emailActions.length; k++) {
      var emailResult = _processEmailAction(emailActions[k]);
      emailResult.type = "email";
      results.push(emailResult);
      if (emailResult.status === "error") errorCount++;
    }

    var totalProcessed = gmailActions.length + calendarActions.length + emailActions.length;

    if (totalProcessed === 0) {
      return _jsonResponse({
        success: false, processed: 0, results: [],
        errors: ["No actions provided. Include 'actions', 'calendarActions', and/or 'emailActions'."]
      }, 400);
    }

    return _jsonResponse({
      success: errorCount === 0,
      processed: totalProcessed,
      results: results,
      errors: errorCount > 0
        ? [errorCount + " of " + totalProcessed + " actions failed"]
        : []
    });

  } catch (err) {
    return _jsonResponse({
      success: false, processed: 0, results: [],
      errors: ["Server error: " + err.message]
    }, 500);
  }
}

// Health check
function doGet(e) {
  return _jsonResponse({
    status: "ok",
    service: "gmail-calendar-actions",
    capabilities: ["gmail", "calendar", "email"],
    timestamp: new Date().toISOString()
  });
}

// ─── Gmail action processing ────────────────────────────────────────

function _processGmailAction(action) {
  var messageId = action.messageId;

  if (!messageId) {
    return { messageId: null, status: "error", error: "Missing messageId" };
  }

  try {
    var thread = _getThreadByMessageId(messageId);

    if (!thread) {
      return { messageId: messageId, status: "error", error: "Message not found" };
    }

    // Apply labels
    var addLabels = action.addLabels || [];
    for (var i = 0; i < addLabels.length; i++) {
      var label = _getOrCreateLabel(addLabels[i]);
      thread.addLabel(label);
    }

    // Remove labels
    var removeLabels = action.removeLabels || [];
    for (var j = 0; j < removeLabels.length; j++) {
      var labelToRemove = GmailApp.getUserLabelByName(removeLabels[j]);
      if (labelToRemove) {
        thread.removeLabel(labelToRemove);
      }
    }

    // Archive
    if (action.archive === true) {
      thread.moveToArchive();
    }

    return { messageId: messageId, status: "ok" };

  } catch (err) {
    return { messageId: messageId, status: "error", error: err.message };
  }
}

// ─── Calendar action processing ─────────────────────────────────────

function _processCalendarAction(action) {
  var actionType = action.action;

  if (!actionType) {
    return { action: null, status: "error", error: "Missing 'action' field" };
  }

  try {
    switch (actionType) {
      case "createEvent":
        return _createCalendarEvent(action);
      case "updateEvent":
        return _updateCalendarEvent(action);
      case "deleteEvent":
        return _deleteCalendarEvent(action);
      default:
        return { action: actionType, status: "error", error: "Unknown action: " + actionType };
    }
  } catch (err) {
    return { action: actionType, status: "error", error: err.message };
  }
}

function _createCalendarEvent(action) {
  var calendarId = action.calendarId || "primary";
  var title = action.title;
  var startTime = action.startTime;
  var endTime = action.endTime;

  if (!title || !startTime || !endTime) {
    return {
      action: "createEvent",
      status: "error",
      error: "Missing required fields: title, startTime, endTime"
    };
  }

  var calendar;
  if (calendarId === "primary") {
    calendar = CalendarApp.getDefaultCalendar();
  } else {
    calendar = CalendarApp.getCalendarById(calendarId);
  }

  if (!calendar) {
    return {
      action: "createEvent",
      status: "error",
      error: "Calendar not found: " + calendarId
    };
  }

  var start = new Date(startTime);
  var end = new Date(endTime);

  var event = calendar.createEvent(title, start, end, {
    description: action.description || "",
    location: action.location || ""
  });

  // Add attendees if provided
  var attendees = action.attendees || [];
  for (var i = 0; i < attendees.length; i++) {
    event.addGuest(attendees[i]);
  }

  // Set reminders if provided
  if (action.reminders && action.reminders.length > 0) {
    event.removeAllReminders();
    for (var r = 0; r < action.reminders.length; r++) {
      var reminder = action.reminders[r];
      if (reminder.method === "popup") {
        event.addPopupReminder(reminder.minutes);
      } else if (reminder.method === "email") {
        event.addEmailReminder(reminder.minutes);
      }
    }
  }

  // Note: CalendarApp.createEvent sends invites by default when guests are
  // added. Apps Script doesn't provide a way to suppress invite emails when
  // adding guests via addGuest(). If you need to suppress invites, use the
  // Calendar Advanced Service instead.

  // Set free/busy (transparency) if requested.
  // CalendarApp doesn't support this natively, so we use the Calendar
  // Advanced Service (Calendar API v3). The "Calendar" advanced service
  // must be enabled in the Apps Script project for this to work.
  // "transparent" = show as Free, "opaque" = show as Busy (default).
  if (action.showAs) {
    _setEventTransparency(calendarId, event.getId(), action.showAs);
  }

  // Upload and attach files if provided.
  // Each attachment is base64-decoded, uploaded to a /Temp folder in Google
  // Drive, then linked to the event via the Calendar Advanced Service.
  var attachmentResults = [];
  if (action.attachments && action.attachments.length > 0) {
    attachmentResults = _uploadAndAttachFiles(calendarId, event.getId(), action.attachments);
  }

  return {
    action: "createEvent",
    status: "ok",
    eventId: event.getId(),
    title: title,
    start: start.toISOString(),
    end: end.toISOString(),
    attachments: attachmentResults
  };
}

function _updateCalendarEvent(action) {
  var calendarId = action.calendarId || "primary";
  var eventId = action.eventId;

  if (!eventId) {
    return {
      action: "updateEvent",
      status: "error",
      error: "Missing required field: eventId"
    };
  }

  var calendar;
  if (calendarId === "primary") {
    calendar = CalendarApp.getDefaultCalendar();
  } else {
    calendar = CalendarApp.getCalendarById(calendarId);
  }

  if (!calendar) {
    return {
      action: "updateEvent",
      status: "error",
      error: "Calendar not found: " + calendarId
    };
  }

  var event = calendar.getEventById(eventId);
  if (!event) {
    return {
      action: "updateEvent",
      status: "error",
      error: "Event not found: " + eventId,
      eventId: eventId
    };
  }

  // Update fields that are provided
  if (action.title) {
    event.setTitle(action.title);
  }

  if (action.startTime && action.endTime) {
    event.setTime(new Date(action.startTime), new Date(action.endTime));
  }

  if (action.description !== undefined) {
    event.setDescription(action.description);
  }

  if (action.location !== undefined) {
    event.setLocation(action.location);
  }

  // Add new attendees if provided
  if (action.addAttendees && action.addAttendees.length > 0) {
    for (var i = 0; i < action.addAttendees.length; i++) {
      event.addGuest(action.addAttendees[i]);
    }
  }

  // Remove attendees if provided
  if (action.removeAttendees && action.removeAttendees.length > 0) {
    for (var j = 0; j < action.removeAttendees.length; j++) {
      event.removeGuest(action.removeAttendees[j]);
    }
  }

  // Update reminders if provided
  if (action.reminders && action.reminders.length > 0) {
    event.removeAllReminders();
    for (var r = 0; r < action.reminders.length; r++) {
      var reminder = action.reminders[r];
      if (reminder.method === "popup") {
        event.addPopupReminder(reminder.minutes);
      } else if (reminder.method === "email") {
        event.addEmailReminder(reminder.minutes);
      }
    }
  }

  // Update free/busy status if provided
  if (action.showAs) {
    _setEventTransparency(calendarId, eventId, action.showAs);
  }

  // Upload and attach new files if provided
  var attachmentResults = [];
  if (action.attachments && action.attachments.length > 0) {
    attachmentResults = _uploadAndAttachFiles(calendarId, eventId, action.attachments);
  }

  return {
    action: "updateEvent",
    status: "ok",
    eventId: eventId,
    attachments: attachmentResults
  };
}

function _deleteCalendarEvent(action) {
  var calendarId = action.calendarId || "primary";
  var eventId = action.eventId;

  if (!eventId) {
    return {
      action: "deleteEvent",
      status: "error",
      error: "Missing required field: eventId"
    };
  }

  var calendar;
  if (calendarId === "primary") {
    calendar = CalendarApp.getDefaultCalendar();
  } else {
    calendar = CalendarApp.getCalendarById(calendarId);
  }

  if (!calendar) {
    return {
      action: "deleteEvent",
      status: "error",
      error: "Calendar not found: " + calendarId
    };
  }

  var event = calendar.getEventById(eventId);
  if (!event) {
    return {
      action: "deleteEvent",
      status: "error",
      error: "Event not found: " + eventId,
      eventId: eventId
    };
  }

  event.deleteEvent();

  return {
    action: "deleteEvent",
    status: "ok",
    eventId: eventId
  };
}

// ─── Calendar helpers ────────────────────────────────────────────────

/**
 * Set an event's free/busy status using the Calendar Advanced Service.
 *
 * The basic CalendarApp API doesn't support the transparency field, so we
 * use the Calendar Advanced Service (Calendar API v3) instead. This requires
 * the "Calendar" advanced service to be enabled in the Apps Script project:
 *   Resources → Advanced Google services → Calendar API → ON
 *
 * @param {string} calendarId - "primary" or a calendar ID
 * @param {string} eventId - The event ID (from CalendarApp, may include
 *   "@google.com" suffix which we strip)
 * @param {string} showAs - "free" or "busy"
 */
function _setEventTransparency(calendarId, eventId, showAs) {
  try {
    // CalendarApp event IDs often end with "@google.com" — the Advanced
    // Service expects the raw ID without that suffix.
    var cleanId = eventId.replace(/@google\.com$/, "");
    var calId = (calendarId === "primary") ? "primary" : calendarId;

    var transparency = (showAs === "free") ? "transparent" : "opaque";

    Calendar.Events.patch(
      { transparency: transparency },
      calId,
      cleanId
    );
  } catch (e) {
    // If the Advanced Service isn't enabled, log the error but don't fail
    // the whole action — the event was still created/updated successfully,
    // just without the free/busy setting.
    Logger.log("Could not set transparency: " + e.message +
      ". Make sure the Calendar Advanced Service is enabled.");
  }
}

/**
 * Upload base64-encoded files to Google Drive and attach them to a calendar
 * event using the Calendar Advanced Service.
 *
 * Files are placed in a "Temp" folder at the root of the user's Drive so they
 * stay out of the way. The Calendar API requires Google Drive file URLs for
 * attachments, so we upload first, then patch the event.
 *
 * Each attachment object must have: fileName, mimeType, base64Data.
 * Optionally include fileUrl (a Google Drive URL) instead of base64Data to
 * attach an existing Drive file without re-uploading.
 *
 * @param {string} calendarId - "primary" or a calendar ID
 * @param {string} eventId - The event ID (from CalendarApp)
 * @param {Array<Object>} attachments - Array of attachment objects
 * @returns {Array<Object>} Results for each attachment
 */
function _uploadAndAttachFiles(calendarId, eventId, attachments) {
  var results = [];
  var driveFiles = [];

  var tempFolder = _getOrCreateTempFolder();

  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];

    try {
      var fileUrl, fileTitle;

      if (att.fileUrl) {
        // Existing Drive file — use as-is
        fileUrl = att.fileUrl;
        fileTitle = att.fileName || att.title || "Attachment";
        results.push({ fileName: fileTitle, status: "ok", fileUrl: fileUrl });
      } else if (att.base64Data && att.fileName && att.mimeType) {
        // Decode and upload to Drive /Temp folder
        var decoded = Utilities.base64Decode(att.base64Data);
        var blob = Utilities.newBlob(decoded, att.mimeType, att.fileName);
        var driveFile = tempFolder.createFile(blob);

        fileUrl = driveFile.getUrl();
        fileTitle = att.fileName;

        results.push({
          fileName: att.fileName,
          status: "ok",
          fileUrl: fileUrl,
          driveFileId: driveFile.getId()
        });
      } else {
        results.push({
          fileName: att.fileName || "(unknown)",
          status: "error",
          error: "Attachment must have either fileUrl, or base64Data + fileName + mimeType"
        });
        continue;
      }

      driveFiles.push({ fileUrl: fileUrl, title: fileTitle });

    } catch (uploadErr) {
      results.push({
        fileName: att.fileName || "(unknown)",
        status: "error",
        error: "Upload failed: " + uploadErr.message
      });
    }
  }

  // Attach all successfully uploaded files to the event in a single patch
  if (driveFiles.length > 0) {
    try {
      var cleanId = eventId.replace(/@google\.com$/, "");
      var calId = (calendarId === "primary") ? "primary" : calendarId;

      // Fetch existing attachments so we append rather than overwrite
      var existing = Calendar.Events.get(calId, cleanId);
      var currentAttachments = existing.attachments || [];

      var merged = currentAttachments.concat(driveFiles);

      Calendar.Events.patch(
        { attachments: merged },
        calId,
        cleanId,
        { supportsAttachments: true }
      );
    } catch (patchErr) {
      // Mark all files as uploaded-but-not-attached so the caller knows
      for (var r = 0; r < results.length; r++) {
        if (results[r].status === "ok") {
          results[r].attachWarning = "File uploaded to Drive but could not be " +
            "attached to event: " + patchErr.message;
        }
      }
      Logger.log("Could not attach files to event: " + patchErr.message +
        ". Make sure the Calendar Advanced Service is enabled.");
    }
  }

  return results;
}

/**
 * Get or create a "Temp" folder at the root of the user's Google Drive.
 * Used as a staging area for calendar event attachments.
 *
 * @returns {Folder} The Temp folder
 */
function _getOrCreateTempFolder() {
  var folders = DriveApp.getRootFolder().getFoldersByName("Temp");
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.getRootFolder().createFolder("Temp");
}

// ─── Email action processing ────────────────────────────────────────

function _processEmailAction(action) {
  var actionType = action.action;

  if (actionType !== "sendEmail") {
    return { action: actionType, status: "error", error: "Unknown email action: " + actionType };
  }

  var to = action.to;
  var subject = action.subject;
  var body = action.body;

  if (!to || !subject || !body) {
    return {
      action: "sendEmail",
      status: "error",
      error: "Missing required fields: to, subject, body"
    };
  }

  try {
    var options = {};
    if (action.cc) options.cc = action.cc;
    if (action.bcc) options.bcc = action.bcc;
    if (action.replyTo) options.replyTo = action.replyTo;

    // If body looks like HTML, send as HTML
    if (body.indexOf("<") !== -1 && body.indexOf(">") !== -1) {
      options.htmlBody = body;
    }

    GmailApp.sendEmail(to, subject, body, options);

    return {
      action: "sendEmail",
      status: "ok",
      to: to,
      subject: subject
    };

  } catch (err) {
    return { action: "sendEmail", status: "error", error: err.message, to: to };
  }
}

// ─── Gmail helpers ──────────────────────────────────────────────────

function _getThreadByMessageId(messageId) {
  try {
    var message = GmailApp.getMessageById(messageId);
    if (message) {
      return message.getThread();
    }
  } catch (e) {
    // getMessageById can throw if the ID format is wrong
  }

  // Fallback: try searching by rfc822msgid
  try {
    var threads = GmailApp.search("rfc822msgid:" + messageId, 0, 1);
    if (threads.length > 0) {
      return threads[0];
    }
  } catch (e) {
    // Search can fail for various reasons
  }

  return null;
}

var _labelCache = {};

function _getOrCreateLabel(labelName) {
  if (_labelCache[labelName]) {
    return _labelCache[labelName];
  }

  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }

  _labelCache[labelName] = label;
  return label;
}

// ─── Response helper ────────────────────────────────────────────────

function _jsonResponse(data, statusCode) {
  // Note: Apps Script web apps always return HTTP 200.
  // The logical status is embedded in the response body.
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
