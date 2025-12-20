/**
 * =============================================================================
 * RATE LIMITER - Preventing Too Many API Calls
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file helps us avoid making too many requests to external APIs.
 * When you browse the web, every page might need to check the ToS;DR database
 * or other services. Without rate limiting, we might overwhelm these services
 * and get blocked!
 * 
 * HOW IT WORKS - THE "TOKEN BUCKET" ALGORITHM:
 * Imagine a bucket that can hold a certain number of tokens (like arcade tokens).
 * - Each API call "spends" one token
 * - The bucket slowly refills over time
 * - If the bucket is empty, requests must wait until tokens refill
 * 
 * EXAMPLE:
 * If we allow 10 requests per minute:
 * - We start with 10 tokens
 * - Each request uses 1 token
 * - Every 6 seconds, we get 1 token back (10 tokens / 60 seconds = ~6s per token)
 * - If all tokens are used, new requests queue up and wait
 * 
 * WHY THIS MATTERS:
 * - Prevents us from getting blocked by external services
 * - Keeps the extension running smoothly
 * - Respects the resources of free APIs we depend on
 * =============================================================================
 */

/**
 * Configuration options for creating a rate limiter.
 */
interface RateLimiterConfig {
    maxRequestsPerMinute: number;  // How many requests allowed per minute
    queueSize?: number;            // Max requests that can wait in line (default: 100)
}

/**
 * Represents a request waiting in the queue.
 */
interface QueuedRequest<T> {
    execute: () => Promise<T>;     // The function to run
    resolve: (value: T) => void;   // Success callback
    reject: (error: any) => void;  // Error callback
    timestamp: number;             // When this request was queued
}

interface RateLimiterConfig {
    maxRequestsPerMinute: number;
    queueSize?: number; // Max queued requests (default: 100)
}

interface QueuedRequest<T> {
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
    timestamp: number;
}

export class RateLimiter {
    private config: RateLimiterConfig;
    private queue: QueuedRequest<any>[] = [];
    private tokens: number;
    private lastRefill: number;
    private processing: boolean = false;

    constructor(config: RateLimiterConfig) {
        this.config = {
            queueSize: 100,
            ...config
        };
        this.tokens = config.maxRequestsPerMinute;
        this.lastRefill = Date.now();
    }

    /**
     * Execute a function with rate limiting
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            // Check queue size
            if (this.queue.length >= (this.config.queueSize || 100)) {
                reject(new Error('Rate limiter queue is full'));
                return;
            }

            // Add to queue
            this.queue.push({
                execute: fn,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // Start processing if not already running
            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    /**
     * Process queued requests
     */
    private async processQueue(): Promise<void> {
        this.processing = true;

        while (this.queue.length > 0) {
            // Refill tokens based on time elapsed
            this.refillTokens();

            // If we have tokens, process next request
            if (this.tokens >= 1) {
                const request = this.queue.shift();
                if (!request) break;

                this.tokens -= 1;

                try {
                    const result = await request.execute();
                    request.resolve(result);
                } catch (error) {
                    request.reject(error);
                }
            } else {
                // Wait until we can refill tokens
                const waitTime = this.getWaitTime();
                await this.sleep(waitTime);
            }
        }

        this.processing = false;
    }

    /**
     * Refill tokens based on time elapsed
     */
    private refillTokens(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = (elapsed / 60000) * this.config.maxRequestsPerMinute;

        if (tokensToAdd >= 1) {
            this.tokens = Math.min(
                this.config.maxRequestsPerMinute,
                this.tokens + Math.floor(tokensToAdd)
            );
            this.lastRefill = now;
        }
    }

    /**
     * Calculate wait time until next token is available
     */
    private getWaitTime(): number {
        const tokensNeeded = 1 - this.tokens;
        const msPerToken = 60000 / this.config.maxRequestsPerMinute;
        return Math.ceil(tokensNeeded * msPerToken);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current queue size
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Get available tokens
     */
    getAvailableTokens(): number {
        this.refillTokens();
        return this.tokens;
    }

    /**
     * Clear the queue
     */
    clearQueue(): void {
        this.queue.forEach(req => {
            req.reject(new Error('Queue cleared'));
        });
        this.queue = [];
    }
}

/**
 * Pre-configured rate limiters for different APIs
 */
export const rateLimiters = {
    tosdr: new RateLimiter({ maxRequestsPerMinute: 10 }),
    safeBrowsing: new RateLimiter({ maxRequestsPerMinute: 20 }),
    phishTank: new RateLimiter({ maxRequestsPerMinute: 5 })
};
