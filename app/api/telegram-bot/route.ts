import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

let tweetHistory: Tweet[] = [];  // In-memory array to store fetched tweets

// Type definitions
type Tweet = {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
};

type Meta = {
  newest_id: string;
  oldest_id: string;
  result_count: number;
  next_token: string;
};

type TwitterApiResponse = {
  data: Tweet[];
  meta: Meta;
};

// Function to fetch tweets with the correct query parameters
async function fetchTweets() {
  try {
    console.log("Starting to fetch tweets...");

    const query = "airdrop";  // Search query
    const maxResults = 10;    // Number of tweets to return
    const url = new URL(TWITTER_SEARCH_URL);
    
    // Append query parameters to the URL
    url.searchParams.append("query", query);
    url.searchParams.append("max_results", maxResults.toString());

    console.log("Generated URL for fetching tweets:", url.toString());

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
      },
    });

    console.log("Received response from Twitter API:", response);

    if (!response.ok) {
      console.error("Error fetching tweets. Status:", response.status, response.statusText);
      throw new Error(`Error fetching tweets: ${response.statusText}`);
    }

    const data: TwitterApiResponse = await response.json();

    console.log("Fetched data:", JSON.stringify(data, null, 2));

    // Log the 'meta' details (pagination and result count)
    if (data.meta) {
      console.log("Pagination info:", data.meta);
      console.log("Newest tweet ID:", data.meta.newest_id);
      console.log("Oldest tweet ID:", data.meta.oldest_id);
      console.log("Total result count:", data.meta.result_count);
      console.log("Next token for pagination:", data.meta.next_token);
    }

    // Log the tweet text and details
    data.data.forEach(tweet => {
      console.log(`Tweet ID: ${tweet.id}`);
      console.log(`Tweet Text: ${tweet.text}`);
    });

    return data;
  } catch (error: any) {
    console.error("Error fetching tweets:", error, error.message);
    throw new Error("Failed to fetch tweets");
  }
}

// Function to retry fetching tweets every 15 minutes
async function retryFetchTweets() {
  let attempt = 0;
  while (attempt < 3) {
    try {
      console.log(`Attempt ${attempt + 1} to fetch tweets...`);

      const tweets = await fetchTweets();
      tweetHistory = [...tweetHistory, ...tweets.data];  // Append new tweets to the history

      console.log("Tweets fetched successfully:", JSON.stringify(tweets.data, null, 2));
      break;
    } catch (error: any) {
      attempt++;
      console.error(`Attempt ${attempt}: ${error.message}`);

      if (attempt < 3) {
        console.log("Retrying in 15 minutes...");
        await new Promise(resolve => setTimeout(resolve, 900000));  // 15 minutes
      } else {
        console.error("Failed to fetch tweets after 3 attempts");
      }
    }
  }
}

export async function GET() {
  console.log("Starting GET request...");

  try {
    // Retry logic for fetching tweets
    await retryFetchTweets();

    // Returning accumulated tweets as a JSON response
    console.log("Returning response with tweets...");
    return Response.json({
      success: true,
      data: tweetHistory,
      message: "Tweets fetched successfully",
    });
  } catch (error: any) {
    console.error("Error handling GET request:", error.message);
    return Response.json({
      success: false,
      message: "Error fetching tweets",
    });
  }
}
