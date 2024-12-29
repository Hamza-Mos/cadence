"use client";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPhoneChange, verifyPhoneChange } from "@/app/auth/actions";

export default function ChangePhone() {
  const [step, setStep] = useState<"phone" | "verification">("phone");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ success?: string; error?: string }>(
    {}
  );
  const router = useRouter();

  const handleRequestChange = async (formData: FormData) => {
    const result = await requestPhoneChange(formData);

    if ("error" in result) {
      setMessage({ error: result.error });
    } else {
      setMessage({ success: "Verification code sent" });
      setPhone(result.phone);
      setStep("verification");
    }
  };

  const handleVerifyChange = async (formData: FormData) => {
    formData.append("phone", phone);
    const result = await verifyPhoneChange(formData);

    if ("error" in result) {
      setMessage({ error: result.error });
    } else {
      router.push("/settings?success=Phone number updated successfully");
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md p-4 gap-2">
      <h1 className="text-2xl font-medium">Change phone number</h1>

      {step === "phone" && (
        <form action={handleRequestChange} className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Enter your new phone number below. We'll send a verification code to
            confirm the change.
          </p>
          <div className="flex flex-col gap-2">
            <Label>New Phone Number</Label>
            <PhoneInput />
          </div>
          <SubmitButton pendingText="Sending code...">
            Send verification code
          </SubmitButton>
          <FormMessage
            message={
              message.error
                ? { error: message.error }
                : message.success
                  ? { success: message.success }
                  : { success: "" }
            }
          />
        </form>
      )}

      {step === "verification" && (
        <form action={handleVerifyChange} className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Enter the verification code sent to {phone}. Code expires in 60
            seconds.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="token">Verification Code</Label>
            <Input
              name="token"
              placeholder="123456"
              required
              pattern="^\d{6}$"
              title="Please enter the 6-digit verification code"
              maxLength={6}
            />
          </div>
          <SubmitButton pendingText="Verifying...">
            Verify and Change Number
          </SubmitButton>
          <button
            type="button"
            className="text-sm text-primary underline text-center"
            onClick={() => setStep("phone")}
          >
            Use different phone number
          </button>
          <FormMessage
            message={
              message.error
                ? { error: message.error }
                : message.success
                  ? { success: message.success }
                  : { success: "" }
            }
          />
        </form>
      )}
    </div>
  );
}
