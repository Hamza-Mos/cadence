import { redirect } from "next/navigation";

export async function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: "/done" },
  });
}
