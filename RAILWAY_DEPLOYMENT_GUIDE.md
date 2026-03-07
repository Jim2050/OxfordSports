# 🚂 Railway Backend Deployment Guide

## Quick Deployment Steps

### Step 1: Configure Railway Environment Variables

In your Railway project settings (https://railway.com/project/ee830c03-c298-4735-a5bb-f07a929b77d0/service/bea2da88-ff2a-4157-9731-35d29e2ca1ab/settings?environmentId=93194f46-5c84-4a65-96d8-7942257b8b02), add these environment variables:

```env
# ── REQUIRED ──
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford
JWT_SECRET=oxford-sports-jwt-secret-2026

# ── ADMIN CREDENTIALS ──
ADMIN_EMAIL=admin@oxfordsports.net
ADMIN_PASSWORD=Godaddy1971turbs*

# ── CLOUDINARY (Image Storage) ──
CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>

# ── EMAIL (Optional - if you use SMTP) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CONTACT_EMAIL_TO=sales@oxfordsports.net

# ── CORS - ADD YOUR NETLIFY URL ──
CLIENT_ORIGIN=https://your-netlify-site.netlify.app
```

**IMPORTANT:** Replace `https://your-netlify-site.netlify.app` with your actual Netlify URL!

### Step 2: Connect GitHub Repository to Railway

1. Go to your Railway service settings
2. Click "Connect to GitHub Repository"
3. Select your repository
4. Set the **Root Directory** to: `Backend`
5. Railway will auto-detect your Node.js app

### Step 3: Deploy

1. Click "Deploy" in Railway
2. Railway will:
   - Install dependencies from `package.json`
   - Run `node server.js`
   - Expose your service on a public URL

### Step 4: Get Your Railway Backend URL

After deployment completes:

1. Go to your Railway service
2. Click on "Settings" → "Networking"
3. Click "Generate Domain"
4. Copy the generated URL (e.g., `https://your-app.up.railway.app`)

### Step 5: Update Frontend Environment Variable

Update your Netlify site environment variables:

1. Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables
2. Add/Update:
   ```
   VITE_API_BASE_URL=https://your-app.up.railway.app/api
   ```
3. Click "Save"
4. Redeploy your Netlify site (Deploys → Trigger Deploy → Deploy site)

---

## Testing Your Live Deployment

### Test Backend API

```bash
# Health check
curl https://your-app.up.railway.app/api/health

# Get products
curl https://your-app.up.railway.app/api/products
```

### Test Frontend

1. Visit your Netlify URL
2. Check browser console for API calls
3. Test product browsing
4. Test admin login

---

## Troubleshooting

### Railway Logs

- Check logs in Railway dashboard: Service → Logs
- Look for connection errors or startup issues

### Common Issues

**Database Connection Failed:**

- Verify `MONGO_URI` is correct
- Check MongoDB Atlas allows connections from anywhere (0.0.0.0/0)

**CORS Errors:**

- Ensure `CLIENT_ORIGIN` matches your Netlify URL exactly
- No trailing slash in the URL

**Images Not Loading:**

- Verify Cloudinary credentials are set
- Check if images exist in Cloudinary dashboard

**502 Bad Gateway:**

- Check Railway logs for startup errors
- Ensure `PORT` is set to `5000`
- Verify `start` script in package.json

---

## Railway Service Configuration Summary

✅ **Build Command:** Auto-detected (npm install)  
✅ **Start Command:** `node server.js`  
✅ **Root Directory:** `Backend`  
✅ **Port:** `5000` (Railway auto-assigns public port)  
✅ **Region:** Choose closest to your users

---

## Quick Deployment Checklist

- [ ] Railway environment variables configured
- [ ] GitHub repository connected to Railway
- [ ] Root directory set to `Backend`
- [ ] Railway backend deployed successfully
- [ ] Railway domain generated and copied
- [ ] Netlify environment variable `VITE_API_BASE_URL` updated
- [ ] Netlify site redeployed
- [ ] API health check passes
- [ ] Frontend can fetch products
- [ ] Admin login works
- [ ] Product images load correctly

---

## Need Help?

Check Railway documentation: https://docs.railway.app
