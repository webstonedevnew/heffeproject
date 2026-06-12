/**
 * Sets (or resets) a user's password directly — handy when magic-link email
 * is unavailable. Usage:
 *
 *   npx tsx scripts/set-password.ts user@example.com [newpassword]
 *
 * If no password is given, a random one is generated and printed.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { randomBytes } from "node:crypto";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/set-password.ts <email> [password]");
    process.exit(1);
  }
  const password = process.argv[3] ?? "Tok-" + randomBytes(8).toString("hex");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws as unknown as typeof WebSocket },
    }
  );

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw listError;
  const user = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
  console.log(`Password set for ${email}`);
  console.log(`Password: ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
