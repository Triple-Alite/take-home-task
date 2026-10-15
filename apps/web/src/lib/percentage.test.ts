import { calculatePercentage } from './percentage';

describe('calculatePercentage', () => {
  it('calculates products per user to one decimal place', () => {
    expect(calculatePercentage(24, 7)).toBe(29.2);
  });

  it('handles a zero denominator', () => {
    expect(calculatePercentage(0, 7)).toBe(0);
  });
});
