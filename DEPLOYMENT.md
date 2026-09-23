# 🌐 Deploying Infinity Hub Admin to Your Domain (`infinityhub.space`)

This guide explains how to connect your Namecheap domain **`infinityhub.space`** / **`www.infinityhub.space`** to your live website and API.

We recommend **Render.com** because:
- ✅ **100% Free** for Node.js apps
- ✅ **24/7 Uptime** (works even when your PC is turned off)
- ✅ **Free Automatic SSL (HTTPS)** (Roblox executors require HTTPS to fetch announcements)
- ✅ Takes less than 5 minutes to set up

---

## Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new).
2. Name the repository: `infinity-admin` (or any name you like).
3. Keep it **Public** or **Private** and click **Create repository**.
4. In your terminal on this computer, run:
   ```bash
   cd "c:\Users\chris\Desktop\Infinity Website"
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/infinity-admin.git
   git branch -M main
   git push -u origin main
   ```
   *(Replace `YOUR_GITHUB_USERNAME` with your GitHub username, e.g. `TripNation`)*

---

## Step 2: Deploy on Render (Free)

1. Go to [render.com](https://render.com) and log in with your GitHub account.
2. Click the blue **New +** button in the top right and select **Web Service**.
3. Select your newly created `infinity-admin` repository.
4. Fill in the settings:
   - **Name**: `infinity-admin`
   - **Region**: Closest to you (e.g. US East)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Scroll down to **Environment Variables** and add:
   - Key: `ADMIN_PASSWORD` | Value: `your_secure_password_here`
   - Key: `PUBLIC_BASE_URL` | Value: `https://www.infinityhub.space`
6. Click **Deploy Web Service**.

---

## Step 3: Connect Your Namecheap Domain (`infinityhub.space`)

1. In Render, open your service dashboard and click **Settings** in the left sidebar.
2. Scroll down to **Custom Domains** and click **Add Custom Domain**.
3. Enter `infinityhub.space` and click **Save**.
4. Click **Add Custom Domain** again and enter `www.infinityhub.space`.
5. Render will show you the exact DNS records to enter into Namecheap:
   - A **CNAME** record for `www` (e.g. `infinity-admin-xxxx.onrender.com`)
   - An **ANAME** or **A** record for `@` (e.g. pointing to Render's IP `216.24.57.1`)

---

## Step 4: Add the DNS Records in Namecheap

1. Log into your [Namecheap Dashboard](https://ap.www.namecheap.com/).
2. Go to **Domain List** on the left and click **Manage** next to `infinityhub.space`.
3. Click the **Advanced DNS** tab at the top.
4. Under **Host Records**, click **Add New Record**:
   - **Record 1**:
     - Type: `CNAME Record`
     - Host: `www`
     - Value: `<Your Render URL, e.g. infinity-admin-xxxx.onrender.com>`
     - TTL: `Automatic`
   - **Record 2**:
     - Type: `A Record`
     - Host: `@`
     - Value: `216.24.57.1` (or whatever IP Render displayed in Step 3)
     - TTL: `Automatic`
5. Click the green checkmarks to save both records.

---

## Step 5: Verification & Testing

Within a few minutes, Render will automatically issue a free SSL certificate:
- 👉 **Admin Dashboard**: `https://www.infinityhub.space`
- 👉 **Roblox Client API**: `https://www.infinityhub.space/api/announcements/latest`

Your Roblox client scripts (`main.lua` and `announcements.lua`) are **already pre-configured** to query `https://www.infinityhub.space/api/announcements/latest` first!
