'use strict'

/** ERRORS:
- wrong input: lat, long
- wrong file input: gpx file
- no match found
- wrong endpoint
- too many results (limit it to an appropiate number)
**/

const fs = require('fs')
const path = require('path')
const jsdom = require('jsdom').jsdom
const togeojson = require('togeojson')
const togpx = require('togpx')
const xsd = require('libxml-xsd')
const MongoClient = require('mongodb').MongoClient
const dbUrl = 'mongodb://localhost:27017/test'
const express = require('express')
const bodyParser = require('body-parser')
const app = express()

// database & cobi collection
let db = null
let cobiColl = null

// get the xml body of a post request
app.use(bodyParser.text({limit: '50mb'}))

// Synchronous: we don't want to start the server without validation
const gpxValidatorV10 = xsd.parse(fs.readFileSync(path.join(__dirname, 'gpx_v1_0.xsd'), {encoding: 'utf-8'}))
const gpxValidatorV11 = xsd.parse(fs.readFileSync(path.join(__dirname, 'gpx.xsd'), {encoding: 'utf-8'}))

// just for DEBUG
// console.log(gpxGrammarErrors(fs.readFileSync(path.join(__dirname, 'osm.gpx'), {encoding: 'utf-8'})))

// connect to database and start to listen only on success
MongoClient.connect(dbUrl, function (err, database) {
  if (err === null) {
    db = database
    cobiColl = db.collection('foo')
    cobiColl.ensureIndex({'features.geometry': '2dsphere'})
    app.listen(3000, function () {
      console.log('Example app listening on port 3000!')
    })
  } else {
    console.error(err) // that should go to a proper log file/db
  }
})

// accepted routes
app.get('/gpx-near/lat/:lat/lon/:lon', function (req, res) {
  const position = ParseLatLong(req.params.lat, req.params.lon)
  if (position === null) {
    const msg = 'malformed input: lat ' + req.params.lat +
                ' lon ' + req.params.lon
    console.log(msg)
    return res.status(400).send(msg)
  }

  const cursor = cobiColl.find(
        { 'features.geometry': {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: position // [ <longitude> , <latitude> ]
            }
            // $maxDistance: 100000, nice to have but not requested
          }
        }
      }
    )
  cursor.toArray(function (err, results) {
    // NOTE: it is not possible to get a distance estimation with the $nearSphere
    // operator due to the use of multiple geolocation indexes inside each document
    if (err === null) {
      const gpxData = results.map(function (geojson) {
        return togpx(geojson,
          {
            'featureTitle': function (prop) {
              return ((prop.name) ? prop.name : prop)
            },
            'featureDescription': function (prop) {
              return ((prop.desc) ? prop.desc : prop)
            }
          })
      })
      res.send(gpxData)
    }
  })
})

// user submitted data
app.post('/gpx-doc', function (req, res) {
  const gpxData = req.body
  const errMsg = gpxGrammarErrors(gpxData)
  if (errMsg !== null) {
    console.log(errMsg)
    return res.status(400).send(errMsg)
  }
  // insert document in database
  cobiColl.insertOne(togeojson.gpx(jsdom(gpxData)), function (err, result) {
    if (err === null) {
      console.log('Inserted a document into the foo collection')
    }
  })
  res.send('Document inserted successfully')
})

// check if the input is a valid lat/lon pair, return null on error
function ParseLatLong (lat, lon) {
  if (isNaN(lat) || isNaN(lon)) {
    return null
  } else {
    const numLat = parseFloat(lat)
    const numLon = parseFloat(lon)
    if (numLat > 90 || numLat < -90 || numLon > 180 || numLon < -180) {
      return null
    } else {
      return [numLon, numLat]
    }
  }
}

// check if there is any errors, returns null when no errors occurs
function gpxGrammarErrors (gpxString) {
  const gpxV10Res = gpxValidatorV10.validate(gpxString)
  const gpxV11Res = gpxValidatorV11.validate(gpxString)
  if (gpxV11Res === null || gpxV10Res === null) {
    return null
  } else {
    return { msg: 'Input doesnt conforms to neither v1.1 nor v1.0 gpx schemas',
      v10: gpxV10Res,
      v11: gpxV11Res
    }
  }
}

// If the Node process ends, close the Mongo connection
const ByeBye = function () {
  db.close(function () {
    console.log('Cobi disconnected through app termination')
    process.exit(0)
  })
}

process.on('SIGINT', ByeBye)
process.on('SIGTERM', ByeBye)
