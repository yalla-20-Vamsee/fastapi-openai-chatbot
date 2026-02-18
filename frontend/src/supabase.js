import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://zvqhwrhcqakorvpiqujg.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2cWh3cmhjcWFrb3J2cGlxdWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQ1NDksImV4cCI6MjA4NzAxMDU0OX0.e4bKZrwfU444QvUUnQP5DnLpFfTHxBWgRh_6SMmUMwI"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
