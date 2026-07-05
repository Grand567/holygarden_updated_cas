// TEMPLATE FOR CONFIGURATION
// Copy this file to www/config.js and fill in your credentials.
// This file is gitignored to protect your secrets.

export const IS_PRODUCTION = false;

// Supabase Credentials (from your Supabase Dashboard -> Settings -> API)
export const SUPABASE_URL = "https://your-project-id.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-key-here";

// eSewa Payment Config
export const ESEWA_CONFIG = IS_PRODUCTION ? {
    product_code: 'YOUR_LIVE_MERCHANT_CODE',
    secret: 'YOUR_LIVE_SECRET_KEY',
    url: 'https://epay.esewa.com.np/api/epay/main/v2/form'
} : {
    product_code: 'EPAYTEST',
    secret: '8g8M898m8668868',
    url: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
};

// Gemini API Key for AI Reports (Teacher Portal)
export const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
