const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e3n1sso.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// jwt function/middleware
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
            // console.log(req.headers.authorization);

            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result);
        });
        //-------------------------------------------------------------------------------


        // --------------------------------- sellers ------------------------------------
        // add new product by seller 
        app.post('/products', async (req, res) => {
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
        app.delete('/myproducts/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        });
        // -------------------------------------------------------------------------------

        // -------------------------------- advertised --------------------------------------
        // save advertised items to db
        app.post('/advertise', async (req, res) => {
            const advertisedProduct = req.body;
            const result = await advertisedCollection.insertOne(advertisedProduct);
            res.send(result);
        });

        // get all advertised items to show in home page
        app.get('/advertise', async (req, res) => {
            const query = {};
            const result = await advertisedCollection.find(query).toArray();
            res.send(result);
        });

        // get single seller's advertised products
        app.get('/myadvertise', async (req, res) => {
            const email = req.query.email;
            const query = {
                email: email
            }
            const result = await advertisedCollection.find(query).toArray();
            res.send(result);
        });

        // delete advertised item (not used)
        app.delete('/advertise/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await advertisedCollection.deleteOne(filter);
            res.send(result);
        });
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