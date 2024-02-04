const Role = require('./models/role'); 
const User = require('./models/user'); 
const bcrypt = require('bcryptjs');
const {validationResult} = require('express-validator')

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
                return res.status(400).json({ message: "User with this username already exists." });
            }

            const hash = bcrypt.hashSync(password, 6);
            const userRole = await Role.findOne({ value: 'USER' });
            const user = new User({ username, password: hash, roles: [userRole.value] });

            await user.save();
            return res.json({ message: "User successfully registered" });
        } catch (error) {
            console.log(`Error: ${error}`);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    async login(req, res) {
        try {
            // Your login logic goes here
        } catch (error) {
            console.log(`Error: ${error}`);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
