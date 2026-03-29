# Gmail Email Setup (Simple 1-Time Configuration)

This is the **simplest email solution**. No SMTP troubleshooting, no escaping passwords, just one-time setup.

## Setup Steps (Literally 3 minutes)

### Step 1: Generate Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
   - (You must have 2-factor authentication enabled - this protects the account)
   - If 2FA not enabled, enable it first: https://myaccount.google.com/security
   
2. Select:
   - **App:** Mail
   - **Device:** Windows Computer (or whatever device is deploying)
   
3. Google generates a **16-character password** (with spaces)
   - Example: `abcd efgh ijkl mnop`
   - **Copy this exactly** (including spaces)

### Step 2: Add to Railway Environment Variables

1. Go to Railway console: https://railway.app/dashboard
2. Find "OxfordSports" project → Settings → Variables
3. Add new variable:
   - **Name:** `GMAIL_PASS`
   - **Value:** Paste the 16-char password from Step 1 (with spaces)
   
4. Click "Save"
   - Railway automatically redeploys with new variables

### Step 3: Done!

That's it. Orders will now send emails via Gmail.

**What's happening behind the scenes:**
- New orders go through email queue system
- Emails send via `smtp.gmail.com:587` (much more reliable than Outlook)
- If SMTP fails, system logs detailed error
- Database tracks email delivery status (emailSent field)

## Troubleshooting

**"Email still timing out?"**
- Check Railway logs: search for `[ORDER EMAIL]`
- Verify GMAIL_PASS was saved correctly (check Railway Variables)
- Gmail sometimes locks account temporarily - wait 10 minutes and try again

**"How do I verify it's working?"**
1. Place a test order on the site
2. Check Railway logs: should see `[ORDER EMAIL SUCCESS]` (not timeout)
3. Check MongoDB → Order document: `emailSent: true`

**"Can I use a different email provider?"**
- The code automatically falls back to Gmail if SMTP_PASS is not configured
- To use a different provider: set SMTP_HOST, SMTP_USER, SMTP_PORT, SMTP_PASS in Railway

## Why Gmail?

✅ Works reliably (99.9% uptime)
✅ No tweaking passwords or configuration
✅ 16-char app password works immediately after generation
✅ Accounts don't mysteriously lock like Outlook
✅ Free tier supports unlimited emails
✅ One-time setup, never touch again

Just paste the password and it works. Like HTML → just set it and forget it.
