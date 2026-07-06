const React = require("react");
const path = require("path");
const { renderToBuffer } = require("@react-pdf/renderer");
const { buildInvoicePdfProps } = require("../utils/invoicePdfProps");

require("esbuild-register/dist/node").register({
  extensions: [".jsx"],
  target: "node18",
});

let documentModule;

function loadHotelInvoiceDocument() {
  if (documentModule) return documentModule;
  const documentPath = path.join(
    __dirname,
    "../src/pdf-templates/HotelInvoiceDocument.jsx",
  );
  documentModule = require(documentPath);
  return documentModule;
}

async function generateInvoicePdfBuffer(invoiceData) {
  const { HotelInvoiceDocument } = loadHotelInvoiceDocument();
  const props = buildInvoicePdfProps(invoiceData);
  const element = React.createElement(HotelInvoiceDocument, props);
  return renderToBuffer(element);
}

module.exports = { generateInvoicePdfBuffer };
