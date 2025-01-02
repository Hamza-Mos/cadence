// utils/twilio.ts
import { Twilio } from "twilio";

let twilioClient: Twilio | null = null;

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return twilioClient;
}

export async function sendTextMessage(to: string, message: string) {
  try {
    const client = getTwilioClient();
    const result = await client.messages.create({
      body: message,
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
    });
    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error("Error sending text message:", error);
    throw error;
  }
}
