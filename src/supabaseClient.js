import { createClient } from '@supabase/supabase-js'

// ตัด /rest/v1/ ออก ให้เหลือถึงแค่ .co
const supabaseUrl = 'https://lnwaqhapzgqlmiqvqxwe.supabase.co'

// ใส่ Publishable key ของคุณตรงนี้
const supabaseAnonKey = 'sb_publishable_sCQAyGatt5buqqYd58m9nQ_U65yJYQ1'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)