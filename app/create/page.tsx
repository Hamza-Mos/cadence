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

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user?.id);

  if (!data || data.length === 0 || error) {
    throw new Error("Error getting user data");
  }

  const userName = user.user_metadata.first_name;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UploadForm
        initialUserName={userName}
        isSubscribed={data[0].is_subscribed}
      />
    </Suspense>
  );
}
