const { Before, After, BeforeStep, setDefaultTimeout } = require("@cucumber/cucumber");
const { chromium } = require("playwright");

const timeoutMs = Number(process.env.CUCUMBER_TIMEOUT_MS || 1800000);
setDefaultTimeout(Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1800000);

Before(async function () {
  const headed = process.env.HEADED !== "false";
  const slowMoValue = Number(process.env.SLOW_MO || 0);
  const slowMo = Number.isFinite(slowMoValue) && slowMoValue >= 0 ? slowMoValue : 0;

  this.fechaConsulta = new Date();

  this.browser = await chromium.launch({
    headless: !headed,
    slowMo
  });

  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
});

BeforeStep(function ({ pickleStep }) {
  console.log(`[STEP] ${pickleStep.text}`);
});

After(async function () {
  if (this.page) {
    await this.page.close().catch(() => {});
  }

  if (this.context) {
    await this.context.close().catch(() => {});
  }

  if (this.browser) {
    await this.browser.close().catch(() => {});
  }
});
