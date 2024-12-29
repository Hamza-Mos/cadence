"use client";

import { ManageTile } from "@/components/manage-tile";

export default function Manage() {
  //   const supabase = await createClient();

  //   const {
  //     data: { user },
  //   } = await supabase.auth.getUser();

  //   if (!user) {
  //     return redirect("/sign-in");
  //   }

  const userName = "Suraj";
  const cadences = [
    {
      uuid: "1",
      text: "",
      files: [
        {
          name: "file1",
          size: 1234000000,
          type: "text/plain",
        },
        {
          name: "file2",
          size: 1234000000,
          type: "text/plain",
        },
      ],
      cadence: "receive-daily",
      repeat: "do-not-repeat",
    },
    {
      uuid: "2",
      text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Quis ipsum suspendisse ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel facilisis. Donec et odio pellentesque diam volutpat commodo sed egestas egestas. Nunc vel risus commodo viverra maecenas accumsan lacus vel facilisis. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Aliquam ut porttitor leo a diam sollicitudin tempor id eu. Facilisi nullam vehicula ipsum a arcu cursus vitae congue.",
      files: [
        {
          name: "file3",
          size: 1234000000,
          type: "text/plain",
        },
        {
          name: "file4",
          size: 1234000000,
          type: "text/plain",
        },
      ],
      cadence: "receive-daily",
      repeat: "do-not-repeat",
    },
  ];

  return (
    <div className="flex-1 w-full max-w-[520px] flex flex-col gap-12">
      <div className="w-full flex flex-row text-center justify-around font-bold text-4xl">
        {"Manage Your Cadences"}
      </div>
      <div className="w-full flex flex-row justify-around">
        {userName && (
          <div className="flex flex-col gap-12">
            {cadences.map((cadence) => (
              <ManageTile
                key={cadence.uuid}
                uuid={cadence.uuid}
                text={cadence.text}
                files={cadence.files}
                cadence={cadence.cadence}
                repeat={cadence.repeat}
                created={new Date()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
