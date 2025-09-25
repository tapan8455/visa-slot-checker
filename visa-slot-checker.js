import axios from "axios";
import twilio from "twilio";

// ==== CONFIG ====
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const API_KEYS = ["9Z9OS3", "TLKV29","336SQI"];
const FROZEN_KEYS = new Map(); // { apiKey: timestampUntilUnfrozen }

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

const API_URL = "https://app.checkvisaslots.com/slots/v3";
const BASE_HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  extversion: "4.6.5.1",
  origin: "chrome-extension://beepaenfejnphdgnkmccjcfiieihhogl",
  pragma: "no-cache",
  priority: "u=1, i",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
};

// ==== PICK ACTIVE API KEY ====
function getActiveApiKey() {
  const now = Date.now();
  for (const key of API_KEYS) {
    if (!FROZEN_KEYS.has(key) || FROZEN_KEYS.get(key) < now) {
      return key;
    }
  }
  return null; // no key available
}

// ==== FUNCTION TO CHECK SLOTS ====
async function checkSlots() {
  // Restrict time window: run only between 8 AM – 1 AM EST
  const estNow = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const estHour = new Date(estNow).getHours();
  if (estHour >= 1 && estHour < 8) {
    console.log("⏸ Paused: between 1 AM and 8 AM EST.");
    return;
  }

  const apiKey = getActiveApiKey();
  if (!apiKey) {
    console.log("❌ No available API keys (all frozen). Skipping check.");
    return;
  }

  try {
    const res = await axios.get(API_URL, {
      headers: { ...BASE_HEADERS, "x-api-key": apiKey },
    });

    const slots = res.data.slotDetails;
    console.log("Full API response:", JSON.stringify(res.data, null, 2));

    const available = slots.filter((s) => s.slots > 0);

    if (available.length > 0) {
      let message = "🎉 Visa slots available:\n";
      available.forEach((loc) => {
        message += `${loc.visa_location} - ${loc.slots} slots\n`;
      });

      console.log(message);

      await client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: MY_PHONE_NUMBER,
      });
    } else {
      console.log("No slots available at", new Date().toLocaleString());
    }
  } catch (err) {
    if (err.response?.status === 429) {
      console.error(`⚠️ 429: Freezing API key ${apiKey} for 3 hours.`);
      FROZEN_KEYS.set(apiKey, Date.now() + 3 * 60 * 60 * 1000);
    } else {
      console.error("Error fetching slots:", err.message);
    }
  }
}

// ==== START POLLING ====
console.log("Visa slot checker started...");
checkSlots(); // run immediately
setInterval(checkSlots, POLL_INTERVAL_MS);
