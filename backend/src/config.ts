import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  allowedOrigin: string;
  accessToken: string;
  
  // Model Gateway (Configured strictly via ENV)
  groqApiKey: string;
  groqModel: string;
  
  geminiApiKey: string;
  geminiModel: string;
  geminiLiveModel: string;
  
  openRouterApiKey: string;
  openRouterModel: string;
  
  // Daily Request Caps
  dailyCapGroq: number;
  dailyCapGemini: number;
  dailyCapOpenRouter: number;
  
  // Token Limits
  maxOutputTokens: number;
  
  // External Services
  tavilyApiKey: string;
  githubToken: string;
  
  // Upstash Redis REST
  upstashUrl: string;
  upstashToken: string;
  
  // Supabase
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  accessToken: process.env.ACCESS_TOKEN || '',
  
  // Models from env only
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
  
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku',
  
  // Daily caps
  dailyCapGroq: parseInt(process.env.DAILY_CAP_GROQ || '14400', 10),
  dailyCapGemini: parseInt(process.env.DAILY_CAP_GEMINI || '1500', 10),
  dailyCapOpenRouter: parseInt(process.env.DAILY_CAP_OPENROUTER || '500', 10),
  
  maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '400', 10),
  
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
};
