import { Suspense } from "react";
import UploadForm from "./upload-form";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function CreatePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const userName = user.user_metadata.first_name;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UploadForm initialUserName={userName} />
    </Suspense>
  );
}
