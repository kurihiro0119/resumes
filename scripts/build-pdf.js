const fs = require("fs/promises");
const path = require("path");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

const rootDir = path.resolve(__dirname, "..");
const inputPath = path.join(rootDir, "docs", "README.md");
const outputPath = path.join(rootDir, "docs", "README.pdf");
const configPath = path.join(rootDir, "pdf-configs", "config.js");

function normalizeMargin(margin) {
  if (typeof margin !== "string") {
    return margin;
  }

  const [vertical, horizontal = vertical] = margin.trim().split(/\s+/);

  return {
    top: vertical,
    right: horizontal,
    bottom: vertical,
    left: horizontal,
  };
}

async function buildPdf() {
  const config = require(configPath);
  const markdown = await fs.readFile(inputPath, "utf8");
  const stylesheet = await fs.readFile(
    path.join(rootDir, config.stylesheet),
    config.stylesheet_encoding || "utf8"
  );

  marked.setOptions(config.marked_options || {});

  const bodyClass = Array.isArray(config.body_class)
    ? config.body_class.join(" ")
    : config.body_class || "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <base href="file://${rootDir}/">
    <style>${stylesheet}</style>
  </head>
  <body class="${bodyClass}">
    ${marked.parse(markdown)}
  </body>
</html>`;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("screen");

    const pdfOptions = {
      ...config.pdf_options,
      margin: normalizeMargin(config.pdf_options && config.pdf_options.margin),
    };

    if (pdfOptions.headerTemplate || pdfOptions.footerTemplate) {
      pdfOptions.displayHeaderFooter = true;
    }

    await page.pdf({
      ...pdfOptions,
      path: outputPath,
    });
  } finally {
    await browser.close();
  }
}

buildPdf().catch((error) => {
  console.error(error);
  process.exit(1);
});
