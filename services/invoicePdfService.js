const React = require("react");
const path = require("path");
const fs = require("fs");
const { renderToBuffer } = require("@react-pdf/renderer");
const { buildInvoicePdfProps } = require("../utils/invoicePdfProps");

const COMPILED_PATH = path.join(
  __dirname,
  "../src/pdf-templates/HotelInvoiceDocument.compiled.js",
);

let documentModule;

function loadHotelInvoiceDocument() {
  if (documentModule) return documentModule;

  if (!fs.existsSync(COMPILED_PATH)) {
    throw new Error(
      "HotelInvoiceDocument.compiled.js not found. Run `node scripts/buildInvoiceTemplate.js` " +
        "(or `npm run build:pdf-templates`) after editing HotelInvoiceDocument.jsx, and make sure " +
        "the compiled file is committed/deployed."
    );
  }

  documentModule = require(COMPILED_PATH);
  return documentModule;
}

async function generateInvoicePdfBuffer(invoiceData) {
  const { HotelInvoiceDocument } = loadHotelInvoiceDocument();
  const props = buildInvoicePdfProps(invoiceData);
  const element = React.createElement(HotelInvoiceDocument, props);
  return renderToBuffer(element);
}

module.exports = { generateInvoicePdfBuffer };