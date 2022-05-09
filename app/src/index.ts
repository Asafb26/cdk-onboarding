import express from 'express'
import AWS from 'aws-sdk'
import moment from 'moment'

const app = express()
const port = 80
AWS.config.update({ region: process.env.region })
const documentClient = new AWS.DynamoDB.DocumentClient()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'up',
    timestamp: new Date().toISOString()
  })
})

app.get('/entities', async (req, res) => {
  const params = {
    TableName: process.env.databaseTable!.toString(),
  }
  try {
    const data = await documentClient.scan(params).promise()
    console.log('Success - items fetched', data)
    return res.status(200).send(data.Items)
  } catch (err) {
    console.log(err)
    return res.send(err)
  }
})

app.post('/entities', async (req, res) => {
  console.log(req.body)

  if (!req.body.name) {
    res.status(400).json({
      error: 'name is required'
    })
    return
  }

  const params = {
    TableName: process.env.databaseTable!.toString(),
    Item: {
      name: req.body.name,
      created: moment().format('YYYYMMDD-hhmmss'),
      metadata: JSON.stringify(req.body),
    }
  }
  try {
    const data = await documentClient.put(params).promise()
    console.log('Success - item added or updated', data)
  } catch (err) {
    console.log(err)
    return res.send(err)
  }
  return res.status(200).send({ body: 'OK!' })
})

app.get('/entity/:name', async (req, res) => {
  const params = {
    TableName: process.env.databaseTable!.toString(),
    Key: {
      name: req.params.name
    }
  }
  try {
    const data = await documentClient.get(params).promise()
    console.log('Success - item fetched', data)
    const deserializedData = data.Item
    if (deserializedData && deserializedData.metadata) {
      deserializedData.metadata = JSON.parse(deserializedData.metadata)
    }
    return res.status(200).send(deserializedData)
  } catch (err) {
    console.log(err)
    return res.send(err)
  }
})

app.listen(port, () => {
  console.log(`Listening on port: ${port}`)
})
