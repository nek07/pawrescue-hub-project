const Role = require('./models/role'); 
const User = require('./models/user'); 
const bcrypt = require('bcryptjs');
const {validationResult} = require('express-validator')
const tokenService = require('./service/token-service')
const userService = require('./service/user-service')
const UserDto = require('./dtos/user-dto')
const cors = require('cors')
const cookieParser = require('cookie-parser')
class AuthController {
    async registration(req, res) {
        try {
            const errors = validationResult(req)
            if(!errors.isEmpty()){
                return res.status(400).json({message:"Error occured during the registration",errors})
            }
            const { username, password } = req.body;
                    console.log('Received username and password:', username, password);

            const candidate = await User.findOne({ username });

            if (candidate) {
                console.log("User with this username already exists.");
                return res.status(400).json({ message: "User with this username already exists." });  
            }
            const userData = await userService.registration(username,password)

            res.cookie('refreshToken', userData.refreshToken,{maxAge:30*60*60*24*1000,httpOnly:true})
           // let temp = res.json(userData)
            return res.json(userData)
        } catch (error) {
            console.log(`Error: ${error}`);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    async login(req, res) {
        try {
            // Your login logic goes here
            
            const {username,password} = req.body;
            console.log('Received username and password:', username, password);

            const userData = await userService.login(username,password);
            /*const user = await UserModel.findOne({username})
            if(!user) {
                return res.status(400).json({message: `User ${username} not found.`})
            }
            const validPassword = bcrypt.compareSync(password,user.password)
            if(!validPassword) {
                return res.status(400).json({message: `Password is not correct.`})
            }
            */ 
            console.log('point')
            res.cookie('refreshToken',userData.refreshToken, {maxAge:30*60*60*24*1000,httpOnly:true})
            return res.json(userData)
        } catch (error) {
            console.log(`Error: ${error}`);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
    async refresh(req,res,next){
        try {

        } catch(error) {
            console.log(`Error: ${error}`);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
