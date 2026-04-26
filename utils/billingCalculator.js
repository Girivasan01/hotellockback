const { DEFAULT_GST_RATES } = require("./billingUtils");

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const extractDatePart = (datetimeStr) => {
  if (!datetimeStr) return null;
  return String(datetimeStr).replace("T", " ").slice(0, 10);
};

const daysBetween = (startDatetimeStr, endDatetimeStr) => {
  const startStr = extractDatePart(startDatetimeStr);
  const endStr = extractDatePart(endDatetimeStr);

  if (!startStr || !endStr) return 1;

  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);

  const msPerDay = 1000 * 60 * 60 * 24;
  const startMs = new Date(sy, sm - 1, sd).getTime();
  const endMs = new Date(ey, em - 1, ed).getTime();

  return Math.max(Math.round((endMs - startMs) / msPerDay), 1);
};

const getRoomGstRate = (roomRatePerNight = 0) =>
  Number(roomRatePerNight || 0) > DEFAULT_GST_RATES.room.threshold
    ? DEFAULT_GST_RATES.room.high
    : DEFAULT_GST_RATES.room.low;

const getGstRateForType = (type, { roomRatePerNight = 0 } = {}) => {
  if (type === "room") {
    return getRoomGstRate(roomRatePerNight);
  }

  const rate = DEFAULT_GST_RATES[type];
  return typeof rate === "object" ? rate.low : Number(rate || 0);
};

const computeGstAmount = (type, taxableAmount, options = {}) => {
  const rate = getGstRateForType(type, options);
  return {
    rate,
    amount: roundMoney(Number(taxableAmount || 0) * rate),
  };
};

const calculateBillingTotals = ({
  checkIn,
  checkOut,
  stayDays,
  roomRate,
  roomRatePerNight,
  roomTotal,
  kitchenTotal = 0,
  addonTotal = 0,
  discount = 0,
  advancePaid = 0,
} = {}) => {
  const resolvedStayDays =
    stayDays !== undefined && stayDays !== null
      ? Math.max(Number(stayDays) || 1, 1)
      : daysBetween(checkIn, checkOut);

  const resolvedRoomRatePerNight =
    roomRatePerNight !== undefined && roomRatePerNight !== null
      ? Number(roomRatePerNight || 0)
      : roomRate !== undefined && roomRate !== null
      ? Number(roomRate || 0)
      : resolvedStayDays > 0
      ? Number(roomTotal || 0) / resolvedStayDays
      : Number(roomTotal || 0);

  const resolvedRoomTotal =
    roomTotal !== undefined && roomTotal !== null
      ? Number(roomTotal || 0)
      : resolvedRoomRatePerNight * resolvedStayDays;

  const resolvedKitchenTotal = Number(kitchenTotal || 0);
  const resolvedAddonTotal = Number(addonTotal || 0);
  const resolvedDiscount = roundMoney(discount);
  const resolvedAdvancePaid = roundMoney(advancePaid);

  const roomGst = computeGstAmount("room", resolvedRoomTotal, {
    roomRatePerNight: resolvedRoomRatePerNight,
  });
  const kitchenGst = computeGstAmount("kitchen", resolvedKitchenTotal);
  const addonGst = computeGstAmount("addon", resolvedAddonTotal);

  const subtotal = roundMoney(
    resolvedRoomTotal + resolvedKitchenTotal + resolvedAddonTotal
  );
  const gstAmount = roundMoney(
    roomGst.amount + kitchenGst.amount + addonGst.amount
  );
  const totalAmount = roundMoney(subtotal + gstAmount);
  const finalPayable = roundMoney(
    totalAmount - resolvedDiscount - resolvedAdvancePaid
  );

  return {
    stayDays: resolvedStayDays,
    roomRatePerNight: roundMoney(resolvedRoomRatePerNight),
    roomTotal: roundMoney(resolvedRoomTotal),
    kitchenTotal: roundMoney(resolvedKitchenTotal),
    addonTotal: roundMoney(resolvedAddonTotal),
    subtotal,
    gstAmount,
    totalAmount,
    grossTotal: totalAmount,
    discount: resolvedDiscount,
    advancePaid: resolvedAdvancePaid,
    finalPayable,
    finalAmount: finalPayable,
    balanceAmount: finalPayable,
    gstRates: {
      room: roomGst.rate,
      kitchen: kitchenGst.rate,
      addon: addonGst.rate,
    },
    gstBreakdown: {
      room: roomGst.amount,
      kitchen: kitchenGst.amount,
      addon: addonGst.amount,
    },
  };
};

module.exports = {
  roundMoney,
  extractDatePart,
  daysBetween,
  getRoomGstRate,
  getGstRateForType,
  calculateBillingTotals,
};
