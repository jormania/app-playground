/**
 * Mathematical utilities for calculating data trends.
 */

/**
 * Calculates a simple moving average over the given period.
 * For the first few elements where a full period isn't available,
 * it calculates a partial average up to that point.
 * 
 * @param {number[]} data - The array of data points.
 * @param {number} period - The window size for the moving average.
 * @returns {number[]} The smoothed data array.
 */
export function calculateMovingAverage(data, period = 3) {
  if (!data || data.length === 0) return [];
  const result = new Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - period + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) {
      sum += data[j];
    }
    result[i] = sum / (i - start + 1);
  }
  
  return result;
}

/**
 * Calculates the line of best fit (y = mx + b) using the least squares method.
 * 
 * @param {number[]} data - The array of data points.
 * @returns {number[]} The points representing the linear regression line.
 */
export function calculateLinearRegression(data) {
  if (!data || data.length === 0) return [];
  if (data.length === 1) return [...data];

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = data.length;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += (i * data[i]);
    sumXX += (i * i);
  }

  const denominator = (n * sumXX) - (sumX * sumX);
  
  // Fallback if denominator is 0 (should not happen with sequential indices)
  if (denominator === 0) return [...data];

  const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
  const intercept = (sumY - (slope * sumX)) / n;

  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = (slope * i) + intercept;
  }
  
  return result;
}
