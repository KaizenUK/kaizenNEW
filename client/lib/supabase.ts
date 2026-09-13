import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseKey } from "./supabaseConfig";
import { trackPasswordRecovery } from "./authRedirect";

let cachedClient: SupabaseClient | null = null;

export const createIsolatedSupabaseClient = () =>
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `kaizen-account-operation-${crypto.randomUUID()}`,
    },
  });

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseKey);
    trackPasswordRecovery(cachedClient.auth);
  }

  return cachedClient;
};
