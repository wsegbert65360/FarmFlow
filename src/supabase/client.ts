import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://skkbmmxjclpbbijcrgyi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CTRPsiYo2fZ5wiA9yUG6kA_krlOpMSi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web', // Only valid on web
    },
});
