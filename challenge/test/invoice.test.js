import test from "node:test";
import assert from "node:assert/strict";
import { lineTotal, subtotal, tax, shipping, orderTotal } from "../src/invoice.js";

test("line total applies the percentage discount in whole cents", () => {
  assert.equal(lineTotal(1999, 3, 15), 5097);
});

test("line total with no discount", () => {
  assert.equal(lineTotal(1250, 2), 2500);
});

test("subtotal sums discounted lines", () => {
  const lines = [
    { unitPriceCents: 1999, quantity: 3, discountPct: 15 },
    { unitPriceCents: 450, quantity: 1, discountPct: 0 },
  ];
  assert.equal(subtotal(lines), 5547);
});

test("subtotal of an empty order is zero", () => {
  assert.equal(subtotal([]), 0);
});

test("tax is charged on the discounted subtotal", () => {
  const lines = [{ unitPriceCents: 10000, quantity: 1, discountPct: 10 }];
  assert.equal(tax(lines), 743);
});

test("shipping is free exactly at the threshold", () => {
  const lines = [{ unitPriceCents: 5000, quantity: 1, discountPct: 0 }];
  assert.equal(shipping(lines), 0);
});

test("shipping is charged below the threshold", () => {
  const lines = [{ unitPriceCents: 4999, quantity: 1, discountPct: 0 }];
  assert.equal(shipping(lines), 599);
});

test("order total adds subtotal, tax and shipping", () => {
  const lines = [{ unitPriceCents: 4999, quantity: 1, discountPct: 0 }];
  assert.equal(orderTotal(lines), 4999 + 412 + 599);
});
