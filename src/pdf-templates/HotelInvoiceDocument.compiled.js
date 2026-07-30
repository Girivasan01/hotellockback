var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  HotelInvoiceDocument: () => HotelInvoiceDocument,
  default: () => stdin_default
});
module.exports = __toCommonJS(stdin_exports);
var import_jsx_runtime = require("react/jsx-runtime");
var import_react = __toESM(require("react"));
var import_renderer = require("@react-pdf/renderer");
const BORDER_COLOR = "#000000";
const INSTAGRAM_QR_PATH = "/insta_qr.jpeg";
const WEBSITE_QR_PATH = "/hotel_qr.jpeg";
const path = require("path");
const FONT_DIR = path.join(
  __dirname,
  "../../node_modules/@fontsource/poppins/files"
);
import_renderer.Font.register({
  family: "Poppins",
  fonts: [
    {
      src: path.join(FONT_DIR, "poppins-latin-400-normal.woff"),
      fontWeight: 400
    },
    {
      src: path.join(FONT_DIR, "poppins-latin-500-normal.woff"),
      fontWeight: 500
    },
    {
      src: path.join(FONT_DIR, "poppins-latin-600-normal.woff"),
      fontWeight: 600
    },
    {
      src: path.join(FONT_DIR, "poppins-latin-700-normal.woff"),
      fontWeight: 700
    },
    {
      src: path.join(FONT_DIR, "poppins-latin-400-italic.woff"),
      fontStyle: "italic",
      fontWeight: 400
    }
  ]
});
const styles = import_renderer.StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Poppins",
    fontSize: 9
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#ffffff",
    padding: 8,
    borderWidth: 1,
    borderColor: "#000000"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  headerRight: {
    alignItems: "center",
    justifyContent: "center"
  },
  headerQR: {
    width: 70,
    height: 70,
    objectFit: "contain",
    marginBottom: 4
  },
  headerQRLabel: {
    fontSize: 7,
    fontWeight: 600,
    textAlign: "center"
  },
  logo: {
    width: 120,
    height: 120,
    objectFit: "contain",
    marginRight: 10
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: "center"
  },
  hotelName: {
    fontSize: 17,
    fontWeight: 700,
    color: "#000000",
    marginBottom: 3
  },
  address: {
    fontSize: 8.5,
    color: "#000000",
    marginBottom: 2,
    lineHeight: 1.35
  },
  contact: {
    fontSize: 8.5,
    color: "#000000",
    marginBottom: 3,
    lineHeight: 1.35
  },
  gstBanner: {
    color: "#000000",
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontWeight: 600,
    fontSize: 9,
    marginTop: 4,
    alignSelf: "flex-start"
  },
  detailsContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 0
  },
  guestLeftBox: {
    flex: 0.4,
    padding: 8,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR,
    justifyContent: "center"
  },
  guestRightBox: {
    flex: 0.6
  },
  rightTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR
  },
  rightTableRowLast: {
    flexDirection: "row"
  },
  detailLabel: {
    width: "25%",
    padding: 4,
    fontWeight: 600,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR
  },
  detailValue: {
    width: "25%",
    padding: 4,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR
  },
  detailValueLast: {
    width: "25%",
    padding: 4
  },
  detailLabelSingle: {
    width: "25%",
    padding: 4,
    fontWeight: 600,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR
  },
  detailValueSingle: {
    width: "75%",
    padding: 4
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: BORDER_COLOR,
    marginBottom: 0
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR
  },
  tableRowLast: {
    flexDirection: "row"
  },
  col1: {
    width: "15%",
    padding: 5,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR,
    textAlign: "center"
  },
  col2: {
    width: "40%",
    padding: 5,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR
  },
  col3: {
    width: "15%",
    padding: 5,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR,
    textAlign: "right"
  },
  col4: {
    width: "15%",
    padding: 5,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR,
    textAlign: "right"
  },
  col5: {
    width: "15%",
    padding: 5,
    textAlign: "right"
  },
  colHeader: {
    fontWeight: 600
  },
  footer: {
    marginTop: 12
  },
  usersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    fontSize: 8
  },
  disclaimer: {
    fontSize: 8,
    textAlign: "justify",
    marginBottom: 20,
    fontStyle: "italic"
  },
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20
  },
  signatureBox: {
    width: "30%",
    borderTopWidth: 1,
    borderColor: BORDER_COLOR,
    textAlign: "center",
    paddingTop: 5,
    fontWeight: 600,
    fontSize: 10
  },
  boldText: {
    fontWeight: 600
  },
  qrSection: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    alignItems: "center"
  },
  qrContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    alignItems: "flex-start"
  },
  qrBox: {
    alignItems: "center"
  },
  qrImage: {
    width: 60,
    height: 60,
    marginBottom: 4,
    objectFit: "contain"
  },
  qrText: {
    fontSize: 8,
    textAlign: "center",
    fontWeight: 500
  }
});
const HotelInvoiceDocument = ({
  selectedBill,
  form,
  gstIncluded,
  gstRates,
  gstAmounts,
  subtotal,
  subtotalWithGst,
  totalAmount,
  advancePaid,
  balanceAmount,
  guestDiscount,
  gstNumber,
  formatIST,
  logoPath = path.join(__dirname, "../../assets/FridayInnLogo.png"),
  instagramQrPath = path.join(__dirname, "../../assets/insta_qr.jpeg"),
  websiteQrPath = path.join(__dirname, "../../assets/hotel_qr.jpeg")
}) => {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const getISTDateParts = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).formatToParts(date);
    const pick = (type) => parts.find((p) => p.type === type)?.value || "";
    return {
      day: pick("day"),
      month: pick("month"),
      year: pick("year"),
      hour: pick("hour"),
      minute: pick("minute"),
      dayPeriod: (pick("dayPeriod") || "").toLowerCase()
    };
  };
  const formatDateOnly = (value) => {
    const parts = getISTDateParts(value);
    if (!parts) return "N/A";
    return `${parts.day} ${parts.month} ${parts.year}`;
  };
  const formatDateTime = (value) => {
    const parts = getISTDateParts(value);
    if (!parts) return "N/A";
    return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
  };
  const billDateStr = formatDateTime(selectedBill?.created_at || /* @__PURE__ */ new Date());
  const checkInDateStr = (() => {
    const raw = selectedBill?.check_in || selectedBill?.booking_check_in;
    if (!raw) return "N/A";
    const dateOnly = String(raw).split("T")[0].split(" ")[0];
    if (!dateOnly) return "N/A";
    const [year, month, day] = dateOnly.split("-");
    const monthName = monthNames[Number(month) - 1] || month;
    return `${day} ${monthName} ${year}, 01:00 PM`;
  })();
  const checkOutStr = (() => {
    const rawDate = selectedBill?.check_out || selectedBill?.booking_check_out;
    if (!rawDate) return "N/A";
    const dateOnly = String(rawDate).split("T")[0].split(" ")[0];
    if (!dateOnly) return "N/A";
    const [year, month, day] = dateOnly.split("-");
    const monthName = monthNames[Number(month) - 1] || month;
    const billingTime = getISTDateParts(selectedBill?.created_at || /* @__PURE__ */ new Date());
    if (!billingTime) return `${day} ${monthName} ${year}`;
    return `${day} ${monthName} ${year}, 11:00 AM`;
  })();
  const numDays = (() => {
    const rawIn = selectedBill?.check_in || selectedBill?.booking_check_in;
    const rawOut = selectedBill?.check_out || selectedBill?.booking_check_out;
    if (!rawIn || !rawOut) return 1;
    const dateOnly = (s) => String(s).split("T")[0].split(" ")[0];
    const d1 = new Date(dateOnly(rawIn));
    const d2 = new Date(dateOnly(rawOut));
    if (isNaN(d1) || isNaN(d2)) return 1;
    return Math.max(Math.round((d2 - d1) / (1e3 * 60 * 60 * 24)), 1);
  })();
  const billNo = selectedBill?.bill_id || selectedBill?.id || "N/A";
  const roomCat = selectedBill?.category || "N/A";
  const pax = selectedBill?.pax || "2";
  const nationality = "Indian";
  const lineItemDateOnly = formatDateOnly(
    selectedBill?.check_out || selectedBill?.booking_check_out || selectedBill?.check_in || /* @__PURE__ */ new Date()
  );
  const roomPrice = Number(form?.room_price || 0);
  const savedAddOns = (selectedBill?.lines?.addon || []).map((a) => ({
    name: a.description || "Add-on",
    price: Number(a.total || 0),
    qty: Number(a.quantity || 1)
  }));
  const newAddOns = (Array.isArray(form?.add_ons) ? form.add_ons : []).map(
    (a) => ({
      name: a.name || a.label || "Add-on",
      price: Number(a.price || 0),
      qty: Number(a.qty || 1)
    })
  );
  const allAddOns = [...savedAddOns, ...newAddOns];
  let kitchenItems = [];
  if (selectedBill?.lines?.kitchen && Array.isArray(selectedBill.lines.kitchen)) {
    kitchenItems = selectedBill.lines.kitchen;
  }
  const roomGstAmount = Number(gstAmounts?.room || 0);
  const kitchenGstAmount = Number(gstAmounts?.kitchen || 0);
  const totalGstAmount = roomGstAmount + kitchenGstAmount;
  const roomGstPct = ((gstRates?.room || 0) * 100).toFixed(1);
  const kitchenGstPct = ((gstRates?.kitchen || gstRates?.room || 0) * 100).toFixed(1);
  const billedByName = selectedBill?.billed_by_name || selectedBill?.billed_by?.name || selectedBill?.created_by_name || "Staff/Admin";
  const billedByRoleRaw = selectedBill?.billed_by_role || selectedBill?.billed_by?.role || selectedBill?.created_by_role || "";
  const billedByRole = billedByRoleRaw ? `${billedByRoleRaw.charAt(0).toUpperCase()}${billedByRoleRaw.slice(1)}` : "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Document, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Page, { size: "A4", style: styles.page, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.headerContainer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.headerLeft, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Image, { style: styles.logo, src: logoPath }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.headerTextContainer, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.hotelName, children: "Hotel Friday Inn" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.address, children: [
            "D.NO 307 ASAMBUR TO MANJAKUTTAI ROAD,",
            "\n",
            "ASAMBUR VILLAGE, YERCAUD - 636602,",
            "\n",
            "TAMIL NADU, INDIA."
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.contact, children: "Call: +91 6369469094 | +91 9489690022 | 04281-290001." }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.gstBanner, children: [
            "GST NO:",
            " ",
            selectedBill?.category === "A frame wooden villa AC" ? "33AMQPK7880E2ZO" : "33AMQPK7880E1ZP"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.headerRight, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Image, { style: styles.headerQR, src: instagramQrPath }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.headerQRLabel, children: "Follow us on" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.headerQRLabel, children: "Instagram" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.detailsContainer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.guestLeftBox, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.boldText, children: "Name:" }),
          " ",
          selectedBill?.customer_name || "Guest"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: { marginTop: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.boldText, children: "Address:" }),
          " ",
          selectedBill?.customer_address || selectedBill?.customer_location || "N/A"
        ] }),
        gstNumber && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: { marginTop: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.boldText, children: "Guest GST:" }),
          " ",
          gstNumber
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.guestRightBox, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.rightTableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabelSingle, children: "Date" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValueSingle, children: billDateStr })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.rightTableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabel, children: "Room" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValue, children: selectedBill?.room_number || "N/A" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabel, children: "Pax" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValueLast, children: pax })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.rightTableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabel, children: "Type" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValue, children: roomCat }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabel, children: "Nationality" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValueLast, children: nationality })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.rightTableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabelSingle, children: "Check In" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValueSingle, children: checkInDateStr })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.rightTableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabelSingle, children: "Check Out" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValueSingle, children: checkOutStr })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.rightTableRowLast, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabel, children: "No. of Days" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValue, children: numDays }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailLabel, children: "Bill No" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.detailValueLast, children: billNo })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.table, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableHeader, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col1, styles.colHeader], children: "DATE" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col2, styles.colHeader], children: "DESCRIPTION" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col3, styles.colHeader], children: "DEBIT" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col4, styles.colHeader], children: "CREDIT" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col5, styles.colHeader], children: "AMOUNT" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1, children: lineItemDateOnly }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col2, children: "Room Tariff" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3, children: roomPrice.toFixed(2) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4, children: "0.00" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: roomPrice.toFixed(2) })
      ] }),
      kitchenItems.map((item, i) => {
        const itemTotal = Number(item.subtotal || item.total || 0);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1, children: lineItemDateOnly }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.col2, children: [
            item.description || item.name,
            " (Qty:",
            " ",
            item.quantity || item.qty,
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3, children: itemTotal.toFixed(2) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4, children: "0.00" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: itemTotal.toFixed(2) })
        ] }, `kitchen-${i}`);
      }),
      allAddOns.map((addon, i) => {
        const addonTotal = Number(addon.price) * Number(addon.qty);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1, children: lineItemDateOnly }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.col2, children: [
            addon.name,
            " (Qty: ",
            addon.qty,
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3, children: addonTotal.toFixed(2) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4, children: "0.00" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: addonTotal.toFixed(2) })
        ] }, `addon-${i}`);
      }),
      gstIncluded && roomGstAmount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1, children: lineItemDateOnly }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.col2, children: [
          "Room Tariff GST (",
          roomGstPct,
          "%)"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3, children: roomGstAmount.toFixed(2) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4, children: "0.00" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: roomGstAmount.toFixed(2) })
      ] }),
      gstIncluded && kitchenGstAmount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1, children: lineItemDateOnly }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.col2, children: [
          "Kitchen Orders GST (",
          kitchenGstPct,
          "%)"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3, children: kitchenGstAmount.toFixed(2) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4, children: "0.00" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: kitchenGstAmount.toFixed(2) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_renderer.Text,
          {
            style: [styles.col2, styles.boldText, { textAlign: "right" }],
            children: "Total INR"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col5, styles.boldText], children: Number(totalAmount || 0).toFixed(2) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_renderer.Text,
          {
            style: [styles.col5, styles.boldText, { textAlign: "right" }],
            children: "Gross Value"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: Number(totalAmount || 0).toFixed(2) })
      ] }),
      gstIncluded && totalGstAmount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_renderer.Text,
          {
            style: [styles.col2, styles.boldText, { textAlign: "right" }],
            children: "Tax Amount"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: totalGstAmount.toFixed(2) })
      ] }),
      guestDiscount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_renderer.Text,
          {
            style: [styles.col2, styles.boldText, { textAlign: "right" }],
            children: "Guest Discount"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.col5, children: [
          "-",
          Number(guestDiscount || 0).toFixed(2)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_renderer.Text,
          {
            style: [styles.col2, styles.boldText, { textAlign: "right" }],
            children: "Advance Paid"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col5, children: Number(advancePaid || 0).toFixed(2) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.tableRowLast, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_renderer.Text,
          {
            style: [styles.col2, styles.boldText, { textAlign: "right" }],
            children: "BILL TOTAL"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col3 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.col4 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: [styles.col5, styles.boldText], children: Number(balanceAmount || 0).toFixed(2) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.usersRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.boldText, children: "Billed By:" }),
          " ",
          billedByName,
          billedByRole ? ` (${billedByRole})` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, {})
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.Text, { style: styles.disclaimer, children: [
        "May we request you to return the room key.",
        "\n",
        "I agree that my liability for this bill is not waived and I agree to be held personally liable in the event that the indicated person, company or association fails to pay for any part or the full amount of these charges."
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.signaturesRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.signatureBox, children: "Authorized Signature" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.signatureBox, children: "Guest Signature" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.View, { style: styles.qrSection, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.View, { style: styles.qrContainer, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_renderer.View, { style: styles.qrBox, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Image, { style: styles.qrImage, src: websiteQrPath }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_renderer.Text, { style: styles.qrText, children: "Visit our Website" })
      ] }) }) })
    ] })
  ] }) });
};
var stdin_default = HotelInvoiceDocument;
