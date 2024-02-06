const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const fs = require('fs')
const jsonData = JSON.parse(fs.readFileSync(path.join(__dirname, 'animals.json'), 'utf-8'));
router.get('/adoption', (req, res) => {
    res.render('public/adoption', { animal: jsonData });
});
router.get('/recources', (req, res) => {
    res.render('public/recources', { article: articles });
});
router.use('/home', Router.static(path.join(__dirname, '/public/index.html')));

module.exports = router
