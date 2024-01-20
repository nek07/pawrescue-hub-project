const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    let productName = []; 
    let productPrice = [];
    let productBrand = [];

    for (let pageNumber = 1; pageNumber < 9; pageNumber++) {
        await page.goto('https://www.sulpak.kz/f/noutbuki?page=' + pageNumber);

        const arr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.product__item');
            return Array.from(productItem, el => el.getAttribute('data-name'));
        });
        const priceArr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.product__item');
            return Array.from(productItem, el => el.getAttribute('data-price'));
        });
        const brandArr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.product__item');
            return Array.from(productItem, el => el.getAttribute('data-brand'));
        });
        productName.push(...arr);
        productPrice.push(...priceArr);
        productBrand.push(...brandArr)
        console.log(productName);
    }


    const laptopName = [];
const model = [];
const technicalDetail = [];
const laptops = []
for (let i = 0; i < productName.length; i++) {
    const originalText = productName[i] || ''; // Provide an empty string if productName[i] is null or undefined
    const numberOfWordsToKeep = 4;

    const wordsArray = originalText.split(' ');

    const cutWordsArray1 = wordsArray.slice(0, numberOfWordsToKeep);
    const cutWordsArray2 = wordsArray.slice(numberOfWordsToKeep, numberOfWordsToKeep + 2);
    const cutWordsArray3 = wordsArray.slice(numberOfWordsToKeep + 1);

    const cutText1 = cutWordsArray1.join(' ');
    const cutText2 = cutWordsArray2.join(' ');
    const cutText3 = cutWordsArray3.join(' ');

    laptopName.push(cutText1);
    model.push(cutText2);
    technicalDetail.push(cutText3);
}
for (let i = 0; i < productName.length; i++) {
    const laptop = {
        brand: laptopName[i] || '',
        model: model[i] || '',
        specification: 'work, play games', // You may customize this as needed
        Price: {
            price: parseFloat(productPrice[i]) || 0, // Assuming prices are numbers
            discount: 'no discount',
            timestamp: new Date().toISOString()
        },
        LaptopInfo: {
            description: productName[i], // You may customize this as needed
            technicalDetails: technicalDetail[i] || ''
        }
    };

    laptops.push(laptop);
}
console.log('Laptop Names:', laptopName);
console.log('Models:', model);
console.log('Technical Details:', technicalDetail);
console.log("prices:", productPrice)
const jsonString = JSON.stringify(laptops, null, 2); // The third argument (2) is for indentation

fs.writeFileSync('laptops.json', jsonString);

console.log('Laptops JSON file saved.');

await browser.close();
    await browser.close();
})();
