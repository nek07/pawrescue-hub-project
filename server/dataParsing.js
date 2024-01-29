const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    let names = []; 
    let pictures = [];
    let breeds = [];
    let descriptions = [];

    for (let pageNumber = 1; pageNumber < 2; pageNumber++) {
        await page.goto('https://www.pets4homes.co.uk/sale/kittens/local/local/page-' + pageNumber +'/');

        const nameArr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.en');
            return Array.from(productItem, el => el.innerHTML);
        });
        const picturesArr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.Et');
            return Array.from(productItem, el => el.getAttribute('src'));
        });
        const breedArr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('[data-testid="listing-tile-attr-breed"]');
            return Array.from(productItem, el => el.innerHTML);
        });
        const descriptionsArr = await page.evaluate(() => {
            const productItem = document.querySelectorAll('.gn');
            return Array.from(productItem, el => el.innerHTML);
        });
        names.push(...nameArr);
        pictures.push(...picturesArr);
        breeds.push(...breedArr)
        descriptions.push(...descriptionsArr)
        console.log(names);
    }

    var animals = []
for (let i = 0; i < names.length; i++) {
    const animal = {
        name: names[i] || '',
        picture: pictures[i] || '',
        breed: breeds[i] || '',
        description: descriptions[i] || ''
    };

    animals.push(animal);
}

const jsonString = JSON.stringify(animals, null, 2); // The third argument (2) is for indentation

fs.writeFileSync('./animals.json', jsonString);

console.log('Animals JSON file saved.');

await browser.close();
    await browser.close();
})();
