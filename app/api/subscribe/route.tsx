import { markUserSubscribed } from "@/app/api/actions";
import { redirect } from "next/navigation";

export async function GET() {
  await markUserSubscribed();
  redirect("/create");
}
