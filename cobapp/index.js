'use strict'

/** ERRORS:
- wrong input: lat, long
- wrong file input: gpx file
- no match found
- wrong endpoint
- too many results (limit it to an appropiate number)
**/

const togpx = require('togpx')
const express = require('express')
const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017/test'
const app = express()
let db = null
let cobiColl = null

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

app.get('/lat/:lat/lon/:lon', function (req, res) {
  console.log('lat: ' + typeof req.params.lat)
  console.log('lon: ' + typeof req.params.lon)
  // TODO: check that the latitude and longitude are between sensitive boundaries
  const cursor = cobiColl.find(
        { 'features.geometry': {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [
                parseFloat(req.params.lon),
                parseFloat(req.params.lat)] // [ <longitude> , <latitude> ]
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

// If the Node process ends, close the Mongo connection
const ByeBye = function () {
  db.close(function () {
    console.log('Cobi disconnected through app termination')
    process.exit(0)
  })
}

process.on('SIGINT', ByeBye)
process.on('SIGTERM', ByeBye)
