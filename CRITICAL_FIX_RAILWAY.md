# ⚠️ CRITICAL FIX REQUIRED - SET ROOT DIRECTORY IN RAILWAY

## 🚨 THE PROBLEM

Railway is trying to build from the **repo root** instead of the **Backend folder**.

**Evidence from your logs:**

```
build │ cd ./Backend && npm install && npm run build
```

Railway shouldn't need to `cd ./Backend` - it should already BE in the Backend folder!

---

## ✅ THE SOLUTION - SET ROOT DIRECTORY

### **STEP 1: Go to Railway Settings** (CRITICAL!)

1. Open your Railway project: https://railway.com/project/ee830c03-c298-4735-a5bb-f07a929b77d0/service/bea2da88-ff2a-4157-9731-35d29e2ca1ab

2. Click the **"Settings"** tab

3. Scroll down to **"Source"** or **"Build"** section

4. Find the **"Root Directory"** field

5. Set it to: `Backend`

6. Click **"Save"** or it saves automatically

7. **Redeploy** your service (it should auto-redeploy)

---

## 📋 VERIFY OTHER SETTINGS

While in Railway Settings, also verify:

### **Environment Variables** (Settings → Variables):

```
NODE_ENV=production
PORT=5000
MONGO_URI=<your_mongo_uri>
JWT_SECRET=<your_jwt_secret>
ADMIN_EMAIL=admin@oxfordsports.net
ADMIN_PASSWORD=<your_admin_password>
CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>
CLIENT_ORIGIN=https://YOUR-NETLIFY-SITE.netlify.app
```

**⚠️ Replace `YOUR-NETLIFY-SITE.netlify.app` with your actual Netlify URL!**

---

## 🔧 FILES I JUST FIXED

To handle the build script issue, I updated:

### 1. **package.json** - Added build script:

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "echo 'No build step needed for backend'"
  }
}
```

### 2. **nixpacks.toml** - Optimized install command:

```toml
[phases.install]
cmds = ['npm ci --omit=dev']
```

These changes are now pushed to GitHub.

---

## 🎯 AFTER SETTING ROOT DIRECTORY

Once you set Root Directory to `Backend`, Railway will:

```
1. Start in /app/Backend folder
2. Find package.json ✅
3. Find nixpacks.toml ✅
4. Run: npm ci --omit=dev ✅
5. Run: npm run build (harmless echo) ✅
6. Start: node server.js ✅
```

**Expected logs:**

```
Using Nixpacks
setup  │ pkgs: nodejs_20
build  │ npm ci --omit=dev
start  │ node server.js
🚀 Oxford Sports API running on http://localhost:5000
📦 Database: MongoDB Atlas
```

---

## 📸 VISUAL GUIDE - WHERE TO SET ROOT DIRECTORY

**Location in Railway:**

```
Railway Dashboard
  → Your Project
    → Your Service (Backend)
      → Settings tab
        → Service section
          → Root Directory: Backend  👈 SET THIS!
```

---

## ⏱️ TIMELINE

1. ✅ **Code fixed** - Already pushed to GitHub
2. ⚠️ **Set Root Directory** - YOU MUST DO THIS NOW
3. 🔄 **Railway auto-redeploys** - After you save settings
4. ⏱️ **Build completes** - 1-2 minutes
5. ✅ **Service Active** - Ready to test

---

## 🧪 TESTING CHECKLIST

After deployment succeeds:

- [ ] Railway status shows "Active" (green)
- [ ] Logs show: `🚀 Oxford Sports API running`
- [ ] Test: `https://your-railway-url.up.railway.app/api/health`
- [ ] Returns: `{"status":"ok","products":XXX,"db":"mongodb"}`
- [ ] Test: `https://your-railway-url.up.railway.app/api/products`
- [ ] Returns: Array of products

---

## 🚨 WHAT HAPPENS IF YOU DON'T SET ROOT DIRECTORY

Railway will:

- ❌ Try to `cd ./Backend` (shouldn't need to!)
- ❌ Not find npm (wrong context)
- ❌ Fail to build
- ❌ Keep showing the error you just saw

---

## ✅ QUICK ACTION CHECKLIST

- [ ] Go to Railway Settings
- [ ] Set Root Directory to `Backend`
- [ ] Save settings
- [ ] Wait for auto-redeploy (1-2 minutes)
- [ ] Check logs for success
- [ ] Get Railway URL from Settings → Networking
- [ ] Test `/api/health` endpoint

---

**⚠️ SET ROOT DIRECTORY TO `Backend` IN RAILWAY SETTINGS NOW!**

Then wait 2 minutes and check the deployment logs.

Let me know once it's deployed successfully! 🚀
