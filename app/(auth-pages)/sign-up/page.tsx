"use client";

import {
  signUpWithPhone,
  verifyPhoneOtp,
  verifySignUpOtp,
} from "@/app/auth/actions";
import { FormMessage } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/ui/phone-input";

export default function SignUp() {
  const [step, setStep] = useState<"phone" | "verification">("phone");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ success?: string; error?: string }>(
    {}
  );
  const router = useRouter();

  const handleSendCode = async (formData: FormData) => {
    const result = await signUpWithPhone(formData);

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
    const result = await verifySignUpOtp(formData);

    if ("error" in result) {
      setMessage({ error: result.error });
    } else {
      router.push("/create");
    }
  };

  return (
    <div className="flex flex-col py-16 mx-auto">
      <h1 className="text-2xl font-medium">Sign up</h1>
      <p className="text-sm text text-foreground">
        Already have an account?{" "}
        <Link className="text-primary font-medium underline" href="/sign-in">
          Sign in
        </Link>
      </p>

      {step === "phone" && (
        <form
          action={handleSendCode}
          className="flex flex-col gap-4 [&>input]:mb-3 mt-8"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              placeholder="First name"
              required
              autoComplete="given-name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              placeholder="Last name"
              required
              autoComplete="family-name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Phone Number</Label>
            <PhoneInput />
          </div>
          <SubmitButton pendingText="Sending code...">
            Send verification code
          </SubmitButton>
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

      {step === "verification" && (
        <form
          action={handleVerifyCode}
          className="flex flex-col gap-2 [&>input]:mb-3 mt-8"
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
