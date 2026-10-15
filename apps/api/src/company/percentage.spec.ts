import { calculatePercentage } from './percentage';

describe('calculatePercentage', () => {
  it('returns products per user as a rounded percentage', () => {
    expect(calculatePercentage(24, 7)).toBe(29.2);
  });

  it('returns zero when there are no users', () => {
    expect(calculatePercentage(0, 12)).toBe(0);
  });
});
