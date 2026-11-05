import { describe, expect, it } from 'vitest';
import { formatClock, joinNames } from './format';

describe('format', () => {
  it('đồng hồ mm:ss, làm tròn lên và không âm', () => {
    expect(formatClock(75_000)).toBe('1:15');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(500)).toBe('0:01');
    expect(formatClock(-5)).toBe('0:00');
  });
  it('nối tên', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['An'])).toBe('An');
    expect(joinNames(['An', 'Bình'])).toBe('An và Bình');
    expect(joinNames(['An', 'Bình', 'Chi'])).toBe('An, Bình và Chi');
  });
});
