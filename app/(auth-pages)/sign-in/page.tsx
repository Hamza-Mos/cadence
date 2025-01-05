"use client";

import { signInWithPhone, verifyPhoneOtp } from "@/app/auth/actions";
import { FormMessage } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { useState } from "react";

export default function Login() {
  const [step, setStep] = useState<"phone" | "verification">("phone");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ success?: string; error?: string }>(
    {}
  );

  const handleSendCode = async (formData: FormData) => {
    const result = await signInWithPhone(formData);

    if ("error" in result) {
      setMessage({ error: result.error });
    } else {
      setMessage({ success: "Verification code sent" });
      setPhone(result.phone);
      setStep("verification");
    }
  };

  const handleVerifyCode = async (formData: FormData) => {
    formData.append("phone", phone);
    const result = await verifyPhoneOtp(formData);

    if ("error" in result) {
      setMessage({ error: result.error });
    }
    // Successful verification will handle redirect in the server action
  };

  return (
    <div className="flex flex-col mx-auto py-32">
      <h1 className="text-2xl font-medium">Sign in</h1>
      <p className="text-sm text-foreground">
        Don't have an account?{" "}
        <Link className="text-primary font-medium underline" href="/sign-up">
          Sign up
        </Link>
      </p>

      {step === "phone" && (
        <form
          action={handleSendCode}
          className="flex flex-col gap-2 [&>input]:mb-3 mt-8"
        >
          <Label>Phone Number *</Label>
          <PhoneInput />
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
        <form
          action={handleVerifyCode}
          className="flex flex-col gap-4 [&>input]:mb-3 mt-8"
        >
          <p className="text-sm text-foreground">
            Enter the verification code sent to {phone}
          </p>
          <br />
          <Label htmlFor="token">Verification Code</Label>
          <Input
            name="token"
            placeholder="123456"
            required
            pattern="^\d{6}$"
            title="Please enter the 6-digit verification code"
            maxLength={6}
          />
          <SubmitButton pendingText="Verifying...">Verify Code</SubmitButton>
          <button
            type="button"
            className="text-sm text-primary underline text-center"
            onClick={() => setStep("phone")}
          >
            Use different phone number
          </button>
          <br />
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
