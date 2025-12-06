require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const admin = require('firebase-admin')
const port = process.env.PORT || 3000
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)
const serviceAccount = JSON.parse(decoded)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const app = express()
// middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://b12-m11-session.web.app',
    ],
    credentials: true,
    optionSuccessStatus: 200,
  })
)
app.use(express.json())

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
  console.log(token)
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.tokenEmail = decoded.email
    console.log(decoded)
    next()
  } catch (err) {
    console.log(err)
    return res.status(401).send({ message: 'Unauthorized Access!', err })
  }
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {
    // db collections
    const db = client.db('loanLinkDB')
    const loansCollection = db.collection('all-Loans')
    const applicationCollection = db.collection('loan-application')
    const usersCollection = db.collection('users')

    // loans related apis
    // all loans
    app.get('/all-loans', async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.createdBy = email;
      }
      const result = await loansCollection.find(query).toArray();
      res.send(result)
    })

    // get a loan details
    app.get('/loan/:id', async (req, res) => {
      const id = req.params.id;
      const result = await loansCollection.findOne({ _id: new ObjectId(id) });
      res.send(result)
    })

    app.post('/add-loan', async (req, res) => {
      const loanData = req.body;
      loanData.createdAt = new Date();
      const result = await loansCollection.insertOne(loanData);
      res.send(result);
    })

    app.patch('/update-loan/:id', async (req, res) => {
      const updateData = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updateData
      };
      const result = await loansCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete('/delete-loan/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await loansCollection.deleteOne(query);
      res.send(result)
    })




    // application related apis
    app.get('/applications', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const updatedBy = req.query.updatedBy;
      const status = req.query.status;
      const query = {};
      if (email) {
        query.borrowerEmail = email;
      }
      if (updatedBy) {
        query.updatedBy = updatedBy;
      }
      if (status) {
        query.status = status;
      }
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/application-details/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await applicationCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    })

    app.post('/applications', async (req, res) => {
      const application = req.body;
      application.appliedAt = new Date();
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    })

    app.patch('/applications/:id', async (req, res) => {
      const updateData = req.body;
      updateData.updatedAt = new Date();
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updateData
      };
      const result = await applicationCollection.updateOne(query, update);
      res.send(result);
    })

    app.delete('/my-applications/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationCollection.deleteOne(query);
      res.send(result)
    })


    // save or update a user in db
    // get all users
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.role = 'borrower'

      const query = {
        email: userData.email
      }

      const alreadyExists = await usersCollection.findOne(query);
      if (alreadyExists) {
        const result = await usersCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString()
          }
        })
        return res.send(result)
      }

      const result = await usersCollection.insertOne(userData);
      res.send(result)
    })

    // get a users role
    app.get('/user/role', verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role })
    })

    // update user role
    app.patch('/user/:id', async (req, res) => {
      const updateData = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updateData
      };
      const result = await usersCollection.updateOne(query, update);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from Server..')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
