================================================================================
SERENITY HUB - LIVE ANNOUNCEMENT ADMIN & API SERVER GUIDE
================================================================================

This folder contains the complete, production-ready website and REST API 
for creating, scheduling, and broadcasting live announcements to players 
using Serenity Hub in Roblox.

--------------------------------------------------------------------------------
WHAT IS INCLUDED:
--------------------------------------------------------------------------------
- Express.js Backend Server (`server.js`)
- REST API:
    GET  /api/announcements/latest  -> Public endpoint polled by Roblox in-game
    GET  /api/announcements         -> Announcement history list
    POST /api/announcements         -> Publish a new live announcement (Admin password required)
    GET  /api/status                -> Server health and connection stats
- Modern Cyberpunk Dark Admin Dashboard (`public/index.html`):
    * Real-time preview card that simulates in-game Roblox popup
    * Live telemetry and stats
    * Instant send test announcement button
    * Secure password-protected login
- Render deployment configuration (`render.yaml`) set to the 100% FREE plan

================================================================================
STEP 1: RUN LOCALLY ON YOUR COMPUTER (TESTING)
================================================================================
1. Open PowerShell or Command Prompt inside this folder:
   cd "C:\Users\chris\Desktop\Serenity Website"

2. Install dependencies (only needed once):
   npm install

3. Start the server:
   npm start

4. Open your browser and go to:
   http://localhost:3000

5. Enter the Administrator Password:
   SerenityAdmin2026!
   (You can change this password anytime inside the .env file)

6. Click "SEND TEST ANNOUNCEMENT" to verify the dashboard works!

================================================================================
STEP 2: PUSH TO GITHUB (SO RENDER CAN HOST IT)
================================================================================
1. Go to https://github.com/new and create a new repository:
   - Repository Name: serenity-admin
   - Set to: Public (or Private)
   - Leave "Add a README file" UNCHECKED
   - Click "Create repository"

2. Run these commands in PowerShell inside this "Serenity Website" folder:
   git init
   git add .
   git commit -m "Serenity Hub Admin Console"
   git branch -M main
   git remote add origin https://github.com/TripNation/serenity-admin.git
   git push -u origin main

================================================================================
STEP 3: DEPLOY ON RENDER.COM (100% FREE TIER)
================================================================================
1. Go to https://dashboard.render.com
2. Click the blue "+ New" button at top right -> Select "Web Service".
3. Under "Connect a repository", choose:
   TripNation/serenity-admin
4. Settings:
   - Name: serenity-admin
   - Region: Oregon (US West) or Ohio
   - Branch: main
   - Runtime: Node
   - Build Command: npm install
   - Start Command: npm start
   - Instance Type: SELECT "Free" ($0/month)
5. Environment Variables (click "Add Environment Variable"):
   Key: ADMIN_PASSWORD      Value: SerenityAdmin2026!
   Key: PUBLIC_BASE_URL     Value: https://serenityhub.site
6. Click "Deploy Web Service".
7. Wait 1-2 minutes until Render status says "Live".

================================================================================
STEP 4: CONNECT YOUR NAMECHEAP DOMAIN (serenityhub.site)
================================================================================
1. In your Render Dashboard, click your new "serenity-admin" service.
2. In the left menu, click "Settings" -> scroll down to "Custom Domains".
3. Click "Add Custom Domain":
   - Enter: serenityhub.site
   - Render will display the DNS records to add.
   - Also add: www.serenityhub.site

4. Now log into Namecheap (https://www.namecheap.com):
   - Go to "Domain List" -> click "Manage" next to serenityhub.site
   - Click the "Advanced DNS" tab
   - Delete any old parking records, then add:
     Type:  A Record
     Host:  @
     Value: (The IP address provided by Render, e.g. 216.24.57.1)
     TTL:   Automatic

     Type:  CNAME Record
     Host:  www
     Value: (Your onrender address, e.g. serenity-admin-xxxx.onrender.com)
     TTL:   Automatic
   - Save changes (click green checkmarks).

5. Within 5-15 minutes, Render will verify DNS and automatically issue a 
   FREE SSL (HTTPS) certificate. Your site will be live at:
   https://serenityhub.site

================================================================================
STEP 5: CONNECTING TO ROBLOX (HOW IT ALL TALKS TOGETHER)
================================================================================
In your Roblox announcement script (inside C:\Users\chris\Desktop\announcement),
the script is already configured to poll:
https://serenityhub.site/api/announcements/latest

Whenever you submit an announcement from your admin website at 
https://serenityhub.site, every player running the script in Roblox 
will see the announcement popup on their screen within seconds!
