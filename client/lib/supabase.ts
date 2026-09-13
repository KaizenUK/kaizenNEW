import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseKey } from "./supabaseConfig";

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseKey);
  }

  return cachedClient;
};
