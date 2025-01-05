"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DropZoneUI from "@/components/dropzone";
import FileTile from "@/components/filetile";
import { handleSubmission } from "./actions";
import { redirect } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

const FIVE_MB = 5 * 1024 * 1024;

// ----------------------
// Zod Schema Definition
// ----------------------
const FormSchema = z
  .object({
    text: z.string().optional(),
    files: z
      .array(z.instanceof(File))
      .optional()
      .default([])
      // You can leave these type/size checks if you still want a final guard on submit.
      .refine(
        (files) => {
          if (!files?.length) return true;
          return files.every((file) => file.type === "application/pdf");
        },
        {
          message: "Only PDF files are allowed",
          path: ["files"],
        }
      ),
    cadence: z.string(),
    repeat: z.string(),
  })
  .refine(
    (data) => {
      // Must provide *some* text or a file
      const hasText = !!data.text?.trim();
      const hasFiles = Array.isArray(data.files) && data.files.length > 0;
      return hasText || hasFiles;
    },
    {
      message: "Please provide either a URL/text or upload files",
      path: ["text"],
    }
  )
  .refine(
    (data) => {
      if (!data.files?.length) return true;
      return data.files.length <= 3;
    },
    {
      message: "You can only upload up to 3 files",
      path: ["files"],
    }
  )
  .refine(
    (data) => {
      if (!data.files?.length) return true;
      return data.files.every((file) => file.size <= FIVE_MB);
    },
    {
      message: "File size must be less than 5MB",
      path: ["files"],
    }
  )
  .refine(
    (data) => {
      if (!data.files?.length) return true;
      const fileNames = data.files.map((file) => file.name);
      return new Set(fileNames).size === fileNames.length;
    },
    {
      message: "Duplicate files are not allowed",
      path: ["files"],
    }
  );

// ----------------------
// Helper Functions
// ----------------------
function isYouTubeUrl(url: string) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return youtubeRegex.test(url);
}

function isValidURL(url: string) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

// ----------------------
// Component Props
// ----------------------
interface UploadFormProps {
  initialUserName: string;
  isSubscribed: boolean;
}

