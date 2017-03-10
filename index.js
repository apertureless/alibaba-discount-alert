const http = require('http')
const request = require('request-promise-native')
const cheerio = require('cheerio')
const IncomingWebhook = require('@slack/client').IncomingWebhook

require('dotenv').load()

const mins = process.env.REFRESH_TIME || 60
const refreshIntervall = mins * 60 * 1000
const articlePageUrl = process.env.ALIEXPRESS_URL
const slackUrl = process.env.SLACK_WEBHOOK_URL || ''

const webhook = new IncomingWebhook(slackUrl)

const priceList = {
  article: {
    url: articlePageUrl
  },
  discounts: []
}

const options = {
  uri: articlePageUrl,
  transform: body => {
    return cheerio.load(body)
  }
}

function requestDiscountPrice() {
  return new Promise((resolve, reject) => {
    request(options)
      .then($ => {
        const price = $('span#j-sku-discount-price').text()
        resolve(price)
      })
      .catch(err => reject(err))
  })
}

async function getPrice() {
  let price
  try {
    price = await requestDiscountPrice()
  } catch (err) {
    console.error(err)
  }
  return parseFloat(price)
}

function sendSlackNotification(message) {
  webhook.send(message, err => {
    if (err) {
      console.log('Error:', err)
    }
  })
}

function sendDiscountNotification(price) {
  sendSlackNotification(`🔥 New Discount! Price is: ${price} visit: ${articlePageUrl}`)
}

function isLowestPrice(price) {
  return priceList.discounts.every(discount => {
    return price < discount
  })
}

function watch() {
  console.log('👀 Watching you... ')
  sendSlackNotification('🚀 I am online and watching your discounts')

  setInterval(() => {
    getPrice()
      .then(price => {
        if (price) {
          if (isLowestPrice(price)) {
            sendDiscountNotification(price)
          }
          priceList.discounts.push(price)
        }
      })
      .catch(err => sendSlackNotification(`😞 Promise error: ${err}`))
  }, refreshIntervall)
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'})
  res.end(JSON.stringify(priceList))
})

server.listen(1337, '127.0.0.1', () => {
  console.log('Listening on port 1337')
  watch()
})
