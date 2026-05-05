// CHIP webhook signature verification
import { db } from "./db";

// Verify webhook signature using RSA-SHA256
export async function verifyChipWebhookSignature(
  signature: string,
  body: string
): Promise<boolean> {
  try {
    const config = await db.chipWebhookConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      console.warn("No active CHIP webhook config found — skipping verification");
      return true; // Allow in dev if not configured
    }

    const publicKey = config.publicKey;

    // Node.js crypto is available in server context
    const { createVerify } = await import("crypto");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(body);
    return verifier.verify(publicKey, signature, "base64");
  } catch (err) {
    console.error("Webhook verification error:", err);
    return false;
  }
}

// Verify success_callback using general public key
export async function verifyChipCallbackSignature(
  signature: string,
  body: string,
  publicKey: string
): Promise<boolean> {
  try {
    const { createVerify } = await import("crypto");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(body);
    return verifier.verify(publicKey, signature, "base64");
  } catch (err) {
    console.error("Callback verification error:", err);
    return false;
  }
}
