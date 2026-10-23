'use strict';

const MAX_COUNT = 10_000_000;

function calculatePercentage(numberOfUsers, numberOfProducts) {
  for (const count of [numberOfUsers, numberOfProducts]) {
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_COUNT) {
      throw new RangeError(`Counts must be integers from 0 to ${MAX_COUNT}`);
    }
  }

  const total = numberOfUsers + numberOfProducts;
  if (total === 0) return 0;
  return Math.round((numberOfUsers / total) * 1000) / 10;
}

module.exports = { calculatePercentage, MAX_COUNT };
