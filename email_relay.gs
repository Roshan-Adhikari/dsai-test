/**
 * IITR E&ICT DSAI — Email Send Relay (Google Apps Script Web App)
 * ─────────────────────────────────────────────────────────────────
 *
 * ⚠️  DEPLOYMENT SETTINGS (this is what fixes "Failed to fetch"):
 *
 *   Execute as  →  Me (eictiitrprograms@masaischool.com)
 *   Who has access  →  Anyone          ← MUST be "Anyone", NOT "masaischool.com"
 *
 *   "Anyone" does NOT mean anyone can read your inbox.
 *   It just means the browser can reach the script URL.
 *   The RELAY_SECRET below is what keeps it secure.
 *
 * ─────────────────────────────────────────────────────────────────
 * HOW TO REDEPLOY (fixes the current error in 2 minutes):
 *
 *  1. Open your Apps Script project
 *  2. Click  Deploy → Manage deployments
 *  3. Click the ✏️  pencil icon on the current deployment
 *  4. Change "Who has access" from masaischool.com → Anyone
 *  5. Set Version → New version
 *  6. Click Deploy  (URL stays the same — no change needed in index.html)
 *
 * ─────────────────────────────────────────────────────────────────
 */

// ── CONFIG ────────────────────────────────────────────────────────
const RELAY_SECRET = 'iitr-dsai-relay-SECRET-change-me'; // keep same in index.html
const SENDER_EMAIL = 'eictiitrprograms@masaischool.com';
const SENDER_NAME  = 'IITR E&ICT DSAI';
const MAX_RECIPIENTS = 500;
// ──────────────────────────────────────────────────────────────────


function doPost(e) {
  try {
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch(err) {
      return respond_({ ok: false, error: 'Invalid JSON' });
    }

    // Auth check
    if (!payload.secret || payload.secret !== RELAY_SECRET) {
      return respond_({ ok: false, error: 'Unauthorized' });
    }

    var subject  = String(payload.subject  || '').trim();
    var body     = String(payload.body     || '').trim();
    var htmlBody = String(payload.htmlBody || '').trim();

    if (!subject) return respond_({ ok: false, error: 'Missing subject' });
    if (!body)    return respond_({ ok: false, error: 'Missing body' });

    var toList  = splitEmails_(payload.to  || '');
    var ccList  = splitEmails_(payload.cc  || '');
    var bccList = splitEmails_(payload.bcc || '');

    if (toList.length === 0 && bccList.length === 0) {
      return respond_({ ok: false, error: 'No valid recipients' });
    }

    var total = toList.length + ccList.length + bccList.length;
    if (total > MAX_RECIPIENTS) {
      return respond_({ ok: false, error: 'Too many recipients (' + total + '). Max: ' + MAX_RECIPIENTS });
    }

    var options = { name: SENDER_NAME };
    if (ccList.length)  options.cc  = ccList.join(', ');
    if (bccList.length) options.bcc = bccList.join(', ');
    if (htmlBody)       options.htmlBody = htmlBody;
    if (payload.replyTo) options.replyTo = String(payload.replyTo).trim();

    var primaryTo = toList.length > 0 ? toList.join(', ') : SENDER_EMAIL;

    GmailApp.sendEmail(primaryTo, subject, body, options);

    return respond_({ ok: true, message: 'Sent to ' + total + ' recipient(s) from ' + SENDER_EMAIL });

  } catch(err) {
    Logger.log('Relay error: ' + err.message);
    return respond_({ ok: false, error: err.message || 'Internal error' });
  }
}


function doGet(e) {
  // Health check — visit the URL in browser to confirm relay is live
  return respond_({ ok: true, status: 'IITR DSAI Email Relay is running', sender: SENDER_EMAIL });
}


// ── HELPERS ───────────────────────────────────────────────────────

function splitEmails_(raw) {
  if (!raw) return [];
  return String(raw).split(/[,;]+/).map(function(e) {
    return e.trim();
  }).filter(function(e) {
    return e.length > 0 && e.indexOf('@') > -1;
  });
}

function respond_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