// ----------------------
// Main Component
// ----------------------
export default function UploadForm({
  initialUserName,
  isSubscribed,
}: UploadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // React Hook Form initialization
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      text: "",
      files: [],
      cadence: "receive-daily",
      repeat: "do-not-repeat",
    },
  });

  // ----------------------
  // Submit Handler
  // ----------------------
  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      const textContent = data.text?.trim() || "";

      // Distinguish text vs. URL vs. YouTube
      if (textContent) {
        if (isYouTubeUrl(textContent)) {
          formData.append("youtube_url", textContent);
        } else if (isValidURL(textContent)) {
          formData.append("url", textContent);
        } else {
          formData.append("raw_text", textContent);
        }
      }

      // Attach files
      for (const file of data.files) {
        formData.append("files", file);
      }

      // Additional fields
      formData.append("cadence", data.cadence);
      formData.append("repeat", data.repeat);

      await handleSubmission(formData);
      form.reset();

      const response = await fetch("/api/submit", {
        method: "GET",
      });

      if (response.status === 307 || response.redirected) {
        window.location.href = response.headers.get("Location") || "/done";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ----------------------
  // Greeting
  // ----------------------
  const hours = new Date().getHours();
  let greeting = `Good morning, ${initialUserName.split(" ")[0]}! ☀️`;
  if (hours >= 12 && hours < 18) {
    greeting = `Good afternoon, ${initialUserName.split(" ")[0]}! 🌤️`;
  } else if (hours >= 18) {
    greeting = `Good evening, ${initialUserName.split(" ")[0]}! 🌙`;
  }

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="flex-1 w-full max-w-[520px] flex flex-col gap-12">
      <div className="w-full flex flex-row text-center justify-around font-bold text-4xl">
        {greeting}
      </div>
      <div className="w-full flex flex-row justify-around">
        <p className="text-center">
          Upload your content and we will deliver them to you in byte sized
          texts at an interval of your choice.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-6"
        >
          {/* 1. Add Content */}
          <div>1. Add your content</div>

          {/* Text Input Field */}
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Upload</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormDescription>
                  {"Paste any text, public URL (blogpost, article, etc.), or YouTube video URL."}&nbsp;<TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><div className="h-full flex flex-col justify-around items-center"><InformationCircleIcon className="w-4 h-4"/></div></TooltipTrigger>
                      <TooltipContent>
                        <p>Public url is a url that is NOT behind a paywall or login.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="w-full flex flex-row justify-around">AND/OR</div>

          {/* Files Drop Zone Field */}
          <FormField
            control={form.control}
            name="files"
            render={({ field, fieldState }) => {
              // Handle valid file drops
              const onDrop = useCallback(
                (acceptedFiles: File[]) => {
                  const validFiles = acceptedFiles.filter(
                    (file) =>
                      file.type === "application/pdf" && file.size <= FIVE_MB
                  );

                  const currentItems = form.getValues("files") || [];
                  const newFiles = [...currentItems, ...validFiles];

                  // Max 3 files
                  if (newFiles.length > 3) {
                    form.setError("files", {
                      type: "manual",
                      message: "You can only upload up to 3 files",
                    });
                    return;
                  }

                  // No duplicates
                  const fileNames = newFiles.map((f) => f.name);
                  if (new Set(fileNames).size !== fileNames.length) {
                    form.setError("files", {
                      type: "manual",
                      message: "Duplicate files are not allowed",
                    });
                    return;
                  }

                  // Set new files
                  form.setValue("files", newFiles);
                  // Trigger validation so Zod checks as well
                  form.trigger("files");
                },
                [form]
              );

              // Remove file
              const onDelete = useCallback(
                (filename: string) => {
                  const currentItems = form.getValues("files");
                  if (currentItems) {
                    const newFiles = currentItems.filter(
                      (item: File) => item.name !== filename
                    );
                    form.setValue("files", newFiles);
                    form.trigger("files");
                  }
                },
                [form]
              );

              // Dropzone Config
              const { getRootProps, getInputProps, isDragActive } = useDropzone(
                {
                  onDrop,
                  maxSize: FIVE_MB,
                  maxFiles: 3,
                  accept: {
                    "application/pdf": [".pdf"],
                  },
                  onDropRejected: (fileRejections) => {
                    const errorMessages = fileRejections.map((rejection) => {
                      const fileErrors = rejection.errors.map((error) => {
                        switch (error.code) {
                          case "file-too-large":
                            return `${rejection.file.name} is larger than 5MB`;
                          case "file-invalid-type":
                            return `${rejection.file.name} is not a PDF file`;
                          case "too-many-files":
                            return "You tried to upload too many files at once";
                          default:
                            return error.message;
                        }
                      });
                      return fileErrors.join(", ");
                    });

                    form.setError("files", {
                      type: "manual",
                      message: errorMessages.join("; "),
                    });
                  },
                  onDragEnter: () => {
                    // Clear old errors to be ready for a new drop
                    form.clearErrors("files");
                  },
                }
              );

              // Log the current error (helpful if the UI won't show it)
              console.log("file error:", fieldState.error);

              return (
                <FormItem>
                  <div {...getRootProps()} className="border p-4">
                    <input {...getInputProps()} />
                    <DropZoneUI isDragActive={isDragActive} />
                  </div>

                  <div className="w-full flex flex-col gap-4 mt-2">
                    {field.value?.map((file: File) => (
                      <FileTile
                        key={file.name}
                        filename={file.name}
                        filesize={file.size}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>

                  {/* Display immediate or Zod error */}
                  {fieldState.error && (
                    <FormMessage className="text-red-500 mt-2">
                      {fieldState.error.message}
                    </FormMessage>
                  )}
                </FormItem>
              );
            }}
          />

          <br />
          {/* 2. Choose Settings */}
          <div>2. Choose Your Settings</div>

          {/* Cadence */}
          <FormField
            control={form.control}
            name="cadence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  How often would you like to receive texts from us?
                </FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Once Every..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Cadence</SelectLabel>
                        <SelectItem value="receive-daily">day</SelectItem>
                        <SelectItem value="receive-12" disabled={!isSubscribed}>
                          12 hours {!isSubscribed && "(Pro ✨)"}
                        </SelectItem>
                        <SelectItem value="receive-6" disabled={!isSubscribed}>
                          6 hours {!isSubscribed && "(Pro ✨)"}
                        </SelectItem>
                        <SelectItem value="receive-1" disabled={!isSubscribed}>
                          1 hour {!isSubscribed && "(Pro ✨)"}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Repeat */}
          <FormField
            control={form.control}
            name="repeat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  How often would you like the information in these texts to
                  repeat?
                </FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Repeat..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Repeat</SelectLabel>
                        <SelectItem
                          value="repeat-forever"
                          disabled={!isSubscribed}
                        >
                          forever {!isSubscribed && "(Pro ✨)"}
                        </SelectItem>
                        <SelectItem value="do-not-repeat">never</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <div className="w-full flex flex-row justify-around">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>

          {/* Top-level Error */}
          {error && (
            <div className="w-full text-center text-red-500">{error}</div>
          )}
        </form>
      </Form>
    </div>
  );
}
