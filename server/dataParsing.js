const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    let productName = []; 

    for (let pageNumber = 1; pageNumber < 9; pageNumber++) {
        await page.goto('https://www.sulpak.kz/f/noutbuki?page=' + pageNumber);

        const arr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.product__item');
            return Array.from(productItem, el => el.getAttribute('data-name'));
        });
        productName.push(...arr);
        console.log(productName);
    }

    console.log(productName);
    console.log(productName.length);
    await browser.close();
})();
