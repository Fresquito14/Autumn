import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://ucgvpnecaksytqjhhugr.supabase.co'

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZ3ZwbmVjYWtzeXRxamhodWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTI5MTQsImV4cCI6MjEwMTM2ODkxNH0.mZIfL5IZetawz8PhqD0uHzABaSIjOmG56V59TvWDPAc'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
