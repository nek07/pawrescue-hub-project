const Router = require('express')
const router = new Router()
const controller = require('./authController')
router.post('/registration',controller.registration)
router.post('/login',controller.login)

module.exports = router