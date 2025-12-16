/**
 * Rate Limiter - Generic rate limiting utility for API calls
 * 
 * Prevents excessive API calls by queuing requests and enforcing rate limits.
 * Uses a token bucket algorithm for smooth rate limiting.
 */

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
