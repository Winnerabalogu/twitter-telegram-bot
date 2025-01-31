// app/api/telegram-bot/route.ts

import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;  // Your Telegram bot token
const CHAT_ID = process.env.CHAT_ID;  // Your chat ID where you want to send the tweets

// Function to send messages to Telegram
async function sendMessageToTelegram(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const params = {
    chat_id: CHAT_ID,
    text: message,
  };

  try {
    await axios.post(url, params);
    console.log("Message sent to Telegram successfully");
  } catch (error) {
    console.error("Error sending message to Telegram:", error);
  }
}

// Function to fetch tweets with backoff
async function fetchTweetsWithBackoff(attempt = 1) {
  try {
    const response = await axios.get(
      "https://api.twitter.com/2/tweets/search/recent",
      {
        params: {
          query: "airdrop",  // Simpler query for testing
          max_results: 5,
        },
        headers: {
          Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    const tweets = response.data.data;
    if (tweets) {
      for (const tweet of tweets) {
        const message = `New Tweet: \n\n${tweet.text}\n\nLink: https://twitter.com/twitter/status/${tweet.id}`;
        await sendMessageToTelegram(message);
      }
    }
    return tweets;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response && error.response.status === 429) {
        const retryAfter = error.response.headers["retry-after"];
        const resetTime = error.response.headers["x-ratelimit-reset"];
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        let delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;

        if (resetTime) {
          // Wait until the rate limit resets
          const waitTime = Math.max(0, resetTime - currentTime) * 1000;
          delay = waitTime > delay ? waitTime : delay;
        }

        console.log(`Rate limit exceeded. Retrying after ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchTweetsWithBackoff(attempt + 1); // Retry with increased attempt count
      } else {
        // Handle other potential errors
        console.error("Error response from Axios:", error.response);
        throw error;
      }
    } else {
      console.error("Unknown error:", error);
      throw error;
    }
  }
}

// Export GET method
export async function GET() {
  try {
    const tweets = await fetchTweetsWithBackoff();  // Fetch tweets
    return new Response(JSON.stringify(tweets), { status: 200 }); // Send response with fetched tweets
  } catch (error) {
    return new Response("Error fetching tweets", { status: 500 });
  }
}
