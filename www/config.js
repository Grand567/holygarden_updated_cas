export const IS_PRODUCTION = false;
export const ENABLE_REALTIME = false;
export const PAGE_SIZE = 20;
export const SUPABASE_URL = "https://rfcrnvomvfgermqbtilp.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmY3Judm9tdmZnZXJtcWJ0aWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDcyMzksImV4cCI6MjA5MzAyMzIzOX0.Vk0kcrvhVxyyjAFNZWGF0SwgYcQKpfzaYJE4Ab4Xm2A";
export const ESEWA_CONFIG = IS_PRODUCTION ? {
  product_code: "YOUR_LIVE_MERCHANT_CODE",
  secret: "YOUR_LIVE_SECRET_KEY",
  url: "https://epay.esewa.com.np/api/epay/main/v2/form"
} : {
  product_code: "EPAYTEST",
  secret: "8g8M898m8668868",
  url: "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
};
export const GEMINI_API_KEY = ""; // Removed for GitHub Push Protection