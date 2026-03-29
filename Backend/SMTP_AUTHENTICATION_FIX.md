# SMTP Authentication Timeout Solution

## Confirmed Issue

Your Railway logs show:
```
[ORDER EMAIL ERROR] OS-20260329-0020: Email send timeout after 10000ms - likely SMTP auth failure
```

The SMTP authentication is timing out, which indicates the password format stored in Railway is not being recognized by Outlook SMTP.

## Root Cause Analysis

The password `Microsoft1971turbs*` contains a special asterisk character. Different systems handle this differently:

1. **MongoDB Connection String:** Successfully uses `Godaddy1971turbs*` — means asterisk works in URLs with proper encoding
2. **Outlook SMTP in Railway:** Fails to authenticate with `Microsoft1971turbs\*` — backslash escaping not recognized
3. **Possible issues:**
   - Railway environment variables might not preserve backslash escaping
   - Outlook SMTP might require the literal asterisk without escaping
   - Password might need URL encoding: `Microsoft1971turbs%2A`

## Solutions to Try (In Order)

### Solution 1: Remove Backslash Escaping (Most Likely)

**In Railway Variables, change:**
```
FROM: Microsoft1971turbs\*
TO:   Microsoft1971turbs*
```

The backslash might be causing Railway to send `\\*` literally instead of just `*`.

**Steps:**
1. Go to Railway dashboard → OxfordSports → Variables
2. Find `SMTP_PASS` variable
3. Change from `Microsoft1971turbs\*` to `Microsoft1971turbs*`
4. Click Save (auto-redeploys)
5. Wait 2-3 minutes for deployment
6. Place test order
7. Check logs for success or specific error

### Solution 2: Use URL Encoding (If Solution 1 Fails)

If Solution 1 doesn't work, try URL-encoded asterisk:

```
FROM: Microsoft1971turbs*
TO:   Microsoft1971turbs%2A
```

### Solution 3: Create New Outlook Account (If Solutions 1-2 Fail)

If neither format works, create a new account:

1. Create new Outlook account: `sales2@oxfordsports.net`
2. Set simple password: `OxfordSports2026!` (no asterisks)
3. Update Railway:
   - `SMTP_USER=sales2@oxfordsports.net`
   - `SMTP_PASS=OxfordSports2026!`
4. Test with new account

### Solution 4: Switch to Gmail (If All Above Fail)

If Outlook continues to fail:

1. Create/use Gmail account: `noreply@oxfordsports.net`
2. Create app-specific password in Gmail settings (this bypasses 2FA and special character issues)
3. Update Railway:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_USER=noreply@oxfordsports.net`
   - `SMTP_PASS=[gmail-app-password]`

---

## Implementation Steps

### Step 1: Start with Solution 1 (Remove Backslash)

This is most likely to work because:
- Backslash might be literal character in Railway env vars
- MongoDB successfully uses plain asterisk in URI
- Outlook likely expects actual asterisk, not escaped version

**Do this now:**
1. Go to Railway → OxfordSports → Variables
2. Edit `SMTP_PASS`
3. Change `Microsoft1971turbs\*` → `Microsoft1971turbs*`
4. Save

### Step 2: Wait for Deployment

Watch Railway dashboard:
- Build should complete in 1-2 minutes
- Deployment status should show 🟢 Active

### Step 3: Test

Place order and check logs for:
- ✅ `[ORDER EMAIL SUCCESS]` — Problem solved!
- 🔴 `Email send timeout` — Try Solution 2
- 🔴 `535 5.7.3 Authentication unsuccessful` — Try Solution 3
- Any other error — Use the error message to diagnose

---

## Why This Will Work

The authentication timeout indicates the SMTP server is not recognizing the credentials. The most common cause with special characters in Railway environment variables is that escaping is being treated literally. 

By removing the backslash, Railway will send the actual asterisk character that Outlook expects.

---

## Detailed Logs After Fix

Once you implement Solution 1, look for these logs:

**If successful:**
```
[ORDER EMAIL] Starting email send for order OS-20260329-0021...
[SMTP DEBUG] Creating transporter for sales@oxfordsports.net...
[SMTP DEBUG] Attempting to send emails for order OS-20260329-0021...
[SMTP CONFIG] Host: smtp.office365.com, Port: 587, User: sales@oxfordsports.net
[SMTP DEBUG] Sending admin email to sales@oxfordsports.net...
[ORDER EMAIL] Admin email sent to sales@oxfordsports.net
[ORDER EMAIL] Customer email sent to test@example.com
[ORDER EMAIL SUCCESS] OS-20260329-0021 emails sent successfully
```

**If still fails:**
```
[ORDER EMAIL ERROR] OS-20260329-0021: Email send timeout after 10000ms - likely SMTP auth failure
[SMTP DEBUG] Error code: undefined, Response: undefined
```
→ Try Solution 2 (URL encoding) or Solution 3 (new account)

---

## Quick Action Checklist

- [ ] Go to Railway Variables
- [ ] Find SMTP_PASS variable  
- [ ] Change `Microsoft1971turbs\*` to `Microsoft1971turbs*` (remove backslash)
- [ ] Click Save (auto-redeploys in 2-3 min)
- [ ] Wait for deployment to show 🟢 Active
- [ ] Place test order
- [ ] Check Railway logs for success or error
- [ ] Report result

That's all that's needed. The timeout fix deployed with your code is now working — we just need the right password format, and removing the backslash is the most likely solution.
