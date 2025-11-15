import axios, { AxiosError } from "axios";

export type PricePoint = {
  timestamp: number;
  price: number;
};

const COINGECKO_ENDPOINT =
  "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart";

// Rate limiting: CoinGecko free tier allows 5-15 calls per minute
// Cache request timestamps to ensure we don't exceed limits
// Using conservative 2-minute interval to avoid rate limits
let lastRequestTime: number = 0;
const MIN_REQUEST_INTERVAL = 120000; // 120 seconds (2 minutes) - conservative to avoid rate limits
const MAX_RETRIES = 2; // Reduced retries to avoid hitting rate limit on retries
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

// Simple rate limiter - ensures at least 2 minutes between requests
const waitForRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(
      `Rate limiting: Waiting ${waitTime}ms before next CoinGecko request`
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

// Exponential backoff retry helper
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_RETRY_DELAY
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }

    const axiosError = error as AxiosError;

    // Check if it's a rate limit error (429)
    if (axiosError.response?.status === 429) {
      const retryAfter = axiosError.response.headers["retry-after"];
      // Use retry-after header if available, otherwise wait at least 2 minutes
      const waitTime = retryAfter
        ? Math.max(parseInt(retryAfter) * 1000, MIN_REQUEST_INTERVAL)
        : MIN_REQUEST_INTERVAL;

      console.warn(
        `Rate limited by CoinGecko. Waiting ${waitTime}ms before retry...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      // Update lastRequestTime to prevent immediate subsequent requests
      lastRequestTime = Date.now();
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }

    // For other errors, use exponential backoff
    if (retries > 0) {
      console.warn(
        `CoinGecko request failed. Retrying in ${delay}ms... (${retries} retries left)`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }

    throw error;
  }
};

export const fetchDailyBtcHistory = async (): Promise<PricePoint[]> => {
  // Wait for rate limit before making request
  await waitForRateLimit();

  return retryWithBackoff(async () => {
    try {
      const response = await axios.get(COINGECKO_ENDPOINT, {
        params: {
          vs_currency: "usd",
          days: 0.020833, // 30 minutes (30/1440 = 0.020833 days)
        },
        timeout: 10000, // 10 second timeout
        headers: {
          Accept: "application/json",
        },
      });

      const prices: [number, number][] = response.data?.prices ?? [];

      if (!prices || prices.length === 0) {
        console.warn("CoinGecko returned empty price data");
        return [];
      }

      return prices.map(([timestamp, price]) => ({
        timestamp,
        price,
      }));
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 429) {
        console.error("CoinGecko rate limit exceeded:", {
          status: axiosError.response.status,
          retryAfter: axiosError.response.headers["retry-after"],
        });
        throw new Error(
          "Rate limited by CoinGecko. Please wait a moment and try again."
        );
      }

      if (axiosError.code === "ECONNABORTED") {
        console.error("CoinGecko request timeout");
        throw new Error("Request to CoinGecko timed out. Please try again.");
      }

      console.error("Error fetching BTC price history from CoinGecko:", {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      throw error;
    }
  });
};
