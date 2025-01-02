import { Twilio } from "twilio";

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendTextMessage(to: string, message: string) {
  try {
    const result = await twilioClient.messages.create({
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
