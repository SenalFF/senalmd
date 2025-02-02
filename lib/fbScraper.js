const puppeteer = require('puppeteer');

// Function to extract video URL from a Facebook share link
async function getVideoUrlFromShareLink(shareUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(shareUrl, { waitUntil: 'networkidle0' });

    // Extract the video URL from the page's video element
    const videoUrl = await page.evaluate(() => {
        const videoElement = document.querySelector('video');
        return videoElement ? videoElement.src : null; // Return the video source URL
    });

    await browser.close();

    return videoUrl;
}

module.exports = getVideoUrlFromShareLink;
