# 🐳 Docker Deployment Guide for Railway

## What Changed

We've configured your backend to deploy using Docker instead of Nixpacks:

### Files Created:

1. ✅ **Dockerfile** - Defines how to build your container
2. ✅ **.dockerignore** - Excludes unnecessary files from the image
3. ✅ **railway.json** - Updated to use Docker builder

## Docker Configuration Details

### Dockerfile Features:

- **Base Image:** `node:20-alpine` (small, secure, production-ready)
- **Working Directory:** `/app`
- **Dependencies:** Installs only production dependencies
- **Port:** Exposes 5000 but uses dynamic `PORT` env var from Railway
- **Entry Point:** `node server.js`

### .dockerignore Features:

- Excludes `node_modules` (rebuilt in container)
- Excludes `.env` (Railway provides env vars)
- Excludes test and development files
- Smaller image size = faster deployments

## Railway Deployment Steps

### Step 1: Commit and Push Docker Files

```bash
cd e:\PPH_Ali
git add Backend/Dockerfile Backend/.dockerignore Backend/railway.json
git commit -m "Add Docker configuration for Railway deployment"
git push origin master
```

### Step 2: Railway Will Auto-Deploy

Once you push to GitHub:

1. Railway detects the `Dockerfile`
2. Builds Docker image
3. Deploys container
4. Exposes on public URL

**No additional configuration needed!** Railway automatically:

- Uses the Dockerfile
- Sets the `PORT` environment variable
- Maps to public domain

### Step 3: Verify Deployment

Check Railway logs for:

```
🚀  Oxford Sports API running on http://localhost:XXXX
📦  Database: MongoDB Atlas
```

Test the API:

```bash
curl https://your-app.up.railway.app/api/health
```

## Environment Variables (Reminder)

Make sure these are set in Railway dashboard:

```
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford
JWT_SECRET=oxford-sports-jwt-secret-2026
ADMIN_EMAIL=admin@oxfordsports.net
ADMIN_PASSWORD=Godaddy1971turbs*
CLOUDINARY_CLOUD_NAME=dxsxoqiq3
CLOUDINARY_API_KEY=431986497367911
CLOUDINARY_API_SECRET=0mREQCXhMvbi8Ze1Ob5NsAqQZ1M
CONTACT_EMAIL_TO=sales@oxfordsports.net
CLIENT_ORIGIN=https://your-netlify-site.netlify.app
```

## Testing Docker Locally (Optional)

If you want to test Docker locally before deploying:

```bash
# Build image
cd Backend
docker build -t oxford-backend .

# Run container
docker run -p 5000:5000 --env-file .env oxford-backend

# Test
curl http://localhost:5000/api/health
```

## Advantages of Docker Deployment

✅ **Consistent Environment** - Same container runs locally and on Railway  
✅ **Faster Builds** - Docker layer caching speeds up rebuilds  
✅ **Predictable** - Explicit control over Node version and dependencies  
✅ **Portable** - Can deploy to any platform that supports Docker

## Troubleshooting

### Build Fails

- Check Railway logs for error messages
- Verify `package.json` dependencies are compatible
- Ensure `package-lock.json` exists

### Container Won't Start

- Check Railway logs: "View Logs" tab
- Verify environment variables are set
- Test MongoDB connection string

### Port Issues

- Railway automatically sets `PORT` env var
- Your code already handles this: `const PORT = process.env.PORT || 5000`

## Next Steps

1. ✅ Push Docker files to GitHub (see Step 1 above)
2. 🔄 Railway will automatically detect and deploy
3. 🧪 Test your API endpoints
4. 🌐 Update frontend with Railway URL

---

**Ready to deploy!** Just commit and push the files.
