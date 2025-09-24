import axios from 'axios';
import twilio from 'twilio';

// ==== CONFIG ====
const POLL_INTERVAL_MS = 45 * 1000; // 45 Seconds

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

// Keep track of locations already notified
let notifiedLocations = new Set();

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

    // Filter locations with available slots
    const available = slots.filter(s => s.slots > 0);

    if (available.length > 0) {
      // Filter out locations already notified
      const newSlots = available.filter(s => !notifiedLocations.has(s.visa_location));
      if (newSlots.length === 0) {
        console.log('Slots available, but already notified.');
        return;
      }

      let message = '🎉 Visa slots available:\n';
      newSlots.forEach(loc => {
        message += `${loc.visa_location} - ${loc.slots} slots\n`;
        notifiedLocations.add(loc.visa_location);
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

// ==== START POLLING ====
console.log('Visa slot checker started...');
await sendDemoNotification(); // send demo SMS at startup
checkSlots(); // immediate run
setInterval(checkSlots, POLL_INTERVAL_MS);
