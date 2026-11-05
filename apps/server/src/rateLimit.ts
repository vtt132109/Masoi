/** Cửa sổ trượt đơn giản: tối đa `limit` lần trong `windowMs` cho mỗi khóa. */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Ghi nhận một lần và trả về true nếu còn trong hạn mức. */
  hit(key: string, now: number): boolean {
    const arr = this.prune(key, now);
    if (arr.length >= this.limit) return false;
    arr.push(now);
    return true;
  }

  /** Kiểm tra mà không ghi nhận. */
  allowed(key: string, now: number): boolean {
    return this.prune(key, now).length < this.limit;
  }

  record(key: string, now: number): void {
    this.prune(key, now).push(now);
  }

  private prune(key: string, now: number): number[] {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, arr);
    return arr;
  }

  sweep(now: number): void {
    for (const key of [...this.hits.keys()]) {
      if (this.prune(key, now).length === 0) this.hits.delete(key);
    }
  }
}

/** Xô token: cho phép bùng nổ ngắn nhưng giới hạn tốc độ trung bình. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
