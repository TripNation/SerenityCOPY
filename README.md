# 🚀 Infinity Hub — Live Announcement Admin & API

A fast, lightweight, and modern local admin website and REST API for creating and managing live in-game announcements for **Infinity Hub**.

Designed with a sleek dark purple and blue UI, real-time popup preview, zero-dependency persistent JSON storage, and safe Lua client integration.

---

## ⚡ Quick Start (Running Locally)

### 1. Install Node.js
Make sure [Node.js](https://nodejs.org/) (version 18 or higher) is installed on your computer.

### 2. Open the Project Folder
Open your terminal (PowerShell, Command Prompt, or Terminal) in this directory:
```bash
cd "c:\Users\chris\Desktop\Infinity Website"
```

### 3. Install Dependencies
Run:
```bash
npm install
```

### 4. Configure Your Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell, you can run: `Copy-Item .env.example .env`)*

Open `.env` and set your preferred admin password:
```env
PORT=3000
ADMIN_PASSWORD=yourpassword
PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Start the Server
Start the production server:
```bash
npm start
```

Or start the server in **development mode** (with auto-reload on file edits via nodemon):
```bash
npm run dev
```

### 6. Open the Admin Dashboard
Open your web browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

1. Authorize your session with your `ADMIN_PASSWORD`.
2. Click **SEND TEST ANNOUNCEMENT** or enter a custom announcement and click **SEND ANNOUNCEMENT**.
3. Open **[http://localhost:3000/api/announcements/latest](http://localhost:3000/api/announcements/latest)** in a new tab to see your live JSON announcement response!

---

## ⚠️ Important Localhost Limitation

> [!WARNING]
> **`localhost` only works from the same computer running the server.**
>
> Other Infinity Hub users cannot access `http://localhost:3000` from their computers.
>
> For real live announcements to reach players and users outside your network, you will eventually need to deploy this server publicly (e.g. to Render, Railway, a VPS, or expose it securely via Cloudflare Tunnels / ngrok) and update `PUBLIC_BASE_URL` in your `.env`.

---

## 🌐 Public Deployment Preparation

This application is built with deployment flexibility in mind. **No URLs are hard-coded!**

When you are ready to host the website and API publicly:
1. Deploy the repository to your hosting provider of choice (e.g. Railway, Render, Fly.io, Heroku, or a Linux VPS).
2. Set the environment variable `PUBLIC_BASE_URL` in your host's dashboard to your public domain:
   ```env
   PORT=3000
   ADMIN_PASSWORD=your_secure_random_production_password
   PUBLIC_BASE_URL=https://admin.infinityhub.com
   ```
3. Update your Infinity Hub client config `ApiUrl` to:
   ```lua
   ApiUrl = "https://admin.infinityhub.com/api/announcements/latest"
   ```
No code rewrites needed!

---

## 📡 REST API Reference

### Public Endpoints (Accessible by Client)

#### `GET /api/announcements/latest`
Fetches the latest active announcement matching target criteria. Returns `200 OK` with JSON object (or `null` if none active).
```json
{
  "id": 105,
  "title": "Ride A Pet",
  "message": "New update releasing tonight!",
  "type": "update",
  "target": "everyone",
  "targetModule": null,
  "minimumHubVersion": null,
  "duration": 15,
  "active": true,
  "createdAt": "2026-09-22T12:00:00.000Z"
}
```

#### `GET /api/status`
Returns server connectivity, uptime, client mode, and current latest announcement ID.

---

### Admin Endpoints (Requires Password)
All write actions require the `x-admin-password: <password>` header or `Authorization: Bearer <password>`.

- `GET /api/announcements` — List all past and present announcements.
- `POST /api/announcements` — Create and broadcast a new announcement.
- `PATCH /api/announcements/:id` — Edit an announcement or toggle `active` status (`true`/`false`).
- `DELETE /api/announcements/:id` — Permanently delete an announcement by ID.
- `POST /api/auth/verify` — Check if an admin password is valid.

---

## 🎮 Infinity Hub Client (Roblox Lua) Integration

A complete, battle-tested Lua integration script is provided in:
[`client/infinity_announcements.lua`](client/infinity_announcements.lua)

### Conceptual Polling Logic
```lua
local HttpService = game:GetService("HttpService")

local InfinityConfig = {
    ApiUrl = "http://localhost:3000/api/announcements/latest",
    PollInterval = 15,
    HubVersion = "2.1.0",
    CurrentModule = "Ride A Pet",
    DebugMode = true
}

local lastSeenAnnouncementId = nil

-- Safe non-blocking fetcher
local function FetchLatestAnnouncement()
    local ok, raw = pcall(function()
        return game:HttpGet(InfinityConfig.ApiUrl .. "?_t=" .. tostring(tick()))
    end)
    if not ok or not raw or raw == "" or raw == "null" then return nil end
    local decodeOk, data = pcall(function()
        return HttpService:JSONDecode(raw)
    end)
    return (decodeOk and type(data) == "table") and data or nil
end

-- Background poll
task.spawn(function()
    while task.wait(InfinityConfig.PollInterval) do
        local announcement = FetchLatestAnnouncement()
        if announcement and announcement.active and announcement.id ~= lastSeenAnnouncementId then
            lastSeenAnnouncementId = announcement.id
            -- Show popup in Infinity Hub GUI!
            ShowAnnouncementNotification(announcement)
        end
    end
end)
```

### Key Client Features:
- **Deduplication:** Remembers `lastSeenAnnouncementId` so users are not repeatedly spammed by the same announcement.
- **Fail-Safe:** Wrapped in `pcall`. If the server is offline or unreachable, the hub will **never crash**; it simply waits for the next interval.
- **Target Filtering:** Automatically checks if announcements are meant for `everyone`, a specific module (`CurrentModule`), or a minimum hub version (`HubVersion`).

---

## 📁 Project Structure

```
infinity-admin/
├── .env                      # Local environment configuration (git-ignored)
├── .env.example              # Template configuration
├── .gitignore                # Ignores node_modules and secrets
├── package.json              # Express, Cors, Dotenv, Nodemon scripts
├── server.js                 # Main server entrypoint & router mounting
├── data/
│   └── announcements.json    # Persistent JSON storage
├── routes/
│   ├── announcements.js      # Announcement REST routes
│   └── auth.js               # Status and auth verification routes
├── utils/
│   └── storage.js            # Safe file storage & auto-increment ID generation
├── public/
│   ├── index.html            # Admin dashboard UI
│   ├── style.css             # Modern dark purple/blue stylesheet
│   └── app.js                # Frontend real-time preview & controller
├── client/
│   └── infinity_announcements.lua # Drop-in Lua integration module for Infinity Hub
└── README.md                 # Complete documentation & guide
```
