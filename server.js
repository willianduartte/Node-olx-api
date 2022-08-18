const fileupload = require('express-fileupload')
const mongoose = require('mongoose')
const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const apiRoutes = require('./routes/routes')

mongoose.connect(process.env.DATABASE, async err => {
  if (err) throw err.message
  console.log(`- Database connected on ${process.env.DATABASE}`)
})
mongoose.Promise = global.Promise

const server = express()

server.use(cors())
server.use(express.json())
server.use(express.urlencoded({ extended: true }))
server.use(fileupload())

server.use(express.static(path.join(__dirname, '..', 'public')))

server.use('/', apiRoutes)

server.listen(process.env.PORT, () => {
  console.log('Rodando na porta' + process.env.PORT)
})
