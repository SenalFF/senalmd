const puppeteer = require("puppeteer");
const fs = require("fs");

async function fetchGDriveFile(url, cookiesFile) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Load cookies
    const cookies = JSON.parse(fs.readFileSync(cookiesFile));
    await page.setCookie(...cookies);

    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for the download link to appear (adjust selector based on the website)
    await page.waitForSelector("a[href*='takeout/download']");

    // Extract the download link
    const downloadLink = await page.$eval("a[href*='takeout/download']", (el) => el.href);

    // Close browser
    await browser.close();

    // Return the download link
    return downloadLink;
}

module.exports = { fetchGDriveFile };
