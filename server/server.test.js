const request = require('supertest');
const app = require('./server'); // Replace with the actual path to your app file
const User = require('./models/user');
const mongoose = require('mongoose')
// Test the registration route

beforeAll(async () => {
    // Connect to MongoDB before running the tests
    await mongoose.connect('mongodb+srv://ataytoleuov:220439@abylaidb.3jyfmar.mongodb.net/pawrescue', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    server = app.listen(3001, () => {
        console.log('Server started on port 3001');
      });
  },20000);

  describe('POST /auth/registration', () => {
    let registeredUsername; // Declare a variable to store the registered username

    it('should detect existing user', async () => {
        const response = await request(app)
            .post('/auth/registration')
            .send({
                username: 'damir',
                password: '12345678',
            });

        expect(response.status).toBe(400);
    });

    it('should register a new user', async () => {
        const response = await request(app)
            .post('/auth/registration')
            .send({
                username: 'testuser123',
                password: 'testpassword123',
            });

        expect(response.status).toBe(200);
        registeredUsername = 'testuser123'; // Store the registered username
        
    });

    afterEach(async () => {
        if (registeredUsername) {
            await User.findOneAndDelete({ 'username': 'testuser123' });
        }
    });
});

// Test the login route
describe('POST /auth/login', () => {
    it('should log in an existing user', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({
                username: 'damir',
                password: '12345678',
            });

        expect(response.status).toBe(200);
        // Add more assertions as needed
    });
    it('should detect not existing user', async () => {
        const response0 = await request(app)
            .post('/auth/login')
            .send({
                username: 'notexistinguser',
                password: '12345678',
            });

        expect(response0.status).toBe(400);
        // Add more assertions as needed
    });

    it('should handle invalid password', async () => {
        const response1 = await request(app)
            .post('/auth/login')
            .send({
                username: 'abylai',
                password: '123456781',
            });

        expect(response1.status).toBe(400);
    });
    it('should handle shorter than 8 symbols password', async () => {
        
        const response2 = await request(app)
            .post('/auth/login')
            .send({
                username: 'abylai',
                password: '123',
            });

        expect(response2.status).toBe(400);
    });
});

    // Delete the created user after all tests
    
