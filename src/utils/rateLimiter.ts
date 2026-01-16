export class LeakyBucket {
    private capacity: number;
    private tokens: number;
    private lastLeak: number;
    private leakRate: number; // tokens per ms

    constructor(capacity: number, leakRatePerSecond: number) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.leakRate = leakRatePerSecond / 1000;
        this.lastLeak = Date.now();
    }

    async throttle(): Promise<void> {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // Calculate throttle time needed
        const missingTokens = 1 - this.tokens;
        const waitTime = missingTokens / this.leakRate;

        // Wait and retry (simple recursive approach or just sleep)
        // For simplicity in DO: sleep.
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Recalculate after sleep
        this.refill();
        this.tokens -= 1; // Assume we have it now (simplified)
    }

    private refill() {
        const now = Date.now();
        const delta = now - this.lastLeak;
        const leakAmount = delta * this.leakRate;

        this.tokens = Math.min(this.capacity, this.tokens + leakAmount);
        this.lastLeak = now;
    }
}
