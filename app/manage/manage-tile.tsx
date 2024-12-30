"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileTile from "@/components/filetile";
import { handleDeleteSubmission } from "./actions";

interface ManageTileProps {
  uuid: string;
  textField: string;
  uploadedFiles: string[];
  cadence: string;
  repeat: string;
  created: Date;
}

function formatDate(date: Date): string {
  // Extract the components of the date
  let year = date.getFullYear().toString().slice(-2); // Get last two digits of the year
  let month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-based
  let day = date.getDate().toString().padStart(2, "0");

  // Construct the time part
  let hours = date.getHours().toString().padStart(2, "0");
  let minutes = date.getMinutes().toString().padStart(2, "0");
  let ampm = hours >= "12" ? "PM" : "AM";
  hours = (parseInt(hours) % 12).toString().padStart(2, "0");
  let time = `${hours}:${minutes} ${ampm}`;

  // Combine the parts into the desired format
  return `${month}/${day}/${year} at ${time}`;
}

export default function ManageTile({
  uuid,
  textField,
  uploadedFiles,
  cadence,
  repeat,
  created,
}: ManageTileProps) {
  return (
    <Card className="w-[520px]">
      <CardHeader>
        <CardTitle>{`Created on ${formatDate(created)}`}</CardTitle>
      </CardHeader>
      <CardContent>
        <form>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Content</Label>
              <Input id="name" placeholder={textField} readOnly />
              {uploadedFiles.map((file) => (
                <div key={file}>
                  <FileTile
                    filename={file}
                    filesize={undefined}
                    onDelete={undefined}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="framework">Cadence</Label>
              <Select>
                <SelectTrigger id="framework">
                  <SelectValue placeholder={cadence} />
                </SelectTrigger>
              </Select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="framework">Repeat</Label>
              <Select>
                <SelectTrigger id="framework">
                  <SelectValue placeholder={repeat} />
                </SelectTrigger>
              </Select>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          variant="outline"
          className="border-red-500 text-red-500"
          onClick={() => {
            handleDeleteSubmission(uuid);
          }}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
