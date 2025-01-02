import { SupabaseClient } from "@supabase/supabase-js";
import { sendTextMessage } from "@/utils/twilio";
import {
  getCurrentMessage,
  getSubmissionsForProcessing,
  shouldSendMessage,
  updateAfterSend,
} from "@/utils/submissions";

type MessageResult = {
  submission_id: string;
  status: "success" | "error";
  error?: string;
};

interface ProcessMessageResult {
  success: boolean;
  processed: number;
  results: MessageResult[];
  error?: string;
}

export async function processMessages(
  supabase: SupabaseClient,
  options: {
    submissionId?: string;
    skipTimeCheck?: boolean;
  } = {}
): Promise<ProcessMessageResult> {
  try {
    const currentTime = new Date();
    const results: MessageResult[] = [];

    // Get submissions to process
    const submissions = options.submissionId
      ? [
          await supabase
            .from("submissions")
            .select(
              `
              *,
              users!inner (
                phone,
                timezone
              )
            `
            )
            .eq("submission_id", options.submissionId)
            .single()
            .then((res) => res.data),
        ]
      : await getSubmissionsForProcessing(supabase);

    // Process each submission
    for (const submission of submissions) {
      try {
        if (
          !options.skipTimeCheck &&
          !shouldSendMessage(submission, currentTime)
        ) {
          continue;
        }

        const currentMessage = await getCurrentMessage(
          supabase,
          submission.message_to_send
        );

        await sendTextMessage(
          submission.users.phone,
          currentMessage.message_text
        );

        await updateAfterSend(
          supabase,
          submission,
          currentMessage,
          currentTime
        );

        results.push({
          submission_id: submission.submission_id,
          status: "success" as const,
        });
      } catch (error) {
        console.error(
          `Error processing submission ${submission.submission_id}:`,
          error
        );
        results.push({
          submission_id: submission.submission_id,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  } catch (error) {
    console.error("Message processing error:", error);
    return {
      success: false,
      processed: 0,
      results: [],
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}
