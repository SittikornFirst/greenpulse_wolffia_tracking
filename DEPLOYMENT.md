# Wolffia IoT Tracking - Deployment Guide

This guide details how to correctly deploy your frontend to Netlify and your Node.js backend to Render.com. 

## Phase 1: Deploy the Node.js Backend to Render
Render is perfect for our backend because it keeps the server running so our WebSockets can broadcast live sensor updates instantly.

1. Create a free account on [Render.com](https://render.com/) and sign in with GitHub.
2. Click **New +** and select **Web Service**.
3. Select your GitHub repository (`woffia_iot_tracking`).
4. Apply the following settings:
   - **Name**: `greenpulse-backend` (or whatever you prefer)
   - **Root Directory**: `wolffia_backend` *(This is extremely important!)*
   - **Environment**: Node
   - **Build Command**: `npm install -g pnpm && pnpm install --no-frozen-lockfile`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Scroll down to **Environment Variables** and add your secrets exactly as they appear in your local `.env` file:
   - `PORT` : `3000`
   - `MONGODB_URI` : *(Your full MongoDB Atlas connection string)*
   - `JWT_SECRET` : `greenpulsesecretkey` *(or a stronger secret)*
   - `CORS_ORIGIN` : *(Your Netlify Frontend URL, e.g. `https://your-site.netlify.app`)*
6. Click **Create Web Service**. 
7. Wait 2-3 minutes for the build to finish. At the top of the dashboard, you will see your new backend URL (e.g., `https://greenpulse-backend.onrender.com`). **Copy this URL**.

---

## Phase 2: Link your Frontend (Netlify)
Since your frontend is already deployed on Netlify, we just need to tell it where to find your new backend.

1. Go to your Netlify dashboard and open your project.
2. Navigate to **Site configuration** -> **Environment variables**.
3. Create a new variable:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: Your Render URL + `/api` (Example: `https://greenpulse-backend.onrender.com/api`)
4. To apply this new variable, go to the **Deploys** tab.
5. Click the **Trigger deploy** dropdown and select **Clear cache and deploy site**.
6. Wait for the deploy to finish. Your frontend will now send all requests to your free Render server!

---

## Phase 3: Update your ESP32 Code
Now that the backend is permanently hosted, we need to instruct the ESP32 to send its payload directly to your Render URL.

1. Open `greenpulse_senior/esp32_asyncwebcontrol_8/esp32_asyncwebcontrol_8.ino`.
2. Find `BACKEND_API_URL` (located around line 25).
3. Update it to your Render Endpoint + `/api/sensor-data`:
   ```cpp
   constexpr char BACKEND_API_URL[] = "https://greenpulse-backend.onrender.com/api/sensor-data"; 
   ```
4. Compile and upload your Arduino code to the ESP32.

### You're done! 🎉
1. The ESP32 sends real-time data to Render via HTTP POST.
2. Render checks alerts and saves the data to MongoDB Atlas.
3. Render instantly pushed the new data via WebSockets to whoever has your Netlify dashboard open.
