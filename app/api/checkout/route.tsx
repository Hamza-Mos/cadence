import { createCheckoutSession } from "@/app/api/actions";
import { redirect } from "next/navigation";

export async function GET() {
  const checkoutSessionUrl = await createCheckoutSession();
  if (!checkoutSessionUrl) {
    throw new Error("Error creating checkout session");
  }
  redirect(checkoutSessionUrl);
}
