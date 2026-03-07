# 🚀 Complete Deployment Guide - Oxford Sports

## Current Status

- ✅ Frontend: Live on Netlify
- 🔄 Backend: Ready to deploy on Railway

---

## Part 1: Railway Backend Deployment (10 minutes)

### Step 1: Push Latest Code to GitHub (1 min)

```bash
# Run these commands from the project root
git add .
git commit -m "Add Railway configuration for backend deployment"
git push origin main
```

### Step 2: Configure Railway Environment Variables (3 mins)

Go to your Railway project:
👉 https://railway.com/project/ee830c03-c298-4735-a5bb-f07a929b77d0/service/bea2da88-ff2a-4157-9731-35d29e2ca1ab/variables

Click "**+ New Variable**" and add each of these:

| Variable Name           | Value                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`              | `production`                                                                      |
| `PORT`                  | `5000`                                                                            |
| `MONGO_URI`             | `<your_mongo_uri>`                                                                |
| `JWT_SECRET`            | `<your_jwt_secret>`                                                               |
| `ADMIN_EMAIL`           | `admin@oxfordsports.net`                                                          |
| `ADMIN_PASSWORD`        | `<your_admin_password>`                                                           |
| `CLOUDINARY_CLOUD_NAME` | `<your_cloud_name>`                                                               |
| `CLOUDINARY_API_KEY`    | `<your_api_key>`                                                                  |
| `CLOUDINARY_API_SECRET` | `<your_api_secret>`                                                               |
| `CONTACT_EMAIL_TO`      | `sales@oxfordsports.net`                                                          |
| `CLIENT_ORIGIN`         | `https://YOUR-NETLIFY-SITE.netlify.app`                                           |

**⚠️ IMPORTANT:** Replace `https://YOUR-NETLIFY-SITE.netlify.app` with your actual Netlify URL!

### Step 3: Connect GitHub Repository (2 mins)

1. In Railway, go to **Settings** tab
2. Click "**Connect Repo**" or "**Source**"
3. Select your GitHub repository
4. Important: Set **Root Directory** to: `Backend`
5. Click "**Deploy**"

### Step 4: Generate Public Domain (1 min)

1. Go to **Settings** → **Networking**
2. Click "**Generate Domain**"
3. You'll get a URL like: `https://your-app.up.railway.app`
4. **📋 Copy this URL - you'll need it next!**

### Step 5: Update CLIENT_ORIGIN (1 min)

1. Go back to **Variables** tab
2. Update `CLIENT_ORIGIN` to your Netlify URL (if you didn't already)
3. Railway will auto-redeploy

### Step 6: Wait for Deployment (2 mins)

- Watch the **Logs** tab
- Look for: `🚀 Oxford Sports API running on`
- Status should show "Active" ✅

---

## Part 2: Update Frontend to Use Live Backend (5 minutes)

### Step 1: Get Your URLs

✅ **Railway Backend URL:** `https://________.up.railway.app` (from above)  
✅ **Netlify Frontend URL:** `https://________.netlify.app` (your current site)

### Step 2: Update Netlify Environment Variable

1. Go to your Netlify site dashboard
2. Click **Site Settings** → **Environment Variables**
3. Add or update:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://your-railway-app.up.railway.app/api` (⚠️ include `/api` at the end!)
4. Click **Save**

### Step 3: Redeploy Frontend

1. Go to **Deploys** tab
2. Click **Trigger Deploy** → **Deploy site**
3. Wait for deployment to complete (~1-2 minutes)

---

## Part 3: Testing Your Live Application (5 minutes)

### Test 1: Backend Health Check ✅

Open in browser or terminal:

```
https://your-railway-app.up.railway.app/api/health
```

**Expected:** `{"status":"ok","products":XXX,"db":"mongodb"}`

### Test 2: Backend Products API ✅

```
https://your-railway-app.up.railway.app/api/products
```

**Expected:** JSON array of products

### Test 3: Frontend Homepage ✅

Visit your Netlify URL:

```
https://your-netlify-site.netlify.app
```

**Check:**

- ✅ Products load on homepage
- ✅ Categories display
- ✅ Images show correctly
- ✅ No console errors (press F12)

### Test 4: Product Details Page ✅

1. Click on any product
2. Product details should load
3. Images should display

### Test 5: Admin Login ✅

1. Go to: `https://your-netlify-site.netlify.app/admin/login`
2. Login with:
   - **Email:** `admin@oxfordsports.net`
   - **Password:** `Godaddy1971turbs*`
3. Should redirect to admin dashboard

### Test 6: Search Functionality ✅

1. Use search bar on homepage
2. Type a product name
3. Results should appear

### Test 7: Categories ✅

1. Click on a category
2. Category page should load with filtered products

---

## Troubleshooting

### ❌ Backend not starting on Railway

**Check Railway Logs:**

- Look for error messages
- Common: Database connection failed

**Fix:**

- Verify `MONGO_URI` is correct
- Check MongoDB Atlas Network Access allows 0.0.0.0/0

### ❌ Frontend shows "Network Error" or "Failed to fetch"

**Check Browser Console (F12):**

- Look for CORS errors
- Look for 404 errors

**Fix:**

1. Verify `VITE_API_BASE_URL` in Netlify env vars
2. Ensure `CLIENT_ORIGIN` in Railway matches Netlify URL exactly (no trailing slash)
3. Redeploy both if you made changes

### ❌ Images not loading

**Check:**

- Cloudinary credentials in Railway
- Network tab in browser (F12) for image URLs

### ❌ Admin login fails

**Check:**

- Railway logs show "✅ Default admin user seeded"
- Try the password exactly as provided
- Check browser console for API errors

---

## Quick Command Reference

### Test Backend from Terminal

```bash
# Health check
curl https://your-app.up.railway.app/api/health

# Get products
curl https://your-app.up.railway.app/api/products

# Get categories
curl https://your-app.up.railway.app/api/products/categories
```

### View Railway Logs

```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Login and view logs
railway login
railway logs
```

---

## Deployment Checklist

### Railway Backend ✓

- [ ] Code pushed to GitHub
- [ ] Railway environment variables configured
- [ ] GitHub repo connected to Railway
- [ ] Root directory set to `Backend`
- [ ] Domain generated
- [ ] Deployment successful (check logs)
- [ ] `/api/health` returns status ok
- [ ] `/api/products` returns products

### Netlify Frontend ✓

- [ ] `VITE_API_BASE_URL` set in Netlify
- [ ] Site redeployed after env var update
- [ ] Homepage loads products
- [ ] Product details page works
- [ ] Admin login works
- [ ] No browser console errors
- [ ] Images load correctly

### Cross-Platform ✓

- [ ] CORS working (no errors)
- [ ] Railway `CLIENT_ORIGIN` matches Netlify URL
- [ ] All API calls from frontend work

---

## 📞 Support Resources

- **Railway Docs:** https://docs.railway.app
- **Netlify Docs:** https://docs.netlify.com
- **MongoDB Atlas:** https://cloud.mongodb.com
- **Cloudinary:** https://cloudinary.com/console

---

## Success! 🎉

Once all checklist items are ✅, your full-stack application is live:

- 🌐 **Frontend:** https://your-site.netlify.app
- 🔌 **Backend API:** https://your-app.up.railway.app/api
- 💾 **Database:** MongoDB Atlas
- 🖼️ **Images:** Cloudinary

Your Oxford Sports e-commerce platform is now production-ready!
