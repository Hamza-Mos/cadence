"use server";

import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import { createClient } from "@/utils/supabase/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_FREE_SUBMISSIONS = 7;

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

const splitIntoChunks = async (text: string): Promise<string[]> => {
  const systemPrompt = `You are an expert at breaking down complex information into simple, engaging text messages. Your task is to:
    1. Break down the given text into bite-sized chunks of 4-5 sentences each
    2. Make each chunk focus on a single concept, topic, idea, or quote.
    3. Write in a text-message friendly style while keeping the information accurate.
    4. Ensure each chunk is self-contained and easily understood,
    5. Use simple language and explanatory analogies where helpful.
    6. Keep each chunk under 1000 characters.
    7. Remove any unnecessary information or redundant content - this includes information about the author, any small talk, introductory content etc. that doesn't have meaningful informational value.
    8. Make the information memorable and easy to understand.
    9. If the text is instructional, break it into clear, actionable steps.
    10. Ignore any content related to appendix or index. Only generate messages on the main content of the material.
  
  Output format should be a series of chunks separated by "|||". Each chunk should be a self-contained message. Do not include a message that introduces the topic, remember each message should have some informational value.
  
  For example, if given a technical article about photosynthesis, good chunks would be:
  "🌱 Here's something cool: plants are basically solar-powered! They take sunlight and turn it into food using their leaves. The green color you see is from chlorophyll, which is like tiny solar panels inside the leaves." ||| "💧 Water plays a huge role in photosynthesis! Plants drink it up from their roots and combine it with CO2 from the air. This chemical reaction helps create glucose - basically plant food!"`;

  try {
    // Split text into smaller segments if it's too long
    const maxCharsPerRequest = 4000; // Safe limit for context window
    const textSegments = [];
    for (let i = 0; i < text.length; i += maxCharsPerRequest) {
      textSegments.push(text.slice(i, i + maxCharsPerRequest));
    }

    let allChunks: string[] = [];

    // Process each segment
    for (const segment of textSegments) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Please break this text into engaging, informative chunks that feel like text messages: ${segment}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        console.warn("No response from GPT for segment");
        continue;
      }

      // Split response into chunks and add to collection
      const newChunks = response
        .split("|||")
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
        chunk.slice(0, 10).toLowerCase().includes("i'm sorry")
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
};

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
    return splitIntoChunks(cleanedText);
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
    console.log("Cleaned text:", cleanedText);
    return splitIntoChunks(cleanedText);
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

    // Check if user can submit
    const canSubmit = await checkUserCanSubmit(supabase, user.id);

    if (!canSubmit) {
      throw new Error(
        `Submission limit ${MAX_FREE_SUBMISSIONS} reached. Subscribe to Pro ✨`
      );
    }

    // Generate a submission ID
    const submission_id = randomUUID();

    // Upload PDF if provided
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

    // Create submission record
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        submission_id: submission_id,
        user_id: user.id,
        text_field: url?.trim() || raw_text || null,
        uploaded_files: files.map((file) => file.name),
        cadence,
        repeat,
      })
      .select()
      .single();

    if (submissionError) throw submissionError;

    // Process URL if provided
    if (url?.trim()) {
      const urlChunks = await scrapeUrl(url);
      allChunks = [...allChunks, ...urlChunks];
    }

    if (raw_text) {
      const textChunks = await splitIntoChunks(cleanText(raw_text));
      allChunks = [...allChunks, ...textChunks];
    }

    // Insert all chunks into database
    if (allChunks.length > 0) {
      const { error: cadenceError } = await supabase.from("cadences").insert(
        allChunks.map((chunk) => ({
          submission_id: submission.submission_id,
          message_text: chunk,
        }))
      );
      if (cadenceError) throw cadenceError;
    }

    return {
      success: true,
      submission_id: submission.submission_id,
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
