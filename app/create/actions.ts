"use server";

import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import { createClient } from "@/utils/supabase/server";

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

// Utility function to clean text
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

// Utility function to split text into chunks
const splitIntoChunks = (text: string, maxLength: number = 500): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

// Function to scrape URL
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
    $('[class*="menu"]').remove();
    $('[id*="menu"]').remove();
    $('[class*="footer"]').remove();
    $('[id*="footer"]').remove();

    // Get main content
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
    console.log("cleaned text: ", cleanedText);
    return splitIntoChunks(cleanedText);
  } catch (error) {
    console.error("Error scraping URL:", error);
    throw new Error("Failed to scrape URL");
  }
}

// Function to parse PDF
export async function parsePdf(file: Buffer) {
  try {
    const data = await pdfParse(file, {
      pagerender: function (pageData) {
        return pageData.getTextContent().then((content: { items: any[] }) => {
          const text = content.items.map((item) => item.str).join(" ");
          console.log("Text content for a page:", text);
          return text;
        });
      },
      max: 0, // No limit on pages
    });

    const cleanedText = cleanText(data.text);
    console.log("cleaned text: ", cleanedText);
    return splitIntoChunks(cleanedText);
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF");
  }
}

// Main submission handler
export async function handleSubmission(formData: FormData) {
  const supabase = await createClient();
  const url = formData.get("text") as string | null;
  const files = formData.getAll("files") as File[];
  const cadence = formData.get("cadence") as string;
  const repeat = formData.get("repeat") as string;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Create submission record
    // const { data: submission, error: submissionError } = await supabase
    //   .from("submissions")
    //   .insert({
    //     user_id: user.id,
    //     url: url || null,
    //     cadence,
    //     repeatable: repeat === "repeat-forever",
    //   })
    //   .select()
    //   .single();

    // if (submissionError) throw submissionError;

    let allChunks: string[] = [];

    // Process URL if provided
    if (url?.trim()) {
      const urlChunks = await scrapeUrl(url);
      allChunks = [...allChunks, ...urlChunks];
    }

    // Process PDF files if provided
    if (files.length > 0) {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfChunks = await parsePdf(buffer);
        allChunks = [...allChunks, ...pdfChunks];
      }
    }

    // Insert all chunks into database
    if (allChunks.length > 0) {
      //   const { error: cadenceError } = await supabase.from("cadences").insert(
      //     allChunks.map((chunk) => ({
      //       submission_id: submission.submission_id,
      //       message_text: chunk,
      //     }))
      //   );
      //   if (cadenceError) throw cadenceError;
    }
    // console.log("chunks: ", allChunks);

    return {
      success: true,
      submission_id: "submission_id",
      chunks_count: allChunks.length,
    };
  } catch (error) {
    console.error("Error in handleSubmission:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to process submission");
  }
}
