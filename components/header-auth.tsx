import { signOutAction } from "@/app/auth/actions";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/server";
import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { PowerIcon } from "@heroicons/react/24/outline";

export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let resp: PostgrestSingleResponse<any[]> = {
    data: [],
    error: null,
    status: 200,
    statusText: "",
    count: 0,
  };

  if (user) {
    resp = await supabase.from("users").select("*").eq("id", user?.id);
    if (!resp.data || resp.data.length === 0 || resp.error) {
      throw new Error("Error getting user data");
    }
  }

  if (!hasEnvVars) {
    return (
      <>
        <div className="flex gap-4 items-center">
          <div>
            <Badge
              variant={"default"}
              className="font-normal pointer-events-none"
            >
              Please update .env.local file with anon key and url
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant={"outline"}
              disabled
              className="opacity-75 cursor-none pointer-events-none"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={"default"}
              disabled
              className="opacity-75 cursor-none pointer-events-none"
            >
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }
  return user ? (
    <div className="flex items-center gap-4">
      <div className="hidden md:block">Hey, {resp.data[0].first_name}!</div>
      <Link
        className="py-2 px-4 border border-yellow-500 rounded-md"
        href={!resp.data[0].is_subscribed ? "/api/checkout" : "/api/billing"}
      >
        <div className="flex flex-row">
          <div className="flex flex-row hidden md:block">
            {!resp.data[0].is_subscribed ? "Get Pro" : "Manage Pro"}&nbsp;
          </div>
          ✨
        </div>
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant={"outline"}>
          <PowerIcon className="w-4 h-4" />

          <div className="hidden md:block">&nbsp;{"Sign out"}</div>
        </Button>
      </form>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
