const request = require('supertest');
const app = require('./server'); // Replace with the actual path to your app file

// Test the registration route
describe('POST /auth/registration', () => {
    it('should register a new user', async () => {
        const response = await request(app)
            .post('/auth/registration')
            .send({
                username: 'testuser123',
                password: 'testpassword123',
            });

        expect(response.status).toBe(200);
    });
    it('should detect existing user', async () => {
        const response = await request(app)
            .post('/auth/registration')
            .send({
                username: 'damir',
                password: '12345678',
            });

        expect(response.status).toBe(400);
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
