// Hotel GST Number
const HOTEL_GST_NUMBER = "33AMQPK7880E2ZO";

const DEFAULT_GST_RATES = {
  room: 0.05,     // 5% flat for all room prices
  kitchen: 0.05,  // 5% fixed
  addon: 0,       // add-ons are non-taxable
};

/**
 * Compute GST for amount based on type
 */
function computeGST(type, amount) {
  const rate = DEFAULT_GST_RATES[type];
  if (!rate) return { gst: 0, total: amount };

  const gst = amount * rate;
  return {
    gst_rate: rate,
    gst_amount: Number(gst.toFixed(2)),
    total: Number((amount + gst).toFixed(2)),
  };
}

module.exports = {
  HOTEL_GST_NUMBER,
  DEFAULT_GST_RATES,
  computeGST,
};