-- ==============================================================================
-- INFINITY HUB // LIVE ANNOUNCEMENTS CLIENT MODULE
-- ==============================================================================
-- Can be required, executed via loadfile, or run directly in your executor.
-- Polls the local/remote Infinity Hub announcement API and displays live popups.
-- ==============================================================================

local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local Players = game:GetService("Players")
local localPlayer = Players.LocalPlayer

local InfinityConfig = {
    -- Primary and fallback URLs
    ApiUrls = {
        "https://www.infinityhub.space/api/announcements/latest",
        "https://infinityhub.space/api/announcements/latest",
        "http://127.0.0.1:3000/api/announcements/latest",
        "http://localhost:3000/api/announcements/latest"
    },
    PollInterval = 10,
    HubVersion = "2.1.0",
    CurrentModule = "Ride A Pet",
    DebugMode = true
}


local lastSeenAnnouncementId = nil
local activePopup = nil

-- Universal executor request helper
local function FetchRaw(url)
    local reqFn = (syn and syn.request) or (http and http.request) or http_request or (fluxus and fluxus.request) or request
    
    -- 1. Try modern executor request API
    if reqFn then
        local ok, res = pcall(function()
            return reqFn({
                Url = url,
                Method = "GET",
                Headers = { ["Cache-Control"] = "no-cache" }
            })
        end)
        if ok and res then
            local body = res.Body or res.body
            if body and body ~= "" and body ~= "null" then
                return body
            end
        end
    end

    -- 2. Try game:HttpGet
    if game.HttpGet then
        local ok, body = pcall(function()
            return game:HttpGet(url)
        end)
        if ok and body and body ~= "" and body ~= "null" then
            return body
        end
    end

    -- 3. Try HttpService:GetAsync
    if HttpService and HttpService.GetAsync then
        local ok, body = pcall(function()
            return HttpService:GetAsync(url)
        end)
        if ok and body and body ~= "" and body ~= "null" then
            return body
        end
    end

    return nil
end

-- Fetch latest announcement trying fallback endpoints
local function FetchLatestAnnouncement()
    local timestamp = tostring(math.floor(tick() * 1000))
    for _, baseUrl in ipairs(InfinityConfig.ApiUrls) do
        local url = baseUrl .. "?_t=" .. timestamp
        local raw = FetchRaw(url)
        if raw then
            local decodeOk, data = pcall(function()
                return HttpService:JSONDecode(raw)
            end)
            if decodeOk and type(data) == "table" and data.id and data.active then
                return data
            end
        end
    end
    return nil
end

local function GetCurrentGameName()
    local pId = tostring(game.PlaceId)
    local uId = tostring(game.GameId)

    if pId == "124216119978534" or uId == "10035204815" then
        return "Ride A Pet"
    elseif pId == "131623223084840" or uId == "9363735110" then
        return "Escape Tsunami For Brainrots"
    end

    if _G.RideAPetGui or _G.RideAPetMainFrame then
        return "Ride A Pet"
    end
    if _G.EscapeTsunamiGui or _G.EscapeTsunamiMainFrame then
        return "Escape Tsunami For Brainrots"
    end

    return "Hub"
end

-- Target filtering
local function ShouldShowAnnouncement(announcement)
    if not announcement or not announcement.active then
        return false
    end

    local target = string.lower(announcement.target or "everyone")
    local targetMod = string.lower(announcement.targetModule or "")

    -- 1. All games / Everyone
    if target == "everyone" or targetMod == "" or targetMod == "all" or targetMod == "everyone" then
        return true
    end

    -- 2. Specific game selection
    local currentGame = string.lower(GetCurrentGameName())

    -- Ride A Pet
    if string.find(targetMod, "ride", 1, true) or string.find(targetMod, "pet", 1, true) then
        return string.find(currentGame, "ride", 1, true) or string.find(currentGame, "pet", 1, true)
    end

    -- Escape Tsunami
    if string.find(targetMod, "tsunami", 1, true) or string.find(targetMod, "escape", 1, true) or string.find(targetMod, "brainrot", 1, true) then
        return string.find(currentGame, "tsunami", 1, true) or string.find(currentGame, "brainrot", 1, true)
    end

    return string.find(currentGame, targetMod, 1, true) ~= nil
end


