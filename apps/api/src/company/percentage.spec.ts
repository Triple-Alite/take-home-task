import { calculatePercentage } from './percentage';

describe('calculatePercentage', () => {
  it('calculates users as a share of users and products', () => {
    expect(calculatePercentage(20, 80)).toBe(20);
    expect(calculatePercentage(75, 25)).toBe(75);
  });

  it('returns zero when the total is zero or there are no users', () => {
    expect(calculatePercentage(0, 0)).toBe(0);
    expect(calculatePercentage(0, 12)).toBe(0);
  });

  it('rejects negative, fractional, and over-limit counts', () => {
    expect(() => calculatePercentage(-1, 0)).toThrow(RangeError);
    expect(() => calculatePercentage(1.5, 0)).toThrow(RangeError);
    expect(() => calculatePercentage(10_000_001, 0)).toThrow(RangeError);
  });
});
