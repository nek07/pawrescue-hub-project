const Router = require('express')
const router = new Router()
const controller = require('./authController')
const {check} = require('express-validator')
router.post('/registration',[check('username',"Username cannot be empty").notEmpty(),check('password','Password cannot be shorter than 8 symbols').isLength({min:8,max:20})])
router.post('/registration',controller.registration)
router.post('/login',controller.login)

module.exports = router