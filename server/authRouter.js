const Router = require('express')
const router = new Router()
const controller = require('./authController')
router.post('/registration',controller.login)
router.post('/login',controller.registration)

module.exports = router