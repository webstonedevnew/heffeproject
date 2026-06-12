import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/**
 * Service-role client. Bypasses RLS — use only for: invites, account
 * provisioning, notification fan-out, reminders and GDPR erasure.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Node < 22 lacks native WebSocket; realtime is unused but eagerly
      // initialized, so provide the ws transport.
      realtime: { transport: ws as unknown as typeof WebSocket },
    }
  );
}
