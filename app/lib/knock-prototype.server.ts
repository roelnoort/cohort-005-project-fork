// PROTOTYPE (wayfinder #14: What does the Notification Feed look like in Cadence?)
// Throwaway. Lives on branch prototype/notification-feed only. Do not merge.
import { Knock, signUserToken } from "@knocklabs/node";

export const PROTOTYPE_WORKFLOW_KEY = "cadence-prototype";

export function getKnockFeedConfig() {
  const publicKey = process.env.KNOCK_PUBLIC_API_KEY;
  const feedChannelId = process.env.KNOCK_FEED_CHANNEL_ID;
  if (!publicKey || !feedChannelId) return null;
  return { publicKey, feedChannelId };
}

export async function signKnockUserToken(userId: number) {
  return signUserToken(String(userId), {
    signingKey: process.env.KNOCK_SIGNING_KEY,
    expiresInSeconds: 60 * 60,
  });
}

let client: Knock | null = null;
export function knock() {
  client ??= new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
  return client;
}
