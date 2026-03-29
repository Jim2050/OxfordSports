# SMTP Hanging Issue — Diagnosis & Solution

## Problem Identified

Your logs show the email send is **hanging without timing out**:

```
[SMTP DEBUG] Attempting to send emails for order OS-20260329-0018...
[SMTP CONFIG] Host: smtp.office365.com, Port: 587, User: sales@oxfordsports.net
[SMTP DEBUG] Sending admin email to sales@oxfordsports.net...
[EMAIL QUEUE] Added task. Queue length: 1, Running: 1
POST /api/orders 201 847.851 ms - 721
```

Then **nothing** — no success, no error, no timeout. The process hangs waiting for SMTP response.

**This indicates:** The password escaping with backslash (`Microsoft1971turbs\*`) may not be working in Railway's environment.

---

## What I Just Fixed (Commit ab168e5)

### Timeout Protection
- Added 10-second timeout to all `sendMail()` calls
- Added connection/socket timeouts to SMTP transporter
- **Result:** Instead of hanging forever, email sends will now fail with "Email send timeout after 10000ms" error

### Password Format Testing
- Created `test-password-formats.js` script
- Tests multiple password format variations
- Automatically identifies which format works with Outlook

---

## Action Plan

### Step 1: Test Password Formats Locally

Run this in your Backend folder:

```bash
node test-password-formats.js
```

This will test:
1. `Microsoft1971turbs\*` (backslash escaped)
2. `Microsoft1971turbs*` (plain asterisk)
3. `Microsoft1971turbs*` (stripped backslash if present)

**Expected output:**
```
✅ SUCCESS! This format works!
SMTP Connection verified with password: "..."
→ Use this in Railway SMTP_PASS: [correct_format]
```

---

### Step 2: Update Railway Variables

If the test shows a different format works:

1. Go to Railway → OxfordSports → Variables
2. Find `SMTP_PASS`
3. Update to the format that tested successfully
4. Save and redeploy

**Example:** If test shows `Microsoft1971turbs*` works (without backslash), change Railway SMTP_PASS to that.

---

### Step 3: Redeploy & Test

After updating password format:

1. Wait for Railway auto-redeploy (2-3 minutes)
2. Check for build ✅ and deploy 🟢 green
3. Place test order
4. **Observe the modal** for 15 seconds:
   - 🟢 Green = Email sent ✅
   - 🔵 Blue = Still sending
   - 🟡 Amber/Error = Email failed with error logged
5. Check Railway logs for one of:
   - `[ORDER EMAIL SUCCESS]` — Working!
   - `[ORDER EMAIL] Admin email sent to` — In progress
   - `Email send timeout after` — Password format wrong
   - `SMTP ERROR` — Authentication failed

---

## Likely Password Issues

| Issue | Sign | Fix |
|-------|------|-----|
| Backslash escaping wrong | Timeout after 10s | Try without backslash |
| Password contains special char Outlook doesn't like | Timeout after 10s | Use app-specific password |
| Outlook account locked | Connection refused | Check account status |
| 2FA enabled | Auth error | Create app-specific password |

---

## If Timeouts Continue to Occur

The password format test will identify the issue. If NO format works:

**Option 1: Create New Outlook Account**
- Simple password with no special characters
- Example: `Oxfordsports2026Test`
- Use in Railway SMTP_PASS

**Option 2: Switch to Gmail**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=[app-specific-password]
```

**Option 3: Outlook App Password**
- If you have 2FA enabled, create app-specific password in Outlook
- This bypasses special character issues

---

## Complete Logging Now

With the new timeout fixes, you'll see:

| Scenario | Log Message |
|----------|------------|
| Success | `[ORDER EMAIL SUCCESS] OS-xxx emails sent successfully` |
| Auth fails quickly | `[ORDER EMAIL ERROR] OS-xxx: 535 5.7.3 Authentication unsuccessful` |
| Hangs (auth timeout) | `[ORDER EMAIL ERROR] OS-xxx: Email send timeout after 10000ms - likely SMTP auth failure` |
| Network error | `[ORDER EMAIL ERROR] OS-xxx: getaddrinfo ENOTFOUND smtp.office365.com` |
| Connection refused | `[ORDER EMAIL ERROR] OS-xxx: connect ECONNREFUSED 587` |

**Every send will now report success or a specific error. No more silent hangs.**

---

## Next Steps

1. **Run password test:** `node test-password-formats.js`
2. **Update Railway SMTP_PASS** with the format that works
3. **Redeploy** (auto-triggered by git)
4. **Place test order** and observe results
5. **Check logs** for success or specific error
6. Report the results and we can iterate if needed

The password format test will definitively show which format to use. Once you have that, the email system should work.
