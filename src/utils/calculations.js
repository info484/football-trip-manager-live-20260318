function parseMoney(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function calculateAmount({ attendance, packageType, match, manualAmount }) {
  const manual = parseMoney(manualAmount);
  if (manual !== null) {
    return manual;
  }

  if (attendance === "absent") {
    return 0;
  }

  const price = packageType === "all_in" ? match.all_in_price : match.bus_price;
  return Number(price);
}

function defaultPaymentStatus(paymentMethod, currentValue) {
  if (currentValue) {
    return currentValue;
  }

  return paymentMethod === "cash" ? "paid" : "open";
}

module.exports = {
  calculateAmount,
  defaultPaymentStatus,
  parseMoney,
};
