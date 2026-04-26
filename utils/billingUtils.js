/**
 * Billing utilities and constants for backend
 */

// Hotel GST Number
const HOTEL_GST_NUMBER = "33AMQPK7880E1ZP";

// Default GST rates
const DEFAULT_GST_RATES = {
  room: {
    low: 0.05, // 5% for room price <= 7500
    high: 0.18, // 18% for room price > 7500
    threshold: 7500, // Threshold for applying higher rate
  },
  kitchen: 0.05, // 5% fixed
  addon: 0, // add-ons are non-taxable
};

/**
 * Compute GST for amount based on type
 */
function computeGST(type, amount) {
  const rate = DEFAULT_GST_RATES[type];
  if (!rate) return { gst: 0, total: amount };
  
  const gstRate = typeof rate === 'object' 
    ? amount > rate.threshold ? rate.high : rate.low 
    : rate;
  
  const gst = amount * gstRate;
  return { 
    gst_rate: gstRate,
    gst_amount: Number(gst.toFixed(2)), 
    total: Number((amount + gst).toFixed(2))
  };
}

module.exports = {
  HOTEL_GST_NUMBER,
  DEFAULT_GST_RATES,
  computeGST
};

