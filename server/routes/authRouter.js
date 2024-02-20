const Router = require('express')
const router = new Router()
const { controller } = require('../authController')
const {check} = require('express-validator')
const path = require('path')
// Set EJS as the view engine
router.set('view engine', 'ejs');
router.set('views', __dirname);
router.post('/login',controller.login)

router.get('/registration', (req, res) => {
    res.render(path.join(__dirname, '../public/reg'), {});
});
router.get('/login', (req, res) => {
    res.render(path.join(__dirname, '../public/login'), {});
});
router.post('/registration',[check('username',"Username cannot be empty").notEmpty(),check('password','Password cannot be shorter than 8 symbols').isLength({min:8,max:20})])
router.post('/registration',controller.registration)

router.get('/refresh',controller.refresh)

module.exports = router