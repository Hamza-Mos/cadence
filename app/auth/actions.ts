"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signUpWithPhone(formData: FormData) {
  const supabase = await createClient();
  const areaCode = formData.get("areaCode") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const fullPhone = `+${areaCode}${phoneNumber.replace(/^0+/, "")}`;

  try {
    // first check if a user with this phone number exists
    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("phone")
      .eq("phone", phoneNumber)
      .single();

    if (existingUser) {
      return {
        error:
          "An account with this phone number already exists. Please sign in instead.",
      };
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
      options: {
        data: {
          phone_number: phoneNumber,
          first_name: firstName,
          last_name: lastName,
          area_code: areaCode,
        },
      },
    });

    if (error) {
      return {
        error: error.message,
      };
    }

    return {
      success: true,
      phone: fullPhone,
    };
  } catch (error) {
    return {
      error: "Failed to send verification code",
    };
  }
}

export async function signInWithPhone(formData: FormData) {
  const supabase = await createClient();
  const areaCode = formData.get("areaCode") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const fullPhone = `+${areaCode}${phoneNumber.replace(/^0+/, "")}`;

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
    });

    if (error) {
      return {
        error: error.message,
      };
    }

    return {
      success: true,
      phone: fullPhone,
    };
  } catch (error) {
    return {
      error: "Failed to send verification code",
    };
  }
}

export async function verifyPhoneOtp(formData: FormData) {
  const supabase = await createClient();
  const phone = formData.get("phone") as string;
  const token = formData.get("token") as string;

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.startsWith("+") ? phone.slice(1) : phone,
      token,
      type: "sms",
    });

    if (error) {
      console.log("Error: ", error);
      return {
        error: error.message,
      };
    }
  } catch (error) {
    return {
      error: "Failed to verify code",
    };
  }

  return redirect("/protected");
}

// New action for sign up verification
export async function verifySignUpOtp(formData: FormData) {
  const supabase = await createClient();
  const phone = formData.get("phone") as string;
  const token = formData.get("token") as string;

  try {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: phone.startsWith("+") ? phone.slice(1) : phone,
      token,
      type: "sms",
    });

    if (verifyError) {
      return {
        error: verifyError.message,
      };
    }

    // Get current user after verification
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        error: "Failed to get user details",
      };
    }

    const metadata = user.user_metadata;

    const { error: profileError } = await supabase.from("users").insert({
      id: user.id,
      first_name: metadata.first_name,
      last_name: metadata.last_name,
      area_code: metadata.area_code,
      phone: metadata.phone_number,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error("User creation error:", profileError);
      return {
        error: "Failed to create user profile",
      };
    }
  } catch (error) {
    console.error("Verification error:", error);
    return {
      error: "Failed to verify code",
    };
  }

  return redirect("/protected");
}

export const completeSignup = async (formData: FormData) => {
  console.log(`form data: ${formData}`);

  return {
    success: "Done!",
  };
};

export async function requestPhoneChange(formData: FormData) {
  const supabase = await createClient();
  const areaCode = formData.get("areaCode") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const fullPhone = `+${areaCode}${phoneNumber.replace(/^0+/, "")}`;

  try {
    const { data, error } = await supabase.auth.updateUser({
      phone: fullPhone,
    });

    if (error) {
      return {
        error: error.message,
      };
    }

    return {
      success: true,
      phone: fullPhone,
    };
  } catch (error) {
    return {
      error: "Failed to initiate phone number change",
    };
  }
}

export async function verifyPhoneChange(formData: FormData) {
  const supabase = await createClient();
  const phone = formData.get("phone") as string;
  const token = formData.get("token") as string;

  try {
    // First verify the OTP
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: phone.startsWith("+") ? phone.slice(1) : phone,
      token,
      type: "phone_change",
    });

    if (verifyError) {
      return {
        error: verifyError.message,
      };
    }

    // Get current user after verification
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        error: "Failed to get user details",
      };
    }

    // Update the users table with new phone number
    const areaCode = phone.split("+")[1].slice(0, -10); // Extract area code
    const phoneNumber = phone.slice(-10); // Get last 10 digits

    const { error: updateError } = await supabase
      .from("users")
      .update({
        phone: phoneNumber,
        area_code: areaCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update user table:", updateError);
      return {
        error: "Failed to update user profile",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Phone change error:", error);
    return {
      error: "Failed to change phone number",
    };
  }
}

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required"
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  } else {
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link."
    );
  }
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/protected");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password"
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed"
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
