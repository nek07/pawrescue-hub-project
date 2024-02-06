const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const fs = require('fs')
const filePath = path.join(__dirname, '../jsonData/animals.json');
const jsonData = JSON.parse(fs.readFileSync(filePath), 'utf-8');

router.get('/adoption', (req, res) => {
    res.render(path.join(__dirname, '../public/adoption'), { animal: jsonData });
});
router.get('/recources', (req, res) => {
    res.render(path.join(__dirname, '../public/resources'), { article: articles });
});
router.get('/home', (req, res) => {
    res.render(path.join(__dirname, '../public/index'), {});
});
module.exports = router
