"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { z } from "zod";

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
import { useCallback } from "react";

const FIVE_MB = 5 * 1024 * 1024;

const FormSchema = z.object({
  text: z.string(),
  files: z
    .array(z.instanceof(File))
    .refine((files) => files.length <= 3, {
      message: "You can only upload up to 3 files",
    })
    .refine((files) => files.some((file) => file.size <= FIVE_MB), {
      message: "File size must be less than 5MB",
    }),
  cadence: z.string(),
  repeat: z.string(),
});

export default function ProtectedPage() {
  //   const supabase = await createClient();

  //   const {
  //     data: { user },
  //   } = await supabase.auth.getUser();

  //   if (!user) {
  //     return redirect("/sign-in");
  //   }

  const userName = "Suraj";

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      text: "www.apple.com",
      cadence: "Once A Day",
      repeat: "Never",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(data);
  }

  const hours = new Date().getHours();
  let greeting = `Good morning, ${userName.split(" ")[0]}! ☀️`;
  if (hours >= 12 && hours < 18) {
    greeting = `Good afternoon, ${userName.split(" ")[0]}! 🌤️`;
  } else if (hours >= 18) {
    greeting = `Good evening, ${userName.split(" ")[0]}! 🌙`;
  }

  return (
    <div className="flex-1 w-full max-w-[520px] flex flex-col gap-12">
      <div className="w-full flex flex-row text-center justify-around font-bold text-4xl">
        {greeting}
      </div>
      <div className={`w-full flex flex-row justify-around`}>
        {userName && (
          <p>
            Just upload your content and we will deliver them to you in byte
            sized texts at an interval of your choice.
          </p>
        )}
      </div>
      {userName && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-full space-y-6 "
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
                    Paste any raw text or URLs here.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="files"
              render={({ field }) => {
                const onDrop = useCallback(
                  (acceptedFiles: File[]) => {
                    const currentItems = form.getValues("files");
                    if (currentItems) {
                      form.setValue("files", [
                        ...currentItems,
                        ...acceptedFiles,
                      ]);
                    } else {
                      form.setValue("files", acceptedFiles);
                    }
                  },
                  [field]
                );

                const { getRootProps, getInputProps, isDragActive } =
                  useDropzone({ onDrop });

                return (
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    {isDragActive ? (
                      <p>Drop the files here ...</p>
                    ) : (
                      <p>
                        Drag 'n' drop some files here, or click to select files
                      </p>
                    )}
                    <div>
                      {field.value?.map((file: File) => (
                        <div key={file.name}>{file.name}</div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <div className="w-full flex flex-row justify-around">
              {"AND/OR"}
            </div>

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
                    <Select {...field}>
                      <SelectTrigger>
                        <SelectValue placeholder="Once Every..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Cadence</SelectLabel>
                          <SelectItem value="receive-daily">Day</SelectItem>
                          <SelectItem value="receive-12">12 Hours</SelectItem>
                          <SelectItem value="receive-6">6 Hours</SelectItem>
                          <SelectItem value="receive-1">1 Hour</SelectItem>
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
                    <Select {...field}>
                      <SelectTrigger>
                        <SelectValue placeholder="Repeat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Repeat</SelectLabel>
                          <SelectItem value="repeat-forever">
                            Forever
                          </SelectItem>
                          <SelectItem value="do-not-repeat">Never</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="w-full flex flex-row justify-around">
              <Button type="submit">Submit</Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
