const mongoose = require('mongoose')
const { v4: uuid } = require('uuid')
const jimp = require('jimp')
const fs = require('fs')
const aws = require('aws-sdk')

const Category = require('../models/Category')
const StateModel = require('../models/State')
const User = require('../models/User')
const Ad = require('../models/Ad')

const addImage = async buffer => {
  let newName = `${uuid()}.jpg`
  let tmpImg = await jimp.read(buffer)
  tmpImg.cover(500, 500).quality(80).write(`./public/media/${newName}`)
  return newName
}

const delImage = collection => {
  for (let i in collection.images) {
    if (collection.images[i].url.toString() != 'default.jpg') {
      fs.unlink(
        `${__dirname}/../../public/media/${collection.images[i].url}`,
        err => {
          if (err) throw err
          console.log('Arquivo deletado!')
        }
      )
    }
  }
}

module.exports = {
  getCategories: async (req, res) => {
    const cats = await Category.find()

    let categories = []

    for (let i in cats) {
      categories.push({
        ...cats[i]._doc,
        img: `${process.env.BASE}/assets/images/${cats[i].slug}.png`
      })
    }

    res.json({ categories })
  },
  addAction: async (req, res) => {
    let { title, price, priceneg, desc, cat, token } = req.body
    const user = await User.findOne({ token })

    if (!title || !cat || !req.files) {
      res.json({
        error: 'Titulo, categoria e/ou imagens não foram preenchidos!'
      })
      return
    }

    if (!mongoose.Types.ObjectId.isValid(cat)) {
      res.json({ error: 'Categoria Inválida' })
      return
    }

    const category = await Category.findById(cat)
    if (!category) {
      res.json({ error: 'Categoria inexistente' })
      return
    }

    if (price) {
      // R$ 8.000,35 = 8000.35
      price = price.replace('.', '').replace(',', '.').replace('R$ ', '')
      price = parseFloat(price)
    } else {
      price = 0
    }

    const newAd = new Ad()

    newAd.status = true
    newAd.idUser = user._id
    newAd.state = user.state
    newAd.dateCreated = new Date()
    newAd.title = title
    newAd.category = cat
    newAd.price = price
    newAd.priceNegotiable = priceneg == 'true' ? true : false
    newAd.description = desc
    newAd.views = 0

    if (req.files && req.files.img) {
      if (req.files.img.length == undefined) {
        let url = await addImage(req.files.img.data)

        const s3 = new aws.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCSESS_KEY,
          region: process.env.AWS_DEFAULT_REGION
        })

        const file = await jimp
          .read(Buffer.from(req.files.img.data, 'base64'))
          .then(async image => {
            image.cover(500, 500).quality(80)
            return image.getBufferAsync(jimp.AUTO)
          })

        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: url,
          Body: file,
          ContentType: req.files.img.mimetype,
          acl: 'public-read'
        }

        s3.upload(params, async (err, data) => {
          try {
            if (err) {
              res.status(500).json({ error: true, Message: 'Deu erro ' + err })
            }
          } catch (err) {
            res.status(500).json({ msg: 'Server Error', error: err })
          }
        })

        if (
          ['image/jpeg', 'image/jpg', 'image/png'].includes(
            req.files.img.mimetype
          )
        ) {
          let awsUrl = process.env.AWS_Uploaded_File_URL_LINK + url

          newAd.images.push({
            awsUrl,
            default: false
          })
        }
      } else {
        for (let i = 0; i < req.files.img.length; i++) {
          let url = await addImage(req.files.img[i].data)

          const s3 = new aws.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCSESS_KEY,
            region: process.env.AWS_DEFAULT_REGION
          })

          const file = await jimp
            .read(Buffer.from(req.files.img[i].data, 'base64'))
            .then(async image => {
              image.cover(500, 500).quality(80)

              return image.getBufferAsync(jimp.AUTO)
            })

          const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: url,
            Body: file,
            ContentType: req.files.img[i].mimetype,
            acl: 'public-read'
          }

          s3.upload(params, async (err, data) => {
            try {
              if (err) {
                res
                  .status(500)
                  .json({ error: true, Message: 'Deu erro ' + err })
              }
            } catch (err) {
              res.status(500).json({ msg: 'Server Error', error: err })
            }
          })

          if (
            ['image/jpeg', 'image/jpg', 'image/png'].includes(
              req.files.img[i].mimetype
            )
          ) {
            let awsUrl = process.env.AWS_Uploaded_File_URL_LINK + url

            newAd.images.push({
              awsUrl,
              default: false
            })
          }
        }
      }
    }

    if (newAd.images.length > 0) {
      newAd.images[0].default = true
    }

    const info = await newAd.save()
    res.json({ id: info._id })
  },
  getList: async (req, res) => {
    let { sort = 'asc', offset = 0, limit = 8, q, cat, state } = req.query
    let filters = { status: true }
    let total = 0

    if (q) {
      filters.title = { $regex: q, $options: 'i' }
    }

    if (cat) {
      const c = await Category.findOne({ slug: cat })
      if (c) {
        filters.category = c._id.toString()
      }
    }

    if (state) {
      const s = await StateModel.findOne({ name: state.toUpperCase() })
      if (s) {
        filters.state = s._id.toString()
      }
    }

    const adsTotal = await Ad.find(filters)
    total = adsTotal.length

    const adsData = await Ad.find(filters)
      .sort({
        dateCreated: sort == 'desc' ? -1 : 1
      })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
    let ads = []
    for (let i in adsData) {
      let image

      let defaultImg = adsData[i].images.find(e => e.default)
      if (defaultImg) {
        image = `${defaultImg.awsUrl}`
      } else {
        image = `${process.env.AWS_Uploaded_File_URL_LINK}default.jpg`
      }

      ads.push({
        id: adsData[i]._id,
        title: adsData[i].title,
        price: adsData[i].price,
        priceNegotiable: adsData[i].priceNegotiable,
        dateCreated: adsData[i].dateCreated,
        image
      })
    }
    res.json({ ads, total })
  },
  getItem: async (req, res) => {
    let { id } = req.params
    let { other = null } = req.query

    if (!id) {
      res.json({ error: 'Sem produto' })
      return
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.json({ error: 'ID Inválido' })
      return
    }

    const ad = await Ad.findById(id)

    ad.views++
    await ad.save()

    let images = []
    for (let i in ad.images) {
      images.push(`${ad.images[i].awsUrl}`)
    }

    let category = await Category.findById(ad.category)
    let userInfo = await User.findById(ad.idUser)
    let state = await StateModel.findById(ad.state)

    let others = []

    if (other) {
      const otherData = await Ad.find({ status: true, idUser: ad.idUser })

      for (let i in otherData) {
        if (otherData[i]._id.toString() != ad._id.toString()) {
          let image = `${process.env.AWS_Uploaded_File_URL_LINK}default.jpg`

          let defaultImg = otherData[i].images.find(e => e.default)
          if (defaultImg) {
            image = `${defaultImg.awsUrl}`
          }

          others.push({
            id: otherData[i]._id,
            title: otherData[i].title,
            price: otherData[i].price,
            priceNegotiable: otherData[i].priceNegotiable,
            dateCreated: otherData[i].dateCreated,
            image
          })
        }
      }
    }

    res.json({
      id: ad._id,
      title: ad.title,
      price: ad.price,
      priceNegotiable: ad.priceNegotiable,
      description: ad.description,
      dateCreated: ad.dateCreated,
      views: ad.views,
      images,
      category,
      userInfo: {
        name: userInfo.name,
        email: userInfo.email
      },
      stateName: state.name,
      others
    })
  },
  editAction: async (req, res) => {
    let { id } = req.params
    let { title, status, price, priceneg, desc, cat, token } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.json({ error: 'ID Inválido' })
      return
    }

    const ad = await Ad.findById(id)

    if (!ad) {
      res.json({ error: 'Anúncio inexistente!' })
      return
    }

    const user = await User.findOne({ token })
    if (user._id.toString() !== ad.idUser) {
      res.json({ error: 'Este anúncio não é seu!' })
      return
    }

    let updates = {}

    if (title) {
      updates.title = title
    }
    if (price) {
      price = price.replace('.', '').replace(',', '.').replace('R$ ', '')
      price = parseFloat(price)
      updates.price = price
    }
    if (priceneg) {
      updates.priceNegotiable = priceneg
    }
    if (status) {
      updates.status = status
    }
    if (desc) {
      updates.description = desc
    }
    if (cat) {
      const category = await Category.findOne({ slug: cat })
      if (!category) {
        res.json({ error: 'Categoria inexistente' })
        return
      }
      updates.category = category._id.toString()
    }

    let images = []

    if (req.files && req.files.img) {
      if (req.files.img.length == undefined) {
        let url = await addImage(req.files.img.data)

        const s3 = new aws.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCSESS_KEY,
          region: process.env.AWS_DEFAULT_REGION
        })

        const file = await jimp
          .read(Buffer.from(req.files.img.data, 'base64'))
          .then(async image => {
            image.cover(500, 500).quality(80)
            return image.getBufferAsync(jimp.AUTO)
          })

        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: url,
          Body: file,
          ContentType: req.files.img.mimetype,
          acl: 'public-read'
        }

        s3.upload(params, async (err, data) => {
          try {
            if (err) {
              res.status(500).json({ error: true, Message: 'Deu erro ' + err })
            }
          } catch (err) {
            res.status(500).json({ msg: 'Server Error', error: err })
          }
        })

        if (
          ['image/jpeg', 'image/jpg', 'image/png'].includes(
            req.files.img.mimetype
          )
        ) {
          let awsUrl = process.env.AWS_Uploaded_File_URL_LINK + url

          images.push({
            awsUrl,
            default: false
          })
        }
      } else {
        for (let i = 0; i < req.files.img.length; i++) {
          let url = await addImage(req.files.img[i].data)

          const s3 = new aws.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCSESS_KEY,
            region: process.env.AWS_DEFAULT_REGION
          })

          const file = await jimp
            .read(Buffer.from(req.files.img[i].data, 'base64'))
            .then(async image => {
              image.cover(500, 500).quality(80)

              return image.getBufferAsync(jimp.AUTO)
            })

          const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: url,
            Body: file,
            ContentType: req.files.img[i].mimetype,
            acl: 'public-read'
          }

          s3.upload(params, async (err, data) => {
            try {
              if (err) {
                res
                  .status(500)
                  .json({ error: true, Message: 'Deu erro ' + err })
              }
            } catch (err) {
              res.status(500).json({ msg: 'Server Error', error: err })
            }
          })

          if (
            ['image/jpeg', 'image/jpg', 'image/png'].includes(
              req.files.img[i].mimetype
            )
          ) {
            let awsUrl = process.env.AWS_Uploaded_File_URL_LINK + url

            images.push({
              awsUrl,
              default: false
            })
          }
        }
      }
    }

    if (images.length > 0) {
      images[0].default = true
      delImage(id)
      updates.images = images
    }

    await Ad.findByIdAndUpdate(id, { $set: updates })

    res.json({ error: '' })
  }
}
