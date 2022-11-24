const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



const uri = "mongodb+srv://<username>:<password>@cluster0.e3n1sso.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
client.connect(err => {
    const collection = client.db("test").collection("devices");
    // perform actions on the collection object
    client.close();
});




// -----------------------------------------------
app.get('/', async (req, res) => {
    res.send('Budget wheels server is running')
})

app.listen(port, () => console.log(`Budget wheel running on port: ${port}`))
// -----------------------------------------------