import { NextRequest } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { z } from "zod";
import { sendTextMessage } from "@/utils/twilio";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import pdfParse from "pdf-parse";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types"; // You'll need to generate this using Supabase CLI

// Type definitions
type SubmissionResult = {
  id: string;
  status: "success" | "error";
  error?: string;
};

type ProcessResult = {
  success: boolean;
  message?: string;
  processed?: SubmissionResult[];
  error?: string;
};

interface UserData {
  first_name: string | null;
  area_code: string;
  phone_number: string;
}

interface Submission {
  submission_id: string;
  user_id: string;
  text_field: string | null;
  uploaded_files: string[] | null;
  timezone: string;
  message_to_send: string | null;
  first_message_id: string | null;
}

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Zod schema for GPT response
const TextMessages = z.object({
  text_messages: z.array(z.string()),
}) satisfies z.ZodType<{ text_messages: string[] }>;

type TextMessagesType = z.infer<typeof TextMessages>;

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, " ")
    .replace(/\\n+/g, "\\n")
    .replace(/\[\s*\]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s+$/gm, "")
    .replace(/^\s+/gm, "")
    .replace(/\b(Reply|Comment)\b/g, "")
    .replace(/Loading\.\.\./g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const result = await processUnprocessedSubmissions(supabase);

  return Response.json(result, {
    status: result.success ? 200 : 500,
  });
}

async function processUnprocessedSubmissions(
  supabase: SupabaseClient<Database>
): Promise<ProcessResult> {
  try {
    const { data: submissions, error } = (await supabase
      .from("submissions")
      .select("*")
      .is("message_to_send", null)
      .limit(5)) as { data: Submission[] | null; error: any };

    if (error) throw error;

    if (!submissions || submissions.length === 0) {
      return { success: true, message: "No submissions to process" };
    }

    const results: SubmissionResult[] = [];
    for (const submission of submissions) {
      try {
        await processSubmission(supabase, submission);
        results.push({ id: submission.submission_id, status: "success" });
      } catch (error) {
        console.error(
          `Error processing submission ${submission.submission_id}:`,
          error
        );
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          id: submission.submission_id,
          status: "error",
          error: errorMessage,
        });

        // Notify user of error
        const { data: userData } = (await supabase
          .from("users")
          .select("first_name, area_code, phone_number")
          .eq("id", submission.user_id)
          .single()) as { data: UserData | null; error: any };

        if (userData?.phone_number) {
          const userName = userData.first_name || "there";
          await sendTextMessage(
            `+${userData.area_code}${userData.phone_number}`,
            `Hey ${userName}, there was an issue processing your recent submission on Cadence. Please try again or contact support if the issue persists.`
          );
        }
      }
    }

    return { success: true, processed: results };
  } catch (error) {
    console.error("Error in processUnprocessedSubmissions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function splitIntoChunks(text: string): Promise<string[]> {
  const gptModel = text.length > 120_000 ? "gpt-4o-mini" : "gpt-4o";

  const systemPrompt = `You are an expert at breaking down and explaining complex information...`; // Your existing prompt

  try {
    const maxCharsPerRequest = 20000;
    const textSegments: string[] = [];
    for (let i = 0; i < text.length; i += maxCharsPerRequest) {
      textSegments.push(text.slice(i, i + maxCharsPerRequest));
    }

    let allChunks: string[] = [];

    for (const segment of textSegments) {
      const completion = await openai.chat.completions.create({
        model: gptModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: segment },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" } as const,
      });

      const response = completion.choices[0].message;
      if (!response?.content) continue;

      try {
        const parsedResponse = JSON.parse(response.content) as TextMessagesType;
        const newChunks = parsedResponse.text_messages
          .map((chunk) => chunk.trim())
          .filter((chunk) => chunk.length > 0);
        allChunks = [...allChunks, ...newChunks];
      } catch (e) {
        console.error("Error parsing GPT response:", e);
      }
    }

    // Validate chunks
    allChunks = allChunks.filter(
      (chunk) =>
        chunk.length > 0 &&
        chunk.length <= 1000 &&
        chunk.split(/[.!?]+/).length >= 2 &&
        !chunk.slice(0, 10).toLowerCase().includes("i'm sorry")
    );

    if (allChunks.length === 0) {
      return text
        .split(/[.!?]+/)
        .reduce((acc: string[], sentence: string, i: number) => {
          if (i % 3 === 0) acc.push(sentence + ".");
          else if (acc.length > 0) acc[acc.length - 1] += " " + sentence + ".";
          return acc;
        }, [])
        .filter((chunk) => chunk.trim().length > 0);
    }

    return allChunks;
  } catch (error) {
    console.error("Error in GPT text chunking:", error);
    throw error;
  }
}

async function processSubmission(
  supabase: SupabaseClient<Database>,
  submission: Submission
): Promise<{ success: true }> {
  let allChunks: string[] = [];

  // Process files if any
  const files = submission.uploaded_files || [];
  if (files.length > 0) {
    for (const filename of files) {
      const filePath = `${submission.user_id}/${submission.submission_id}/${filename}`;

      const { data: signedUrlData } = await supabase.storage
        .from("attachments")
        .createSignedUrl(filePath, 60 * 60);

      if (!signedUrlData?.signedUrl) continue;

      const fileResponse = await fetch(signedUrlData.signedUrl);
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
      const pdfData = await pdfParse(fileBuffer);
      const cleanedText = cleanText(pdfData.text);
      const chunks = await splitIntoChunks(cleanedText);
      allChunks = [...allChunks, ...chunks];
    }
  }

  // Process text content if any
  if (submission.text_field) {
    let cleanedText = "";

    if (
      submission.text_field.includes("youtube.com") ||
      submission.text_field.includes("youtu.be")
    ) {
      const transcript = await YoutubeTranscript.fetchTranscript(
        submission.text_field
      );
      cleanedText = transcript.map((entry) => entry.text).join(" ");
    } else if (submission.text_field.startsWith("http")) {
      const response = await fetch(submission.text_field);
      const html = await response.text();
      const $ = cheerio.load(html);

      $(
        "script, style, nav, header, footer, .comments, #comments, img"
      ).remove();
      cleanedText = cleanText($("body").text());
    } else {
      cleanedText = cleanText(submission.text_field);
    }

    const chunks = await splitIntoChunks(cleanedText);
    allChunks = [...allChunks, ...chunks];
  }

  if (allChunks.length === 0) {
    throw new Error("No content was extracted from the provided source");
  }

  // Create messages
  const messageIds: string[] = [];
  for (const chunk of allChunks) {
    const message_id = randomUUID();
    messageIds.push(message_id);

    await supabase.from("messages").insert({
      message_id,
      submission_id: submission.submission_id,
      message_text: chunk,
      timezone: submission.timezone,
    });
  }

  // Link messages together
  for (let i = 0; i < messageIds.length; i++) {
    await supabase
      .from("messages")
      .update({
        next_message_to_send: messageIds[(i + 1) % messageIds.length],
      })
      .eq("message_id", messageIds[i]);
  }

  // Update submission with first message
  await supabase
    .from("submissions")
    .update({
      message_to_send: messageIds[0],
      first_message_id: messageIds[0],
    })
    .eq("submission_id", submission.submission_id);

  return { success: true };
}
