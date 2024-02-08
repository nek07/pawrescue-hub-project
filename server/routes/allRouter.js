const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const Animal = require('../models/animal');
const fs = require('fs')
const filePath = path.join(__dirname, '../jsonData/animals.json');
const jsonData = JSON.parse(fs.readFileSync(filePath), 'utf-8');

router.get('/adoption', async (req, res) => {
    try {
        // Fetch all animals from the database
        const animals = await Animal.find();
        // Render the view and pass the animals data to it
        res.render(path.join(__dirname, '../public/adoption'), { animal: animals });
    } catch (error) {
        // Handle any errors that occur during the database operation
        console.error('Error fetching animals:', error);
        res.status(500).send('Internal Server Error');
    }
});
router.get('/recources', (req, res) => {
    res.render(path.join(__dirname, '../public/resources'), { article: articles });
});
router.get('/home', (req, res) => {
    res.render(path.join(__dirname, '../public/index'), {});
});
module.exports = router
