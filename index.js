const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e3n1sso.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// ----------------------------------- jwt function/middleware ---------------------------------
function verifyJWT(req, res, next) {
    // console.log(req.headers.authorization);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}
// --------------------------------------------------------------------------------------------


async function run() {
    try {
        //  -------------------------------- collections ---------------------------------
        const productsCollection = client.db('budgetWheels').collection('products');
        const categoriesCollection = client.db('budgetWheels').collection('categories');
        const usersCollection = client.db('budgetWheels').collection('users');
        const bookingsCollection = client.db('budgetWheels').collection('bookings');
        const advertisedCollection = client.db('budgetWheels').collection('advertised');
        //-------------------------------------------------------------------------------


        // --------------------------------- categories ---------------------------------
        // get all three categories
        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result);
        });

        // get products by category
        app.get('/categoryProducts', async (req, res) => {
            const name = req.query.name;
            const query = { categoryName: name };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });
        // ---------------------------------------------------------------------------------


        //---------------------------------- booking -----------------------------------
        // save booking info to db
        app.post('/bookings', async (req, res) => {
            const booking = req.body;

            // first checking, if the product is already booked
            const query = {
                buyerName: booking.buyerName,
                email: booking.email,
                brand: booking.brand,
                series: booking.series
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `${booking.brand} ${booking.series} is already booked`
                return res.send({ acknowledged: false, message })
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        // get my bookings 
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;

            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result);
        });

        // get specific booking product for payment
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await bookingsCollection.findOne(filter);
            res.send(result);
        })
        //-------------------------------------------------------------------------------


        // --------------------------------- sellers ------------------------------------
        // add new product by seller 
        app.post('/products', verifyJWT, async (req, res) => {

            // first checking if the role is "seller"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            // if seller then product can be added
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        // get all products added by seller
        app.get('/myproducts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });

        // delete a product by seller
        app.delete('/myproducts/:id', verifyJWT, async (req, res) => {

            // first checking if the role is "admin"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            // if seller then product can be deleted
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        });
        // -------------------------------------------------------------------------------

        // -------------------------------- advertised --------------------------------------

        // Update products as advertised in products collection
        app.put('/products/:id', verifyJWT, async (req, res) => {

            // first checking if the role is "seller"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            // if seller, then product can be updated as advertised
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    isAdvertised: 'Yes'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        // get only "advertised products" from products collection
        app.get('/advertisedproducts', async (req, res) => {
            const query = {
                isAdvertised: 'Yes'
            };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })
        // ----------------------------------------------------------------------------------

        // ----------------------------- report to admin ------------------------------------
        // change report status in products collection
        app.put('/reportproduct/:id', verifyJWT, async (req, res) => {

            // first checking if the role is "buyer"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Buyer') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            // if buyer, then product can be updated as reported
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    isReported: 'Yes'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        // get reported products from product collection
        app.get('/products/reportedproducts', async (req, res) => {
            const query = {
                isReported: 'Yes'
            }
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })

        // delete reported product from product collection
        app.delete('/products/delete/:id', verifyJWT, async (req, res) => {

            // first checking if the role is "admin"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            // now if the user is "admin" then delete reported product will be applied
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        })
        // ----------------------------------------------------------------------------------


        // --------------------------- stripe payment gateway ------------------------------
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
        // ----------------------------------------------------------------------------------

        // ------------------------------ generating jwt ------------------------------------
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });
        // ------------------------------------------------------------------------------------

        // --------------------------------- Users --------------------------------------------
        // save all users info in db 
        app.post('/users', async (req, res) => {
            const user = req.body;

            // check if the google login user exist in db
            const query = {
                email: user.email
            }
            const alreadySaved = await usersCollection.findOne(query);
            if (alreadySaved) {
                return res.send({ acknowledged: false })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // checking if the user is "Admin"
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'Admin' });
        })

        // checking if the user is "Seller"
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'Seller' });
        })

        // checking if the user is "Buyer"
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'Buyer' });
        })

        // get all buyers
        app.get('/users/buyers', async (req, res) => {
            const query = {
                role: 'Buyer'
            }
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // delete buyer
        app.delete('/users/buyers/:id', verifyJWT, async (req, res) => {

            // first checking if the role is "admin"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        // get all sellers
        app.get('/users/sellers', async (req, res) => {
            const query = {
                role: 'Seller'
            }
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // delete seller
        app.delete('/users/sellers/:id', verifyJWT, async (req, res) => {

            // first checking if the role is "admin"
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'Admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            // now if the user is "admin" then delete will be applied
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        // change seller status to "Verified" in products section
        app.put('/products/seller/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };

            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    status: 'Verified'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        })

        // change seller status in seller collection just to conditional button rendering!
        app.put('/users/sellers/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    status: 'Verified'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        })
        // -------------------------------------------------------------------------------

    }
    finally {

    }
}
run().catch(console.log())




// -----------------------------------------------
app.get('/', async (req, res) => {
    res.send('Budget wheels server is running')
})

app.listen(port, () => console.log(`Budget wheel running on port: ${port}`))
// -----------------------------------------------