
import * as fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';

const initBrowser = async (browser: Browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768});
    await page.goto("https://giant.pfi.gutools.co.uk/settings/about", {waitUntil: 'networkidle2'});
    await page.waitForSelector('pre.wrap-my-pre', { visible: true, timeout: 0 });
    return page;
}

async function main() {
    console.log("starting browser")

    const browser = await puppeteer.launch({ args: ["--no-sandbox"], headless: false });

    let page = await initBrowser(browser);
    // TODO give this an ID and comment so that future changes don't break this script
    const elementHandle = await page.$('pre.wrap-my-pre')
    const token = await page.evaluate(el => el.textContent, elementHandle)
    console.log(token)

    fs.writeFileSync('./token.txt', token);
    browser.close();
   }

   main()
     .then(() => console.error('done'))
     .catch((err) => console.error(err));