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
import { YoutubeTranscript } from "youtube-transcript";
import { sendTextMessage } from "@/utils/twilio";

const openai = wrapOpenAI(
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

const MAX_FREE_SUBMISSIONS = 5;

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

function getCurrentTime(timezone: string): Date {
  // Get current date in user's timezone
  const now = new Date();
  const userNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));

  // Calculate minimum time based on cadence
  return new Date(userNow);
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
  const gptModel = text.length > 120_000 ? "gpt-4o-mini" : "gpt-4o";
  console.log(`Using model: ${gptModel} to split text into chunks`);

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
        model: gptModel,
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

function isValidYouTubeUrl(url: string): boolean {
  // Extract video ID from URL
  const videoId = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  )?.[1];

  if (!videoId) {
    return false;
  }

  return true;
}

function getTranscriptText(transcript: any[]) {
  return transcript
    .map((entry) => entry.text)
    .join(" ")
    .replace(/&amp;#39;/g, "'")
    .replace(/\n/g, " ")
    .trim();
}

async function isPublicUrl(url: string) {
  try {
    // A HEAD request is often enough to see if it's public (2xx).
    // Alternatively, you can do a GET request if you need to inspect HTML content.
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      // e.g. 403, 401, 404 => treat as restricted or nonexistent
      console.log(`Non-200 status: ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Public URL check failed:", error);
    return false;
  }
}

export async function scrapeUrl(url: string) {
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
    if (content) {
      mainContent += "\n" + content;
    }
  }

  // If no main content found, throw an error and ask user to copy-paste the text instead
  if (!mainContent) {
    throw new Error(
      "Sorry, we were unable to find the content in the provided URL. Please try copy-pasting the content text instead."
    );
  }

  const cleanedText = cleanText(mainContent);
  return cleanedText;
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

    return cleanedText;
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

export async function handleSaveChunks(
  allChunkPromises: Promise<string[]>[],
  submission_id: string,
  cadence: string,
  repeat: string,
  userData: any,
  supabase: SupabaseClient<any, "public", any>,
  user: any,
  files: File[],
  url?: string,
  youtube_url?: string,
  raw_text?: string
) {
  const startTime = Date.now();
  let stepStartTime = startTime;

  try {
    // Process chunks
    console.log("Starting chunk processing...");
    let allChunks: string[] = [];
    for (const chunkPromise of allChunkPromises) {
      const chunk = await chunkPromise;
      allChunks = [...allChunks, ...chunk];
    }
    console.log(
      `Chunk processing completed in ${Date.now() - stepStartTime}ms`
    );

    if (allChunks.length === 0) {
      throw new Error("No content was extracted from the provided source");
    }

    // Generate start time
    stepStartTime = Date.now();
    console.log("Generating start time...");
    const startDateTime = generateStartTime(
      submission_id,
      userData.timezone,
      cadence
    );
    console.log(
      `Start time generation completed in ${Date.now() - stepStartTime}ms`
    );

    // Create submission record
    stepStartTime = Date.now();
    console.log("Creating submission record...");
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        submission_id: submission_id,
        user_id: user.id,
        text_field: youtube_url?.trim() || url?.trim() || raw_text || null,
        uploaded_files: files.map((file) => file.name),
        cadence,
        repeat,
        start_time: startDateTime.toISOString(),
        timezone: userData.timezone,
        last_sent_time: null,
      })
      .select()
      .single();

    if (submissionError) throw submissionError;
    console.log(
      `Submission record creation completed in ${Date.now() - stepStartTime}ms`
    );

    // Create messages
    stepStartTime = Date.now();
    console.log("Creating messages...");
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
    console.log(
      `Message creation completed in ${Date.now() - stepStartTime}ms`
    );

    // Update next_message_to_send
    stepStartTime = Date.now();
    console.log("Updating message links...");
    for (let i = 0; i < messageIds.length; i++) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          next_message_to_send: messageIds[(i + 1) % messageIds.length],
        })
        .eq("message_id", messageIds[i]);

      if (updateError) throw updateError;
    }
    console.log(
      `Message link updates completed in ${Date.now() - stepStartTime}ms`
    );

    // Update submission
    stepStartTime = Date.now();
    console.log("Updating submission with first message...");
    const { error: updateSubmissionError } = await supabase
      .from("submissions")
      .update({
        message_to_send: messageIds[0],
        first_message_id: messageIds[0],
      })
      .eq("submission_id", submission_id);

    if (updateSubmissionError) throw updateSubmissionError;
    console.log(
      `Submission update completed in ${Date.now() - stepStartTime}ms`
    );

    // Process messages
    stepStartTime = Date.now();
    console.log("Processing messages...");
    await processMessages(supabase, {
      submissionId: submission_id,
      skipTimeCheck: true,
      isFirstMessage: true,
    });
    console.log(
      `Message processing completed in ${Date.now() - stepStartTime}ms`
    );

    const totalDuration = Date.now() - startTime;
    console.log(`Total function execution completed in ${totalDuration}ms`);

    return {
      success: true,
      submission_id: submission_id,
      chunks_count: allChunks.length,
      duration_ms: totalDuration,
    };
  } catch (error) {
    const errorTime = Date.now();
    console.error(`Error occurred after ${errorTime - startTime}ms:`, error);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get the user's name and phone number from Supabase or somewhere in your user profile.
    // For example, maybe you have these columns:
    const { data: userProfile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    const userName = userProfile?.first_name || "there";
    const userPhone = `+${userProfile?.area_code}${userProfile?.phone_number}`;

    // If userPhone is defined, send them a text explaining what happened
    if (userPhone) {
      const errorMsg =
        typeof error === "object" && error !== null
          ? (error as Error).message
          : String(error);

      await sendTextMessage(
        userPhone,
        `Hey ${userName}, there was an issue with your recent submission on Cadence.`
      );
    }

    throw error;
  }
}

export async function handleSubmission(formData: FormData): Promise<{ success: boolean, error?: string, submission_id?: string }> {
  const supabase = await createClient();
  const url = formData.get("url") as string | undefined;
  const youtube_url = formData.get("youtube_url") as string | undefined;
  const raw_text = formData.get("raw_text") as string | undefined;
  const files = formData.getAll("files") as File[];
  const cadence = formData.get("cadence") as string;
  const repeat = formData.get("repeat") as string;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const canSubmit = await checkUserCanSubmit(supabase, user.id);
    if (!canSubmit) {
      return { success: false, error: "You've hit the submission limit. Get Pro ✨ for unlimited submissions." };
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

    // Handle file uploads if any
    if (files.length > 0) {
      const folderPath = `${user.id}/${submission_id}`;

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = `${folderPath}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, buffer, {
            contentType: file.type,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;
      }
    }

    // if url, try scraping it to throw error if it fails
    if (url?.trim()) {
      try {
        await scrapeUrl(url);
      } catch (error: any) {
        return { success: false, error: "There was an issue processing the URL. Please try copy-pasting the content text instead." };
      }
    }

    // if youtube_url, check if it's a valid YouTube URL
    if (youtube_url?.trim()) {
      const isValid = isValidYouTubeUrl(youtube_url);
      if (!isValid) {
        return { success: false, error: "Invalid YouTube URL. Make sure the pasted URL is correct." };
      }
    }

    // Create initial submission record
    // Note: message_to_send is null by default, which indicates it needs processing
    const { error: submissionError } = await supabase
      .from("submissions")
      .insert({
        submission_id,
        user_id: user.id,
        text_field: youtube_url?.trim() || url?.trim() || raw_text || null,
        uploaded_files: files.map((file) => file.name),
        cadence,
        repeat,
        timezone: userData.timezone,
        message_to_send: null,
        first_message_id: null,
        start_time: getCurrentTime(userData.timezone),
      });

    if (submissionError) throw submissionError;

    return { success: true, submission_id };
  } catch (error) {
    console.error("Error in submission:", error);
    throw error;
  }
}
