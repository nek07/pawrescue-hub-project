const UserModel = require('../models/user')
const bcrypt = require('bcryptjs');
const Role = require('../models/role'); 
const UserDto = require('../dtos/user-dto')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const tokenService = require('./token-service')
const axios = require('axios')
// let accessToken = "";
// const instance = axios.create({
//     // Attach cookies to the request
//     withCredentials: true,
//     baseURL: "http://localhost:3001",
// });

// instance.interceptors.request.use(
//     (config) => {
//         // Retrieve token from cookies
//         const token = config.Authorization.accessToken; // Предполагается, что accessToken хранится в куках
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     (error) => {
//         return Promise.reject(error);
//     }
// );
class UserService {
    async registration(username, password) {


        const hash = bcrypt.hashSync(password, 6);
        const userRole = await Role.findOne({ value: 'USER' });
        const user = await UserModel.create({ username, password: hash })


        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });
        await tokenService.saveToken(user.id, tokens.refreshToken)
        user.save()
        return {
            ...tokens,
            user: userDto,
            message:"Successfully registered",
        }
    }
    async login(username,password){
        const user = await UserModel.findOne({ username})
        const userDto = new UserDto(user)
        const tokens = tokenService.generateTokens({ ...userDto });
        await tokenService.saveToken(user.id, tokens.refreshToken)
       
        return {

            ...tokens,
            user: userDto,
            message:"Successfully loginned"
        }
    }
}

module.exports = {
    userService:new UserService(),

}