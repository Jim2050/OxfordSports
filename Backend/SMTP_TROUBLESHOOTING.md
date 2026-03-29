# SMTP Email Troubleshooting Guide

## Current Status
- ✅ Order system working (orders placed successfully)
- ✅ SMTP credentials configured in Railway
- ⏳ Email delivery: **TESTING**

## Quick Diagnostics

### Step 1: Check Email Received
- [ ] Check Gmail inbox (alirazamemonofficial@gmail.com)
- [ ] Check Outlook sent folder (sales@oxfordsports.net)
- [ ] Check spam/junk folders

### Step 2: Run Local SMTP Test
From your local machine (OxfordSports/Backend):
```bash
node test-smtp.js
```

This will:
- ✅ Verify SMTP credentials are correct
- ✅ Test connection to smtp.office365.com:587
- ✅ Send a test email
- ❌ Show exact error if something fails

### Step 3: Check Railway Logs
When you place an order, look for these log lines:
```
[SMTP CONFIG] Host: smtp.office365.com, Port: 587, User: sales@oxfordsports.net
[ORDER EMAIL] Admin email sent to sales@oxfordsports.net
[ORDER EMAIL] Customer email sent to alirazamemonofficial@gmail.com
[ORDER EMAIL SUCCESS] Order OS-20260329-0014 emails sent successfully
```

If instead you see:
```
[ORDER EMAIL ERROR] Order XX: [error message]
[SMTP DEBUG] Error code: [code], Response: [response]
```

This tells you the exact SMTP failure.

---

## Common SMTP Issues & Fixes

### Issue 1: "Invalid credentials" or "535 5.7.3"
**Cause:** Password incorrect or special character not escaped
**Fix:**
1. Go to Railway Variables
2. Find `SMTP_PASS = Microsoft1971turbs*`
3. Change to: `SMTP_PASS = "Microsoft1971turbs*"` (wrap in quotes)
4. Deploy and test

### Issue 2: "TLS/SSL error"
**Cause:** Port or secure flag wrong
**Fix:** Verify in Railway:
```
SMTP_HOST = smtp.office365.com  (not smtp.gmail.com)
SMTP_PORT = 587                 (not 465)
```

### Issue 3: "Account not valid for SMTP"
**Cause:** Microsoft account is not an Outlook mailbox
**Fix:** Use different email account or create Outlook account at outlook.com

### Issue 4: "Message rejected" after auth succeeds
**Cause:** Sender email format wrong
**Fix:** Verify sender matches SMTP_USER:
```javascript
from: `"Oxford Sports" <sales@oxfordsports.net>`  // Must be sales@oxfordsports.net
```

### Issue 5: Emails sent but not received
**Cause:** Email filtering/spam rules
**Fix:**
1. Check Gmail spam folder for emails from sales@oxfordsports.net
2. Mark as "Not spam"
3. Add sales@oxfordsports.net to contacts

---

## Testing Checklist

- [ ] Run `node test-smtp.js` — see if test email sent successfully
- [ ] Place test order >£300
- [ ] Check customer inbox for order confirmation
- [ ] Check sales@oxfordsports.net Sent folder
- [ ] Check Railway logs for `[ORDER EMAIL SUCCESS]`
- [ ] Verify email contains order details (number, total, items)

---

## Contact Support

If `node test-smtp.js` shows error, provide:
1. Full error output from script
2. Railway backend logs (full error line)
3. Screenshot of SMTP variables in Railway

This will pinpoint the exact issue.
