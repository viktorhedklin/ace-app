import { createClient } from "@base44/sdk";

// Base44 client — auto-configured when running inside Base44's platform.
// Running locally: set VITE_BASE44_APP_ID in your .env file.
// Find your App ID in the Base44 editor URL: app.base44.com/apps/<appId>
export const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID,
});
