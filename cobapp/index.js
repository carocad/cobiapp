'use strict'

/** ERRORS:
- wrong input: lat, long
- wrong file input: gpx file
- no match found
- wrong endpoint
- too many results (limit it to an appropiate number)
**/

const togpx = require('togpx')
const xsd = require('libxml-xsd')
const fs = require('fs')
const express = require('express')
const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017/test'
const app = express()
let db = null
let cobiColl = null

// Synchronous: we don't want to start the server without validation
const gpxValidatorV10 = xsd.parse(fs.readFileSync('gpx_v1_0.xsd', {encoding: 'utf-8'}))
const gpxValidatorV11 = xsd.parse(fs.readFileSync('gpx.xsd', {encoding: 'utf-8'}))

// fs.readFileSync('osm.gpx', {encoding: 'utf-8'})

// connect to database and start to listen only on success
MongoClient.connect(url, function (err, database) {
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
            featureTitle: function (prop) { return prop.name },
            featureDescription: function (prop) { return prop.desc }
          })
      })
      res.set('Content-Type', 'text/xml')
      res.send('<?xml version="1.0" standalone="yes"?>' +
               gpxData.join('\n'))
    }
  })
})

// user submitted data
app.post('/gpx-doc', function (req, res) {
  const gpxDoc = req.params.data // TODO !!!!!!!!!!!!
  // schemaConforms(gpxDoc)
  cobiColl.insertOne(gpxDoc, function (err, result) {
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
    return {v10: gpxV10Res, v11: gpxV11Res}
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
