# Oxford Sports — Deployment Guide

## Option A: Single Server (Recommended for Render / Railway / VPS)

Everything runs from one Express server. The backend serves the React frontend.

### Steps:

1. **Build the frontend:**

   ```bash
   cd Frontend
   npm install
   npm run build
   ```

2. **Start the backend:**

   ```bash
   cd Backend
   npm install
   npm start
   ```

3. The backend will automatically serve `Frontend/dist/` at the root URL.

### Environment variables (set in your host's dashboard):

| Variable         | Value                           |
| ---------------- | ------------------------------- |
| `PORT`           | `5000` (or let the host assign) |
| `NODE_ENV`       | `production`                    |
| `ADMIN_PASSWORD` | `Godaddy1971turbs*`             |
| `CLIENT_ORIGIN`  | `https://supasales.uk`          |
| `ORDER_EMAIL`    | `sales@oxfordsports.net`        |

---

## Option B: Render.com (Free Tier)

1. Push to GitHub
2. Create a **Web Service** on Render:
   - **Root directory:** `Backend`
   - **Build command:** `cd ../Frontend && npm install && npm run build`
   - **Start command:** `node server.js`
   - Set environment variables from the table above

---

## Option C: Vercel (Frontend) + Railway (Backend)

### Frontend on Vercel:

1. Import `Frontend/` folder
2. Set `VITE_API_BASE_URL` to your Railway backend URL + `/api`
3. Set `VITE_BACKEND_URL` to your Railway backend URL

### Backend on Railway:

1. Import `Backend/` folder
2. Set environment variables from the table above
3. Add `CLIENT_ORIGIN` = your Vercel frontend URL

---

## Domains

- **supasales.uk** — primary domain
- **oxfordsports.online** — secondary domain (redirect or second deployment)

Simply point your domain's DNS to your host and add a custom domain in their dashboard.

---

## Data Persistence

Products are stored in `Backend/data/products.json` and images in `Backend/uploads/`.

For Render/Railway: data persists within the container's filesystem but may be lost on redeploy. For persistence:

- Use Render's **persistent disk** (attach to `/data` and `/uploads`)
- Or switch to a cloud storage solution for images (Cloudinary env vars are already supported)
