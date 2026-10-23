import { calculatePercentage } from './percentage';

describe('calculatePercentage', () => {
  it('calculates users as a percentage of the combined total', () => {
    expect(calculatePercentage(20, 80)).toBe(20);
    expect(calculatePercentage(75, 25)).toBe(75);
  });

  it('handles zero totals and zero users', () => {
    expect(calculatePercentage(0, 0)).toBe(0);
    expect(calculatePercentage(0, 7)).toBe(0);
  });
});
