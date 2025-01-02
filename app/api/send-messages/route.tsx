import { NextRequest } from "next/server";
import {
  getCurrentMessage,
  getSubmissionsForProcessing,
  shouldSendMessage,
  updateAfterSend,
} from "@/utils/submissions";
import { createClient } from "@/utils/supabase/server";
import { sendTextMessage } from "@/utils/twilio";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = await createClient();
    const currentTime = new Date();
    const submissions = await getSubmissionsForProcessing(supabase);
    const results = [];

    // Process each submission
    for (const submission of submissions) {
      try {
        // Check if we should send a message
        if (!shouldSendMessage(submission, currentTime)) {
          continue;
        }

        // Get current message details
        const currentMessage = await getCurrentMessage(
          supabase,
          submission.message_to_send
        );

        // Send the message
        await sendTextMessage(
          submission.users.phone,
          currentMessage.message_text
        );

        // Update database after successful send
        await updateAfterSend(
          supabase,
          submission,
          currentMessage,
          currentTime
        );

        results.push({
          submission_id: submission.submission_id,
          status: "success",
        });
      } catch (error) {
        console.error(
          `Error processing submission ${submission.submission_id}:`,
          error
        );
        results.push({
          submission_id: submission.submission_id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}