-- Display animated announcement card matching reference design
local function ShowAnnouncementNotification(announcement)
    local targetParent = _G.InfinityGui or shared.InfinityGui
    if not targetParent then
        pcall(function()
            targetParent = (gethui and gethui()) or game:GetService("CoreGui"):FindFirstChild("InfinityHubGui") or game:GetService("CoreGui")
        end)
    end

    if not targetParent and localPlayer and localPlayer:FindFirstChild("PlayerGui") then
        targetParent = localPlayer.PlayerGui:FindFirstChild("InfinityHubGui") or localPlayer.PlayerGui
    end

    if not targetParent then
        targetParent = game:GetService("CoreGui")
    end

    if activePopup and activePopup.Parent then
        activePopup:Destroy()
        activePopup = nil
    end

    -- Sleek Compact Card Container
    local card = Instance.new("Frame")
    card.Name = "InfinityHub_LiveAnnouncement"
    card.AnchorPoint = Vector2.new(0.5, 0)
    card.Size = UDim2.new(0, 410, 0, 64)
    card.Position = UDim2.new(0.5, 0, 0, -85)
    card.BackgroundColor3 = Color3.fromRGB(18, 19, 24)
    card.BorderSizePixel = 0
    card.ZIndex = 9999
    card.Parent = targetParent
    activePopup = card

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 10)
    corner.Parent = card

    local stroke = Instance.new("UIStroke")
    stroke.Thickness = 1
    stroke.Color = Color3.fromRGB(45, 48, 58)
    stroke.Parent = card

    -- Left White Rounded Square
    local logoHolder = Instance.new("Frame")
    logoHolder.Name = "LogoHolder"
    logoHolder.Size = UDim2.new(0, 38, 0, 38)
    logoHolder.Position = UDim2.new(0, 12, 0, 10)
    logoHolder.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
    logoHolder.BorderSizePixel = 0
    logoHolder.ZIndex = 10000
    logoHolder.Parent = card

    local holderCorner = Instance.new("UICorner")
    holderCorner.CornerRadius = UDim.new(0, 8)
    holderCorner.Parent = logoHolder

    -- Infinity Logo
    local infinityIcon = Instance.new("ImageLabel")
    infinityIcon.Name = "InfinityIcon"
    infinityIcon.Size = UDim2.new(0, 26, 0, 20)
    infinityIcon.Position = UDim2.new(0.5, 0, 0.5, 0)
    infinityIcon.AnchorPoint = Vector2.new(0.5, 0.5)
    infinityIcon.BackgroundTransparency = 1
    infinityIcon.BorderSizePixel = 0
    infinityIcon.Image = "rbxassetid://17894477503"
    infinityIcon.ImageColor3 = Color3.fromRGB(15, 17, 23)
    infinityIcon.ScaleType = Enum.ScaleType.Fit
    infinityIcon.ZIndex = 10001
    infinityIcon.Parent = logoHolder

    -- Dismiss Button 'X'
    local dismissBtn = Instance.new("TextButton")
    dismissBtn.Name = "DismissBtn"
    dismissBtn.Size = UDim2.new(0, 20, 0, 20)
    dismissBtn.Position = UDim2.new(1, -26, 0, 8)
    dismissBtn.BackgroundTransparency = 1
    dismissBtn.Text = "X"
    dismissBtn.TextColor3 = Color3.fromRGB(140, 145, 160)
    dismissBtn.Font = Enum.Font.GothamBold
    dismissBtn.TextSize = 12
    dismissBtn.ZIndex = 10002
    dismissBtn.Parent = card

    dismissBtn.MouseEnter:Connect(function()
        dismissBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    end)
    dismissBtn.MouseLeave:Connect(function()
        dismissBtn.TextColor3 = Color3.fromRGB(140, 145, 160)
    end)

    -- Dynamic Header based on announcement type (e.g., "Infinity Update", "Infinity Warning")
    local rawType = tostring(announcement.type or "Announcement")
    local formattedType = rawType:gsub("(%a)([%w_']*)", function(first, rest)
        return first:upper() .. rest:lower()
    end)
    if formattedType == "" then formattedType = "Announcement" end
    local headerText = "Infinity " .. formattedType

    -- Top Header
    local headerLbl = Instance.new("TextLabel")
    headerLbl.Name = "Header"
    headerLbl.Size = UDim2.new(1, -85, 0, 18)
    headerLbl.Position = UDim2.new(0, 58, 0, 10)
    headerLbl.BackgroundTransparency = 1
    headerLbl.Text = headerText
    headerLbl.TextColor3 = Color3.fromRGB(255, 255, 255)
    headerLbl.Font = Enum.Font.GothamBold
    headerLbl.TextSize = 13
    headerLbl.TextXAlignment = Enum.TextXAlignment.Left
    headerLbl.ZIndex = 10000
    headerLbl.Parent = card

    -- Message: Only the clean announcement message (no game name prefix)
    local msgText = tostring(announcement.message or "")


    local msgLbl = Instance.new("TextLabel")
    msgLbl.Name = "Message"
    msgLbl.Size = UDim2.new(1, -85, 0, 18)
    msgLbl.Position = UDim2.new(0, 58, 0, 28)
    msgLbl.BackgroundTransparency = 1
    msgLbl.Text = msgText
    msgLbl.TextColor3 = Color3.fromRGB(180, 185, 195)
    msgLbl.Font = Enum.Font.GothamMedium
    msgLbl.TextSize = 11
    msgLbl.TextTruncate = Enum.TextTruncate.AtEnd
    msgLbl.TextXAlignment = Enum.TextXAlignment.Left
    msgLbl.ZIndex = 10000
    msgLbl.Parent = card

    -- Progress Bar Track
    local progressTrack = Instance.new("Frame")
    progressTrack.Name = "ProgressTrack"
    progressTrack.Size = UDim2.new(1, -24, 0, 3)
    progressTrack.Position = UDim2.new(0, 12, 1, -7)
    progressTrack.BackgroundColor3 = Color3.fromRGB(38, 42, 54)
    progressTrack.BorderSizePixel = 0
    progressTrack.ZIndex = 10000
    progressTrack.Parent = card

    local trackCorner = Instance.new("UICorner")
    trackCorner.CornerRadius = UDim.new(0, 2)
    trackCorner.Parent = progressTrack

    -- Progress Fill
    local progressFill = Instance.new("Frame")
    progressFill.Name = "ProgressFill"
    progressFill.Size = UDim2.new(1, 0, 1, 0)
    progressFill.BackgroundColor3 = Color3.fromRGB(230, 235, 245)
    progressFill.BorderSizePixel = 0
    progressFill.ZIndex = 10001
    progressFill.Parent = progressTrack

    local fillCorner = Instance.new("UICorner")
    fillCorner.CornerRadius = UDim.new(0, 2)
    fillCorner.Parent = progressFill

    pcall(function()
        local clickSound = SoundService:FindFirstChild("Click")
        if clickSound then clickSound:Play() end
    end)

    TweenService:Create(card, TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
        Position = UDim2.new(0.5, 0, 0, 18)
    }):Play()

    local isDismissed = false
    local function Dismiss()
        if isDismissed then return end
        isDismissed = true
        local outTween = TweenService:Create(card, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
            Position = UDim2.new(0.5, 0, 0, -85)
        })
        outTween:Play()
        outTween.Completed:Connect(function()
            if card and card.Parent then card:Destroy() end
        end)
    end

    dismissBtn.MouseButton1Click:Connect(Dismiss)

    local duration = tonumber(announcement.duration)
    if duration == nil or duration > 0 then
        local durSecs = (duration and duration > 0) and duration or 10
        TweenService:Create(progressFill, TweenInfo.new(durSecs, Enum.EasingStyle.Linear), {
            Size = UDim2.new(0, 0, 1, 0)
        }):Play()
        task.delay(durSecs, Dismiss)
    end
end

-- Start background polling loop
task.spawn(function()
    if InfinityConfig.DebugMode then
        print("[Infinity Hub] 📡 Live Announcement System Active — polling " .. InfinityConfig.ApiUrls[1])
    end

    while true do
        pcall(function()
            local announcement = FetchLatestAnnouncement()
            if announcement and announcement.id and announcement.active then
                if announcement.id ~= lastSeenAnnouncementId then
                    if ShouldShowAnnouncement(announcement) then
                        lastSeenAnnouncementId = announcement.id
                        print(string.format("[Infinity Hub] 📢 Announcement #%d: '%s'", announcement.id, announcement.title))
                        ShowAnnouncementNotification(announcement)
                    else
                        lastSeenAnnouncementId = announcement.id
                    end
                end
            end
        end)
        task.wait(InfinityConfig.PollInterval or 5)
    end
end)

return {
    FetchLatestAnnouncement = FetchLatestAnnouncement,
    ShowAnnouncementNotification = ShowAnnouncementNotification
}
