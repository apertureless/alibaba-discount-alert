const fs = require('fs')
const fsp = require('fs-promise');
const request = require('request-promise-native')
const cheerio = require('cheerio')
const IncomingWebhook = require('@slack/client').IncomingWebhook

require('dotenv').load()

const mins = process.env.REFRESH_TIME
const refreshIntervall = mins * 60 * 1000
const articlePageUrl = process.env.URL
const slackUrl = process.env.SLACK_WEBHOOK_URL || ''

const webhook = new IncomingWebhook(slackUrl)

const options = {
  uri: articlePageUrl,
  transform: (body) => {
    return cheerio.load(body)
  }
}

function requestDiscountPrice() {
  return new Promise((resolve, reject) => {
    request(options)
      .then(($) => {
        let price = $('span#j-sku-discount-price').text()
        resolve(price)
      })
      .catch(err => reject(err))
  })
}

async function getPrice () {
  let price
  try {
    price = await requestDiscountPrice()
  } catch (err) {
    console.error(err)
  }

  return price
}

function sendNotification(price) {
  webhook.send(`🔥 New Discount! Price is: ${price} visit: ${articlePageUrl}`, (err, res) => {
    if (err) {
      console.log('Error:', err)
    }
  })
}

async function isLowestPrice (price) {
  return fsp.readFile('discounts.json')
    .then((data) => {
      return JSON.parse(data)
    })
    .then(json => {
      return json.discounts.every((discount) => {
        return price < discount
      })
    })
    .catch(err => console.log(err))
}

function writeToFile(price) {
  let json = {
    discounts: []
  }

  fs.readFile('discounts.json', (err, data) => {
    if (err) throw err
    json = JSON.parse(data)
    json.discounts.push(price)

    fs.writeFile('discounts.json', JSON.stringify(json, null, 4), function(err) {
      console.log('Discount saved.');
    })
  })
}
setInterval(()=> {
  console.log('🚀 Monitor started. Time to get some deals!')

  getPrice()
    .then((price) => {
      if (price) {
        isLowestPrice(price)
          .then((isLowest) => {
            if (isLowest) {
              sendNotification(price)
            }
            return true
          })
          .then(writeToFile(price))
          .catch(err => console.log(err))
      }
    })
}, refreshIntervall)
