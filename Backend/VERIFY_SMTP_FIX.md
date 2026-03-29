# SMTP Fix Verification Guide

**Objective:** Verify that the SMTP password special character fix is working correctly after deployment.

---

## Step 1: Verify Railway Deployment

1. Go to: https://railway.app/dashboard
2. Find **OxfordSports** project
3. Check **Build Status** — Should show 🟢 **Success**
4. Check **Deploy Status** — Should show 🟢 **Active**
5. Note the deployment timestamp (should be recent, within last 5 minutes)

**Expected Result:** Green checkmarks for both build and deploy

---

## Step 2: Run SMTP Diagnostic Locally (Optional but Recommended)

Open terminal in `Backend/` folder and run:

```bash
node test-smtp.js
```

**Expected Output:**
```
🔍 SMTP DIAGNOSTIC TEST

📋 Configuration:
  SMTP_HOST: smtp.office365.com
  SMTP_PORT: 587
  SMTP_USER: sales@oxfordsports.net
  SMTP_PASS: ***SET***
  CONTACT_EMAIL_TO: sales@oxfordsports.net

⚙️  Creating transporter...
🧪 Testing SMTP connection...
✅ SMTP connection verified!

📧 Sending test email...
✅ Test email sent successfully!
  Message ID: <abc123@oxfordsports.net>
```

**If You See Errors:**
- `getaddrinfo ENOTFOUND smtp.office365.com` — Network issue or SMTP_HOST wrong
- `Invalid login: 535 5.7.3 Authentication unsuccessful` — Password still not escaping correctly
- `ECONNREFUSED` — Firewall blocking port 587 (less likely)

---

## Step 3: Place a Test Order

### Option A: Manual Test (Via Frontend)

1. Go to: https://oxfordsports-production.up.railway.app/
2. **Login** with your test account (or create one if needed)
3. **Add items to cart** — Make sure total is over £300
   - Example: 2x High-value item = £350+
4. **Click "Pay"** button
5. **Confirm order**
6. Observe the **modal**:
   - 🟢 Green = Email sent successfully
   - 🔵 Blue = Email still sending
   - 🟡 Amber = Email failed

**Expected Result:** Should complete in < 1 second with green checkmark

### Option B: API Test (Via cURL)

First, get an auth token:

```bash
# Create test user and login
curl -X POST https://oxfordsports-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "testuser@example.com",
    "password": "TestPassword123!"
  }'

# Get token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Then place an order:

```bash
curl -X POST https://oxfordsports-production.up.railway.app/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {
        "sku": "NIKE-AIR-MAX-001",
        "size": "UK10",
        "quantity": 2
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "orderNumber": "OS-20260329-0015",
    "status": "confirmed"
  },
  "emailStatus": {
    "sent": true,
    "timestamp": "2026-03-29T10:30:45Z"
  }
}
```

---

## Step 4: Check Email Inbox

### Check Recipient Email

1. Go to: https://mail.google.com/ (for alirazamemonofficial@gmail.com)
2. Check **Inbox** for email from `sales@oxfordsports.net`
3. Subject should be: `"Your Oxford Sports Order Confirmation: OS-YYYYMMDD-XXXX"`
4. Look for:
   - Order number
   - Total price
   - Shipping details
   - Items ordered

**Timeline:** Email should arrive within 1-2 minutes of order placement

### Check Sender's Sent Folder

1. Log into: https://outlook.office.com/
2. Navigate to **sales@oxfordsports.net** account
3. Check **Sent** folder
4. You should see the confirmation email you just sent

---

## Step 5: Verify Railway Logs

1. Go to: https://railway.app/dashboard → OxfordSports → **Deployments**
2. View current deployment logs
3. Search for these success indicators:

```
[SMTP CONFIG] Host: smtp.office365.com, Port: 587, User: sales@oxfordsports.net
[ORDER EMAIL SUCCESS] Order OS-YYYYMMDD-XXXX email sent successfully
```

Or check for errors like:

```
[SMTP DEBUG] Connection error: 535 5.7.3 Authentication unsuccessful
```

---

## Step 6: Troubleshooting If It Still Doesn't Work

### Issue: Modal shows 🟡 (Amber/Error) or 🔵 (Blue/Still Sending)

**Diagnosis:**
1. Check Railway log at step 5 above
2. Look for `[SMTP DEBUG]` error message
3. If you see: `535 5.7.3 Authentication unsuccessful`
   - The asterisk is still not escaping properly

**Fix:**
1. Go to Railway Variables for the OxfordSports project
2. Find `SMTP_PASS` — current value should be `Microsoft1971turbs\*`
3. If it's showing as `Microsoft1971turbs*` (without backslash):
   - Update to: `Microsoft1971turbs\*` 
   - Save and redeploy
4. Wait 2-3 minutes for new deployment
5. Return to Step 3 and try again

### Issue: Email not received after 5 minutes

1. Check **Spam/Junk folder** in email client
2. Run the SMTP test locally again (Step 2)
3. If local test succeeds but Order email fails:
   - Check Railway logs for cryptic error codes
   - Contact Outlook support with error code from logs

### Issue: SMTP test shows `✅ Test email sent` but Order emails don't arrive

**This suggests:**
- SMTP credentials are correct
- But email queue has a different issue
- Check Railway logs for `[ORDER EMAIL SUCCESS]` vs `[ORDER EMAIL ERROR]`

---

## Summary Checklist

- [ ] Railway build: 🟢 Green
- [ ] Railway deploy: 🟢 Active
- [ ] SMTP test: ✅ `Test email sent successfully!`
- [ ] Order placed: Status < 1 second
- [ ] Modal color: 🟢 Green (success)
- [ ] Email received: In receiver's inbox within 2 minutes
- [ ] Order number in email: Matches order confirmation on site
- [ ] Sales Sent folder: Email appears in sales@oxfordsports.net Sent items

**All green?** 🎉 SMTP fix is working! Continue with normal operations.

**Something red?** ⚠️ Use the troubleshooting section above to identify the issue.

---

## Quick Reference: Key Variables

```
SMTP_HOST    = smtp.office365.com
SMTP_PORT    = 587
SMTP_USER    = sales@oxfordsports.net
SMTP_PASS    = Microsoft1971turbs\*  ← Must have backslash before asterisk
```

**Critical:** The backslash MUST be present in Railway Variables for password with special characters.
