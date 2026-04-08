const { Before, After, BeforeStep, setDefaultTimeout } = require("@cucumber/cucumber");
const { chromium } = require("playwright");

setDefaultTimeout(300000);

Before(async function () {
  const headed = process.env.HEADED !== "false";
  const slowMo = Number(process.env.SLOW_MO || 120);

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
