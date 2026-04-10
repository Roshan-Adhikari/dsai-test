/**
 * IITR E&ICT DSAI — Email Send Relay (Google Apps Script Web App)
 *
 * PURPOSE:
 *   Allows the dashboard to send emails FROM eictiitrprograms@masaischool.com
 *   without requiring any user login on the frontend.
 *
 * ─────────────────────────────────────────────────────────
 * SETUP INSTRUCTIONS (do this once):
 * ─────────────────────────────────────────────────────────
 *
 * STEP 1 — Open Apps Script
 *   Go to https://script.google.com
 *   Create a new project (name it: "IITR DSAI Email Relay")
 *   Sign in as eictiitrprograms@masaischool.com
 *
 * STEP 2 — Paste this file
 *   Replace the default Code.gs content with this entire file.
 *
 * STEP 3 — Set your secret key
 *   Change the RELAY_SECRET value below to any long random string.
 *   Example: "iitr-dsai-2024-xK9mP2qR"
 *   Copy this key — you will paste it into index.html too.
 *
 * STEP 4 — Deploy as Web App
 *   Click Deploy → New deployment
 *   Type: Web App
 *   Description: "Email Relay v1"
 *   Execute as: Me (eictiitrprograms@masaischool.com)   ← IMPORTANT
 *   Who has access: Anyone                               ← IMPORTANT
 *   Click Deploy → Authorize → Allow
 *   Copy the Web App URL (looks like https://script.google.com/macros/s/ABC.../exec)
 *
 * STEP 5 — Paste the Web App URL into index.html
 *   Find the line:  const RELAY_URL = '';
 *   Replace with:   const RELAY_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
 *
 * STEP 6 — Also paste your secret key into index.html
 *   Find the line:  const RELAY_SECRET = '';
 *   Replace with:   const RELAY_SECRET = 'your-secret-key-here';
 *
 * STEP 7 — Done!
 *   The dashboard will now send all emails from eictiitrprograms@masaischool.com
 *   with no login required for users.
 *
 * ─────────────────────────────────────────────────────────
 * RE-DEPLOYING after edits:
 *   Deploy → Manage deployments → Edit (pencil icon)
 *   Version: New version → Deploy
 *   The URL stays the same.
 * ─────────────────────────────────────────────────────────
 */

// ── CONFIG ───────────────────────────────────────────────
// Change this to any secret string. Must match RELAY_SECRET in index.html.
const RELAY_SECRET = 'iitr-dsai-relay-SECRET-change-me'; // keep this same in index.html

// The fixed sender address (must be the account this script runs as).
const SENDER_EMAIL = 'eictiitrprograms@masaischool.com';
const SENDER_NAME  = 'IITR E&ICT DSAI';

// Max recipients per single call (safety cap).
const MAX_RECIPIENTS = 500;
// ─────────────────────────────────────────────────────────


/**
 * doPost — called by the dashboard fetch().
 * Expects a JSON body:
 * {
 *   secret:  string,          // must match RELAY_SECRET
 *   to:      string,          // comma-separated To addresses
 *   cc:      string,          // optional
 *   bcc:     string,          // comma-separated BCC addresses (bulk mode)
 *   subject: string,
 *   body:    string,          // plain-text body
 *   htmlBody: string,         // optional HTML body
 *   replyTo: string           // optional reply-to address
 * }
 */
function doPost(e) {
  // Allow cross-origin requests from any dashboard origin.
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Parse body
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (_) {
      return buildResponse_(400, { ok: false, error: 'Invalid JSON body' }, headers);
    }

    // Validate secret
    if (!payload.secret || payload.secret !== RELAY_SECRET) {
      return buildResponse_(403, { ok: false, error: 'Unauthorized' }, headers);
    }

    // Validate required fields
    const subject = String(payload.subject || '').trim();
    const body    = String(payload.body    || '').trim();
    if (!subject) return buildResponse_(400, { ok: false, error: 'Missing subject' }, headers);
    if (!body)    return buildResponse_(400, { ok: false, error: 'Missing body'    }, headers);

    // Build recipient lists
    const toList  = splitEmails_(payload.to  || '');
    const ccList  = splitEmails_(payload.cc  || '');
    const bccList = splitEmails_(payload.bcc || '');

    if (toList.length === 0 && bccList.length === 0) {
      return buildResponse_(400, { ok: false, error: 'No valid recipients' }, headers);
    }

    const totalRecipients = toList.length + ccList.length + bccList.length;
    if (totalRecipients > MAX_RECIPIENTS) {
      return buildResponse_(400, {
        ok: false,
        error: `Too many recipients (${totalRecipients}). Max is ${MAX_RECIPIENTS}.`
      }, headers);
    }

    // Build GmailApp options
    const options = {
      name: SENDER_NAME,
      cc:   ccList.join(', '),
      bcc:  bccList.join(', '),
      noReply: false,
    };

    if (payload.replyTo) options.replyTo = String(payload.replyTo).trim();

    if (payload.htmlBody && String(payload.htmlBody).trim().length > 0) {
      options.htmlBody = String(payload.htmlBody).trim();
    }

    // Primary To — if only BCC mode, use undisclosed placeholder
    const primaryTo = toList.length > 0
      ? toList.join(', ')
      : SENDER_EMAIL;   // send to self as placeholder when pure-BCC

    GmailApp.sendEmail(primaryTo, subject, body, options);

    return buildResponse_(200, {
      ok: true,
      message: `Email sent to ${totalRecipients} recipient(s) from ${SENDER_EMAIL}`
    }, headers);

  } catch (err) {
    console.error('[relay error]', err.message, err.stack);
    return buildResponse_(500, { ok: false, error: err.message || 'Internal error' }, headers);
  }
}

/**
 * doGet — health-check endpoint.
 * Visit the Web App URL in a browser to confirm it's live.
 */
function doGet(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  return buildResponse_(200, {
    ok: true,
    status: 'IITR DSAI Email Relay is running',
    sender: SENDER_EMAIL
  }, headers);
}

// ── HELPERS ──────────────────────────────────────────────

function splitEmails_(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0 && e.includes('@'));
}

function buildResponse_(code, data, headers) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script Web Apps don't support custom HTTP status codes in
  // ContentService — all responses return 200 at transport level.
  // The 'ok' field in the JSON body is the real status indicator.
}
