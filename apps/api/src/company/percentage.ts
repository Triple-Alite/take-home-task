export function calculatePercentage(userCount: number, productCount: number): number {
  if (userCount <= 0) return 0;
  return Math.round((productCount / userCount) * 1000) / 10;
}
