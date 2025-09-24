import axios from 'axios';
import twilio from 'twilio';

// ==== CONFIG ====
const POLL_INTERVAL_MIN_MS = 60000;  // 1 min
const POLL_INTERVAL_MAX_MS = 120000; // 2 min

// ==== ENVIRONMENT VARIABLE CHECK ====
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE_NUMBER || !process.env.MY_PHONE_NUMBER) {
  console.error("Error: One or more Twilio environment variables are missing.");
  process.exit(1);
}

// Twilio setup
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

// API CONFIG
const API_URL = 'https://app.checkvisaslots.com/slots/v3';
const HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'extversion': '4.6.5.1',
  'origin': 'chrome-extension://beepaenfejnphdgnkmccjcfiieihhogl',
  'pragma': 'no-cache',
  'priority': 'u=1, i',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  'x-api-key': '9Z9OS3'
};

// ==== FUNCTION TO SEND DEMO NOTIFICATION ====
async function sendDemoNotification() {
  try {
    const message = '✅ Demo notification: Visa slot checker is running!';
    await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: MY_PHONE_NUMBER
    });
    console.log("Demo SMS sent successfully.");
  } catch (err) {
    console.error("Error sending demo SMS:", err.message);
  }
}

// ==== FUNCTION TO CHECK SLOTS ====
async function checkSlots() {
  try {
    const res = await axios.get(API_URL, { headers: HEADERS });

    // Log full API response for debugging
    console.log("API Response:", JSON.stringify(res.data, null, 2));

    const slots = res.data.slotDetails;

    if (!slots || slots.length === 0) {
      console.log('No slots found at', new Date().toLocaleString());
      return;
    }

    // Send SMS for all locations with slots
    const available = slots.filter(s => s.slots > 0);
    if (available.length > 0) {
      let message = '🎉 Visa slots available:\n';
      available.forEach(loc => {
        message += `${loc.visa_location} - ${loc.slots} slots\n`;
      });

      console.log(message);

      // Send SMS via Twilio
      await client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: MY_PHONE_NUMBER
      });
      console.log("SMS sent successfully.");
    } else {
      console.log('No slots available at', new Date().toLocaleString());
    }

  } catch (err) {
    console.error('Error fetching slots:', err.message);
  }
}

// ==== RANDOMIZED POLLING ====
function getRandomInterval(minMs = POLL_INTERVAL_MIN_MS, maxMs = POLL_INTERVAL_MAX_MS) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function startPolling() {
  while (true) {
    await checkSlots();
    const interval = getRandomInterval();
    console.log(`Next check in ${Math.floor(interval / 1000)} seconds...`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// ==== START SCRIPT ====
console.log('Visa slot checker started...');
await sendDemoNotification(); // Send demo SMS at startup
startPolling(); // Start randomized polling
