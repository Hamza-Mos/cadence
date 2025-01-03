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

const FIVE_MB = 5 * 1024 * 1024;

const FormSchema = z
  .object({
    text: z.string().optional(),
    files: z.array(z.instanceof(File)).optional().default([]),
    cadence: z.string(),
    repeat: z.string(),
  })
  .refine(
    (data) => {
      // Check if at least one of text or files is provided
      const hasText = !!data.text?.trim();
      const hasFiles = Array.isArray(data.files) && data.files.length > 0;
      return hasText || hasFiles;
    },
    {
      message: "Please provide either a URL/text or upload files",
      path: ["text"], // This will show the error under the text field
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

interface UploadFormProps {
  initialUserName: string;
  isSubscribed: boolean;
}

export default function UploadForm({
  initialUserName,
  isSubscribed,
}: UploadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      text: "",
      files: [],
      cadence: "receive-daily",
      repeat: "do-not-repeat",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      const textContent = data.text?.trim() || "";

      if (textContent) {
        if (isYouTubeUrl(textContent)) {
          formData.append("youtube_url", textContent);
        } else if (isValidURL(textContent)) {
          formData.append("url", textContent);
        } else {
          formData.append("raw_text", textContent);
        }
      }

      for (const file of data.files) {
        formData.append("files", file);
      }

      formData.append("cadence", data.cadence);
      formData.append("repeat", data.repeat);

      const result = await handleSubmission(formData);
      console.log("Processed content:", result);

      // Handle successful submission
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const hours = new Date().getHours();
  let greeting = `Good morning, ${initialUserName.split(" ")[0]}! ☀️`;
  if (hours >= 12 && hours < 18) {
    greeting = `Good afternoon, ${initialUserName.split(" ")[0]}! 🌤️`;
  } else if (hours >= 18) {
    greeting = `Good evening, ${initialUserName.split(" ")[0]}! 🌙`;
  }

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
          <div>1. Add your content</div>
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
                  Paste any raw text, article/blog URL, or a YouTube URL here.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="w-full flex flex-row justify-around">{"AND/OR"}</div>

          <FormField
            control={form.control}
            name="files"
            render={({ field, fieldState }) => {
              const onDrop = useCallback(
                (acceptedFiles: File[]) => {
                  const currentItems = form.getValues("files") || [];
                  const newFiles = [...currentItems, ...acceptedFiles];
                  form.setValue("files", newFiles);
                  // Trigger validation immediately after setting new files
                  form.trigger("files");
                },
                [form]
              );

              const onDelete = useCallback(
                (filename: string) => {
                  const currentItems = form.getValues("files");
                  if (currentItems) {
                    const newFiles = currentItems.filter(
                      (item: File) => item.name !== filename
                    );
                    form.setValue("files", newFiles);
                    // Trigger validation after deleting files
                    form.trigger("files");
                  }
                },
                [form]
              );

              const { getRootProps, getInputProps, isDragActive } = useDropzone(
                {
                  onDrop,
                  // Add validation on drop
                  onDropRejected: () => {
                    form.setError("files", {
                      type: "manual",
                      message: "One or more files were rejected",
                    });
                  },
                }
              );

              return (
                <FormItem>
                  <div>
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                      <DropZoneUI isDragActive={isDragActive} />
                    </div>
                    <br />
                    <div className="w-full flex flex-col justify-around gap-4">
                      {field.value?.map((file: File) => (
                        <FileTile
                          key={file.name}
                          filename={file.name}
                          filesize={file.size}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                    {/* Add error message display */}
                    {fieldState.error && (
                      <FormMessage className="text-red-500 mt-2">
                        {fieldState.error.message}
                      </FormMessage>
                    )}
                  </div>
                </FormItem>
              );
            }}
          />
          <br />
          <div>2. Choose Your Settings</div>
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
                      <SelectValue {...field} placeholder="Once Every..." />
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
                      <SelectValue {...field} placeholder="Repeat..." />
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
          <div className="w-full flex flex-row justify-around">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
          {error && (
            <div className="w-full text-center text-red-500">{error}</div>
          )}
        </form>
      </Form>
    </div>
  );
}
