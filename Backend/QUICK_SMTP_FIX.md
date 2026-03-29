# SMTP Password Issues - Quick Fix

## Problem
Password `Microsoft1971turbs*` contains special character `*` which may not escape properly in Railway environment variables.

## Immediate Solution: Create New Outlook Account

Instead of troubleshooting the special character, create a **simpler password without special chars**:

1. Go to **https://outlook.office.com**
2. Click "Create a new account" 
3. Create: `sales.oxfordsports@outlook.com` (new account)
4. Set password: `OxfordSales2026` (simple, no special chars)
5. **Do NOT enable 2FA** on this account

Then in Railway, update:
```
SMTP_USER = sales.oxfordsports@outlook.com
SMTP_PASS = OxfordSales2026
SMTP_HOST = smtp.office365.com
SMTP_PORT = 587
CONTACT_EMAIL_TO = sales.oxfordsports@outlook.com
```

This eliminates the special character problem entirely.

---

## Alternative: Fix Current Account

If you want to keep sales@oxfordsports.net:

1. Go to Railway Variables
2. Update `SMTP_PASS` to: `Microsoft1971turbs\*` (escape the asterisk)
3. Deploy and test

---

## Test Locally

Before deploying to Railway, test locally:
```bash
cd Backend
node test-smtp.js
```

This will confirm the credentials work before pushing to production.

---

## Which Option?

- **Option A (Faster)**: Create new account with simple password → 5 minutes
- **Option B**: Fix escaping in Railway → 2 minutes

Recommendation: **Option A** - simpler, more reliable long-term.
