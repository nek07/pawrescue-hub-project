const jwt = require('jsonwebtoken')
const tokenModel = require('../models/token')
require('dotenv').config();
class TokenService {
    generateTokens(payload){
        const accessToken = jwt.sign(payload,process.env.JWT_ACCESS_CODE,{expiresIn:'1h'})
        const refreshToken = jwt.sign(payload,process.env.JWT_REFRESH_CODE,{expiresIn:'1h'})
        return {
            accessToken, refreshToken
        }
    }
    async saveToken(userId, refreshToken) {
        const tokenData = await tokenModel.findOne({user:userId})
        if(tokenData) {
            tokenData.refreshToken = refreshToken;
            return tokenData.save()
        }
        const token = await tokenModel.create({user:userId,refreshToken})
        return token
    }
}

module.exports = new TokenService();