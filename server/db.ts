import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hhksfdwzeesmydgllubh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoa3NmZHd6ZWVzbXlkZ2xsdWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDcyNjEsImV4cCI6MjEwNDgyMzI2MX0.i5pVoJ-7T5HfQuqQRNdTn1PSnXiqci4Mf-zsd5WmE8c';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase URL or Key not configured in environment');
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}
