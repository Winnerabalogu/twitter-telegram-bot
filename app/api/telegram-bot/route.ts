import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Ensure all required environment variables are set
if (!TELEGRAM_BOT_TOKEN || !CHAT_ID || !TWITTER_BEARER_TOKEN) {
  throw new Error("Missing required environment variables.");
}

// Function to send messages to Telegram
async function sendMessageToTelegram(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, { chat_id: CHAT_ID, text: message });
    console.log("Message sent to Telegram successfully");
  } catch (error) {
    console.error("Error sending message to Telegram:", error?.response?.data || error.message);
  }
}

// Function to fetch tweets with backoff and a retry limit
async function fetchTweetsWithBackoff(attempt = 1, maxRetries = 5) {
  if (attempt > maxRetries) {
    console.error("Max retry limit reached. Stopping requests.");
    return [];
  }

  try {
    const response = await axios.get("https://api.twitter.com/2/tweets/search/recent", {
      params: { query: "airdrop", max_results: 5 },
      headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
    });

    const tweets = response.data.data || [];
    for (const tweet of tweets) {
      const message = `New Tweet:\n\n${tweet.text}\n\n🔗 Link: https://twitter.com/twitter/status/${tweet.id}`;
      await sendMessageToTelegram(message);
    }

    return tweets;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, headers } = error.response;

      if (status === 429) {
        const retryAfter = headers["retry-after"];
        const resetTime = headers["x-ratelimit-reset"];
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

        let delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        if (resetTime) {
          const waitTime = Math.max(0, resetTime - currentTime) * 1000;
          delay = Math.max(delay, waitTime);
        }

        console.warn(`Rate limit hit. Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchTweetsWithBackoff(attempt + 1, maxRetries);
      } else {
        console.error(`Twitter API Error (Status: ${status}):`, error.response.data);
      }
    } else {
      console.error("Unknown error fetching tweets:", error.message || error);
    }
  }

  return [];
}

// Export GET method
export async function GET() {
  try {
    const tweets = await fetchTweetsWithBackoff();
    return new Response(JSON.stringify({ success: true, tweets }), { status: 200 });
  } catch (error) {
    console.error("Failed to fetch tweets:", error);
    return new Response(JSON.stringify({ success: false, error: "Error fetching tweets" }), { status: 500 });
  }
}
