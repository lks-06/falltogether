// =============================================
// SUPABASE KONFIGURATION
// Trage hier deine Supabase-Daten ein!
//
// So findest du die Werte:
// 1. Gehe zu https://supabase.com → dein Projekt
// 2. Project Settings → API
// 3. Kopiere "Project URL" und "anon public" Key
// =============================================

const SUPABASE_URL = 'https://bcrmfbhkpomyfncpioad.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i16FyOvNdDg_B7RHK4joEQ_DgLK_GwD';

// Supabase Client erstellen
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
