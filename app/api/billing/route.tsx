export const dynamic = "force-dynamic";
import { createBillingPortal } from "@/app/api/actions";
import { redirect } from "next/navigation";

export async function GET() {
  const billingPortalUrl = await createBillingPortal();
  redirect(billingPortalUrl);
}
