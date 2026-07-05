const React = require("react");
const path = require("path");
const Module = require("module");
const { renderToBuffer } = require("@react-pdf/renderer");
const { buildInvoicePdfProps } = require("../utils/invoicePdfProps");

let documentModule;
let resolverPatched = false;

function patchFrontendModuleResolution() {
  if (resolverPatched) return;
  resolverPatched = true;

  const backendNodeModules = path.join(__dirname, "../node_modules");
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function (request, parent, isMain, options) {
    const parentFile = parent?.filename || "";
    const fromFrontendInvoice =
      parentFile.includes(`${path.sep}HotelFrontend${path.sep}`) &&
      parentFile.includes(`${path.sep}billing${path.sep}`);

    if (
      fromFrontendInvoice &&
      (request === "react" ||
        request === "react-dom" ||
        request.startsWith("@react-pdf/"))
    ) {
      return originalResolveFilename.call(
        this,
        request,
        { paths: [backendNodeModules] },
        false,
        options,
      );
    }

    return originalResolveFilename.call(
      this,
      request,
      parent,
      isMain,
      options,
    );
  };
}

function loadHotelInvoiceDocument() {
  if (documentModule) return documentModule;

  patchFrontendModuleResolution();

  require("esbuild-register/dist/node").register({
    extensions: [".jsx"],
    target: "node18",
  });

  const documentPath = path.join(
    __dirname,
    "../../HotelFrontend/frontend/src/components/billing/HotelInvoiceDocument.jsx",
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
