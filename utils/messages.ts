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
    isFirstMessage?: boolean;
  } = {}
): Promise<ProcessMessageResult> {
  try {
    const currentTime = new Date();
    const results: MessageResult[] = [];

    // Get submissions to process
    let submissions;
    console.log("options: ", options);
    if (options.submissionId) {
      // If specific submission ID is provided
      const { data, error } = await supabase
        .from("submissions")
        .select(
          `
              *,
              users!inner (
                area_code,
                phone_number,
                timezone
              )
            `
        )
        .eq("submission_id", options.submissionId)
        .single();

      if (error) {
        console.error("Error fetching specific submission:", error);
        throw error;
      }

      if (!data) {
        throw new Error(`Submission not found: ${options.submissionId}`);
      }

      submissions = [data];
    } else {
      // Get all submissions
      const { data, error } = await supabase.from("submissions").select(`
              *,
              users!inner (
                area_code,
                phone_number,
                timezone
              )
            `);

      console.log("error: ", error);
      console.log("raw data: ", data);

      if (error) throw error;
      submissions = data || [];
      console.log("all submissions: ", submissions);
    }

    console.log(
      "Processing submissions:",
      submissions.map((s) => s?.submission_id)
    );

    // Process each submission
    for (const submission of submissions) {
      if (!submission) {
        console.warn("Skipping null submission");
        continue;
      }

      try {
        // Skip time check if this is an immediate send
        if (
          !options.skipTimeCheck &&
          !shouldSendMessage(submission, currentTime)
        ) {
          continue;
        }

        // Get current message details
        const currentMessage = await getCurrentMessage(
          supabase,
          submission.message_to_send
        );

        if (!currentMessage) {
          throw new Error(`Message not found: ${submission.message_to_send}`);
        }

        // Send the message
        const fullPhone =
          `+${submission.users.area_code}${submission.users.phone_number}`.replace(
            /\s+/g,
            ""
          );
        await sendTextMessage(fullPhone, currentMessage.message_text);

        // For first message, skip updating last_sent_time but still update message_to_send
        await updateAfterSend(
          supabase,
          submission,
          currentMessage,
          currentTime,
          options.isFirstMessage
        );

        results.push({
          submission_id: submission.submission_id,
          status: "success" as const,
        });
      } catch (error) {
        console.error(
          `Error processing submission ${submission?.submission_id}:`,
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
