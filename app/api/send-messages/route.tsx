import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { processMessages } from "@/utils/messages";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const result = await processMessages(supabase);

  return Response.json(result, {
    status: result.success ? 200 : 500,
  });
}
