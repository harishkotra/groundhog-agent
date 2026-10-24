// Invoice totals for a small storefront.
// Prices are in cents. Discounts apply per line, before tax.

const TAX_RATE = 0.0825;
const FREE_SHIPPING_OVER_CENTS = 5000;
const SHIPPING_CENTS = 599;

/**
 * Line total in cents after the line's percentage discount.
 * discountPct is a whole number, eg 15 means 15% off.
 */
export function lineTotal(unitPriceCents, quantity, discountPct = 0) {
  const gross = unitPriceCents * quantity;
  const discount = Math.round((gross * discountPct) / 100);
  return gross - discount;
}

/**
 * Sum of all lines, in cents.
 */
export function subtotal(lines) {
  return lines.reduce(
    (sum, line) => sum + lineTotal(line.unitPriceCents, line.quantity, line.discountPct),
    0
  );
}

/**
 * Tax in cents, rounded to the nearest cent.
 */
export function tax(lines) {
  return Math.round(subtotal(lines) * TAX_RATE);
}

/**
 * Shipping in cents. Free when the discounted subtotal clears the threshold.
 */
export function shipping(lines) {
  return subtotal(lines) > FREE_SHIPPING_OVER_CENTS ? 0 : SHIPPING_CENTS;
}

/**
 * Order total in cents.
 */
export function orderTotal(lines) {
  return subtotal(lines) + tax(lines) + shipping(lines);
}
