const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild-wasm");

const SRC = path.join(__dirname, "../src/pdf-templates/HotelInvoiceDocument.jsx");
const OUT = path.join(__dirname, "../src/pdf-templates/HotelInvoiceDocument.compiled.js");

async function build() {
  const source = fs.readFileSync(SRC, "utf8");
  const { code } = await esbuild.transform(source, {
    loader: "jsx",
    format: "cjs",
    target: "node18",
    jsx: "automatic",
    jsxImportSource: "react",
  });
  fs.writeFileSync(OUT, code);
  console.log("Compiled HotelInvoiceDocument.jsx ->", OUT);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});