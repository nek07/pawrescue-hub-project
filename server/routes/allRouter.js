const Router = require('express')
const router = new Router()
const path = require('path')
router.set('view engine', 'ejs');
router.set('views', __dirname);
const Animal = require('../models/animal');
const middleware = require('../middleware/authMiddleware')
const fs = require('fs')
require('dotenv').config();

// To this line
let fetchModule;
fetchModule = import('node-fetch');
router.use(Router.json());
router.use(Router.urlencoded({
    extended: true
}));
const environment = process.env.ENVIRONMENT || 'sandbox';
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const endpoint_url = environment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

/**
 * Creates an order and returns it as a JSON response.
 * @function
 * @name createOrder
 * @memberof module:routes
 * @param {object} req - The HTTP request object.
 * @param {object} req.body - The request body containing the order information.
 * @param {string} req.body.intent - The intent of the order.
 * @param {object} res - The HTTP response object.
 * @returns {object} The created order as a JSON response.
 * @throws {Error} If there is an error creating the order.
 */
router.post('/create_order', (req, res) => {
    get_access_token()
        .then(access_token => {
            let order_data_json = {
                'intent': req.body.intent.toUpperCase(),
                'purchase_units': [{
                    'amount': {
                        'currency_code': 'USD',
                        'value': '5.00'
                    }
                }]
            };
            const data = JSON.stringify(order_data_json)

            fetch(endpoint_url + '/v2/checkout/orders', { //https://developer.paypal.com/docs/api/orders/v2/#orders_create
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${access_token}`
                    },
                    body: data
                })
                .then(res => res.json())
                .then(json => {
                    res.send(json);
                }) //Send minimal data to client
        })
        .catch(err => {
            console.log(err);
            res.status(500).send(err)
        })
});

/**
 * Completes an order and returns it as a JSON response.
 * @function
 * @name completeOrder
 * @memberof module:routes
 * @param {object} req - The HTTP request object.
 * @param {object} req.body - The request body containing the order ID and intent.
 * @param {string} req.body.order_id - The ID of the order to complete.
 * @param {string} req.body.intent - The intent of the order.
 * @param {object} res - The HTTP response object.
 * @returns {object} The completed order as a JSON response.
 * @throws {Error} If there is an error completing the order.
 */
router.post('/complete_order', (req, res) => {
    get_access_token()
        .then(access_token => {
            fetch(endpoint_url + '/v2/checkout/orders/' + req.body.order_id + '/' + req.body.intent, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${access_token}`
                    }
                })
                .then(res => res.json())
                .then(json => {
                    console.log(json);
                    res.send(json);
                }) //Send minimal data to client
        })
        .catch(err => {
            console.log(err);
            res.status(500).send(err)
        })
});

// Helper / Utility functions

//Servers the index.html file
router.get('/support',middleware.requireAuth, (req, res) => {
    res.render(path.join(__dirname, '../public/support'), {});
  });


//PayPal Developer YouTube Video:
//How to Retrieve an API Access Token (Node.js)
//https://www.youtube.com/watch?v=HOkkbGSxmp4
function get_access_token() {
    const auth = `${client_id}:${client_secret}`
    const data = 'grant_type=client_credentials'
    return fetch(endpoint_url + '/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(auth).toString('base64')}`
            },
            body: data
        })
        .then(res => res.json())
        .then(json => {
            return json.access_token;
        })
}




const filePath = path.join(__dirname, '../articles1.json');
const jsonData = JSON.parse(fs.readFileSync(filePath), 'utf-8');
router.get('/adoption',middleware.requireAuth, async (req, res) => {
    try {
        // Fetch all animals from the database
        const animals = await Animal.find();
        // Render the view and pass the animals data to it
        res.render(path.join(__dirname, '../public/adoption'), { animal: animals });
    } catch (error) {
        // Handle any errors that occur during the database operation
        console.error('Error fetching animals:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/resources', async (req, res) => {

    // const data = await articles();
    // console.log(data)

    res.render('../public/resources', { data:jsonData });
  
});
router.get('/home', (req, res) => {
    res.render(path.join(__dirname, '../public/index'), {});
});


router.get('/aboutus', (req, res) => {
  res.render(path.join(__dirname, '../public/aboutus'), {});
});

module.exports = router
