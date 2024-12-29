import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileMeta } from "@/lib/utils";
import FileTile from "@/components/filetile";

interface TileProps {
  uuid: string;
  text: string;
  files: FileMeta[];
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
  let time = "5:30 PM";

  // Combine the parts into the desired format
  return `${year}/${month}/${day} at ${time}`;
}

export function ManageTile({
  uuid,
  text,
  files,
  cadence,
  repeat,
  created,
}: TileProps) {
  const deleteCadence = (uuid: string) => {
    console.log(`Deleting cadence with uuid: ${uuid}`);
  };

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
              <Input id="name" placeholder={text} readOnly />
              {files.map((file) => (
                <div key={file.name}>
                  <FileTile
                    filename={file.name}
                    filesize={file.size}
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
                  <SelectValue placeholder={cadence} />
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
            deleteCadence(uuid);
          }}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
