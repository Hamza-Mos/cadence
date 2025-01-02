"use server";

import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import { createClient } from "@/utils/supabase/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { zodResponseFormat } from "openai/helpers/zod";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import { z } from "zod";
import { processMessages } from "@/utils/messages";

const openai = wrapOpenAI(
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

const MAX_FREE_SUBMISSIONS = 7;

const TextMessages = z.object({
  text_messages: z.array(z.string()),
});

type CadenceMap = {
  [key: string]: number;
};

const CADENCE_HOURS: CadenceMap = {
  "receive-daily": 24,
  "receive-12": 12,
  "receive-6": 6,
  "receive-4": 4,
  "receive-1": 1,
};

/**
 * Generates a start time for message delivery based on submission ID.
 * Start time will be:
 * - Between 8 AM - 8 PM in user's timezone (waking hours)
 * - After minimum cadence period from current time
 * - Today or tomorrow only
 * - Deterministically random (same ID = same time) to help avoid collisions
 *
 * @param submissionId - UUID of the submission
 * @param timezone - User's timezone string (e.g. "America/New_York")
 * @param cadence - Frequency of messages (e.g. "receive-4" for 4 hours)
 * @returns Date object with calculated start time
 */
function generateStartTime(
  submissionId: string,
  timezone: string,
  cadence: string
): Date {
  // Create a hash of the submission ID
  const hash = crypto.createHash("sha256").update(submissionId).digest();
  const randomValue = hash.readUInt32BE(0) / 0xffffffff; // number between 0 and 1

  // Get current date in user's timezone
  const now = new Date();
  const userNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));

  // Get cadence hours
  const cadenceHours = CADENCE_HOURS[cadence] || 24;

  // Calculate minimum time based on cadence
  const minTime = new Date(userNow);
  minTime.setHours(minTime.getHours() + cadenceHours);

  // If minimum time is today but before 8 AM, set to 8 AM
  if (minTime.getHours() < 8) {
    minTime.setHours(8, 0, 0, 0);
  }

  // If minimum time is after 8 PM today, set to 8 AM tomorrow
  if (minTime.getHours() >= 20) {
    minTime.setDate(minTime.getDate() + 1);
    minTime.setHours(8, 0, 0, 0);
  }

  // Calculate available minutes in the valid window
  const startHour = minTime.getHours();
  const endHour = 20; // 8 PM
  const availableMinutes = (endHour - startHour) * 60;

  const minuteOffset = Math.floor(randomValue * availableMinutes);

  const finalTime = new Date(minTime);
  finalTime.setMinutes(finalTime.getMinutes() + minuteOffset);

  return finalTime;
}

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\\n+/g, "\\n") // Replace multiple newlines with single newline
    .replace(/\[\s*\]/g, "") // Remove empty brackets
    .replace(/\(\s*\)/g, "") // Remove empty parentheses
    .replace(/\s+([.,!?])/g, "$1") // Remove spaces before punctuation
    .replace(/\s+$/gm, "") // Remove trailing spaces
    .replace(/^\s+/gm, "") // Remove leading spaces
    .replace(/\b(Reply|Comment)\b/g, "") // Remove common blog artifacts
    .replace(/Loading\.\.\./g, "")
    .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
    .replace(/&[a-z]+;/gi, "") // Remove HTML entities
    .replace(/\s{2,}/g, " ") // Replace multiple spaces with single space
    .trim();
};
const splitIntoChunks = traceable(async (text: string): Promise<string[]> => {
  const systemPrompt = `You are an expert at breaking down and explaining complex information. Break down the content given by a user seeking to understand the content into engaing text messages that will be delivered back to the user in timely intervals. Some rules to follow are:
      1. Each text message must be around 4-5 sentences under 1000 characters total.
      2. Make each text message focus on a single concept, topic, idea, or quote from the content.
      3. Write in a text message style while keeping the information accurate.
      4. Ensure each text message is self-contained and easily understood.
      5. Use simple language and explanatory analogies where helpful.
      6. Exclude any unnecessary information that may be present in the content. This includes information about the author, references, any small talk, introductory content etc. that doesn't have meaningful informational value to the reader.
      7. Make the information memorable and easy to understand.
      8. If the body of text is instructional, break it into clear, actionable steps.
      9. Ignore any content related to appendix or index. Only generate messages on the main content of the material.
      10. DO NOT EXCEED more than 5 messages in total.
    
    Output format should be a series of text messages. Do not include a message that only introduces the topic, remember each text message should have some informational value.
  
    Informational value can be determined based on the content. If its a blogpost or interview, capture the main essence, teachings and quotes. If its an academic paper, capture the main technique and results. If its a news article, capture the main events. and so on.
    
    For example, if given a technical article about photosynthesis, good text messages would be:
     - "🌱 Here's something cool: plants are basically solar-powered! They take sunlight and turn it into food using their leaves. The green color you see is from chlorophyll, which is like tiny solar panels inside the leaves."
     - "💧 Water plays a huge role in photosynthesis! Plants drink it up from their roots and combine it with CO2 from the air. This chemical reaction helps create glucose - basically plant food!"
    `;

  try {
    // Split text into smaller segments if it's too long
    const maxCharsPerRequest = 20000; // Safe limit for context window
    const textSegments = [];
    for (let i = 0; i < text.length; i += maxCharsPerRequest) {
      textSegments.push(text.slice(i, i + maxCharsPerRequest));
    }

    let allChunks: string[] = [];

    // Process each segment
    for (const segment of textSegments) {
      const completion = await openai.beta.chat.completions.parse({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `${segment}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: zodResponseFormat(TextMessages, "messages"),
      });

      const response = completion.choices[0].message.parsed;

      if (!response) {
        console.warn("No response from GPT for segment");
        continue;
      }

      // Split response into chunks and add to collection
      const newChunks = response.text_messages
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0);
      allChunks = [...allChunks, ...newChunks];
    }

    // Validate chunks
    allChunks = allChunks.filter((chunk) => {
      // Ensure each chunk is within size limits and has actual content
      return (
        chunk.length > 0 &&
        chunk.length <= 1000 && // Match database constraint
        chunk.split(/[.!?]+/).length >= 2 &&
        !chunk.slice(0, 10).toLowerCase().includes("i'm sorry")
      ); // At least 2 sentences
    });

    if (allChunks.length === 0) {
      // Fallback to simple chunking if GPT fails
      console.warn("GPT chunking failed, falling back to simple chunking");
      return text
        .split(/[.!?]+/)
        .reduce((acc: string[], sentence: string, i: number) => {
          if (i % 3 === 0) acc.push(sentence + ".");
          else if (acc.length > 0) acc[acc.length - 1] += " " + sentence + ".";
          return acc;
        }, [])
        .filter((chunk) => chunk.trim().length > 0);
    }

    console.log("All chunks:", allChunks);

    return allChunks;
  } catch (error) {
    console.error("Error in GPT text chunking:", error);
    // Fallback to simple chunking
    return text
      .split(/[.!?]+/)
      .reduce((acc: string[], sentence: string, i: number) => {
        if (i % 3 === 0) acc.push(sentence + ".");
        else if (acc.length > 0) acc[acc.length - 1] += " " + sentence + ".";
        return acc;
      }, [])
      .filter((chunk) => chunk.trim().length > 0);
  }
});

export async function scrapeUrl(url: string) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script").remove();
    $("style").remove();
    $("comment").remove();
    $("iframe").remove();
    $("nav").remove();
    $("header").remove();
    $("footer").remove();
    $(".comments").remove();
    $("#comments").remove();
    $("img").remove();
    $('[class*="advertisement"]').remove();
    $('[id*="advertisement"]').remove();
    $('[class*="sidebar"]').remove();
    $('[id*="sidebar"]').remove();
    $('[class*="footer"]').remove();
    $('[id*="footer"]').remove();

    // Some common selectors for articles
    const contentSelectors = [
      "article",
      "main",
      ".main-content",
      "#main-content",
      ".post-content",
      ".article-content",
      ".entry-content",
      ".content",
      '[role="main"]',
      "#content",
      "#mw-content-text",
    ];

    let mainContent = "";
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.length > mainContent.length) {
        mainContent = content;
      }
    }

    // If no main content found, get body text
    if (!mainContent) {
      mainContent = $("body").text();
    }

    const cleanedText = cleanText(mainContent);
    const chunks = await splitIntoChunks(cleanedText);
    return chunks;
  } catch (error) {
    console.error("Error scraping URL:", error);
    throw new Error("Failed to scrape URL");
  }
}

async function checkUserCanSubmit(
  supabase: SupabaseClient<any, "public", any>,
  user_id: string
) {
  // validate if the user is allowed to submit
  const { data: user_data, error: userError } = await supabase
    .from("users")
    .select("is_subscribed")
    .eq("id", user_id)
    .single();

  if (userError) throw userError;

  // get number of submissions from user
  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", user_id);

  if (submissionError) throw submissionError;

  if (
    user_data.is_subscribed === false &&
    submissions.length >= MAX_FREE_SUBMISSIONS
  ) {
    console.log("User has reached submission limit");
    return false;
  }

  return true;
}

export async function parsePdf(file: Buffer) {
  try {
    const data = await pdfParse(file, {
      // Remove custom pagerender function to use default text extraction
      max: 0, // No limit on pages
    });

    const cleanedText = cleanText(data.text);
    const chunks = await splitIntoChunks(cleanedText);
    return chunks;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF");
  }
}

export async function getUser() {
  try {
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    return user.data.user;
  } catch (error) {
    console.error("Error getting user:", error);
    throw new Error("Failed to get user details");
  }
}

export async function handleSubmission(formData: FormData) {
  const supabase = await createClient();
  const url = formData.get("url") as string | null;
  const raw_text = formData.get("raw_text") as string | null;
  const files = formData.getAll("files") as File[];
  const cadence = formData.get("cadence") as string;
  const repeat = formData.get("repeat") as string;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    let allChunks: string[] = [];

    const canSubmit = await checkUserCanSubmit(supabase, user.id);
    if (!canSubmit) {
      throw new Error(
        `Submission limit ${MAX_FREE_SUBMISSIONS} reached. Subscribe to Pro ✨`
      );
    }

    // Get user's timezone
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("timezone")
      .eq("id", user.id)
      .single();

    if (userError) throw userError;

    // Generate a submission ID
    const submission_id = randomUUID();

    // Handle file uploads
    if (files.length > 0) {
      const folderPath = `${user.id}/${submission_id}`;

      // Upload each file and get signed URLs
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = `${folderPath}/${file.name}`;

        // Upload the file
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, buffer, {
            contentType: file.type,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        // Get a signed URL for the uploaded file
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("attachments")
            .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

        if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError;

        // Use the signed URL to access the file
        const fileResponse = await fetch(signedUrlData.signedUrl);
        const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
        const pdfChunks = await parsePdf(fileBuffer);
        allChunks = [...allChunks, ...pdfChunks];
      }
    }

    // Process URL if provided
    if (url?.trim()) {
      const urlChunks = await scrapeUrl(url);
      allChunks = [...allChunks, ...urlChunks];
    }

    // Process raw text if provided
    if (raw_text) {
      const textChunks = await splitIntoChunks(cleanText(raw_text));
      allChunks = [...allChunks, ...textChunks];
    }

    if (allChunks.length === 0) {
      throw new Error("No content was extracted from the provided source");
    }

    // Generate start time based on submission ID
    const startTime = generateStartTime(
      submission_id,
      userData.timezone,
      cadence
    );

    // First create the submission record
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        submission_id: submission_id,
        user_id: user.id,
        text_field: url?.trim() || raw_text || null,
        uploaded_files: files.map((file) => file.name),
        cadence,
        repeat,
        start_time: startTime.toISOString(),
        timezone: userData.timezone,
        last_sent_time: null,
      })
      .select()
      .single();

    if (submissionError) throw submissionError;

    // Then create all messages
    const messageIds: string[] = [];

    for (const chunk of allChunks) {
      const message_id = randomUUID();
      messageIds.push(message_id);

      const { error: messageError } = await supabase.from("messages").insert({
        message_id: message_id,
        submission_id: submission_id,
        message_text: chunk,
        timezone: userData.timezone,
      });

      if (messageError) throw messageError;
    }

    // Update next_message_to_send for each message
    for (let i = 0; i < messageIds.length; i++) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          next_message_to_send: messageIds[(i + 1) % messageIds.length], // Circular reference for last message
        })
        .eq("message_id", messageIds[i]);

      if (updateError) throw updateError;
    }

    // Finally, update the submission with the first message to send
    const { error: updateSubmissionError } = await supabase
      .from("submissions")
      .update({
        message_to_send: messageIds[0],
        first_message_id: messageIds[0],
      })
      .eq("submission_id", submission_id);

    if (updateSubmissionError) throw updateSubmissionError;

    await processMessages(supabase, {
      submissionId: submission_id,
      skipTimeCheck: true, // Skip time-based checks for immediate send
      isFirstMessage: true,
    });

    return {
      success: true,
      submission_id: submission_id,
      chunks_count: allChunks.length,
    };
  } catch (error) {
    console.error("Error in handleSubmission:", error);
    throw error instanceof Error
      ? error
      : new Error(
          "Failed to process submission, please try again in a few minutes."
        );
  }
}
