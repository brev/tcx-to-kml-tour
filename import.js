const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')
const tcx = require('tcx-js')

const db = new sqlite3.Database('data.db')
const dir = 'tcx'
const files = fs.readdirSync(dir)
const parseOpts = {alt_feet: true, dist_miles: true, elapsed: false}
const stmtAct = db.prepare(`
  INSERT INTO activity VALUES ($id, $filename, $tkpt0_time)
`)
const stmtTrack = db.prepare(`
  INSERT INTO trackpoint VALUES (
    $activity_id, $alt_feet, $dist_miles, $lat, $lng, $seq, $time
  )
`)


// main

db.serialize(() => {
  // import fresh tcx data files into sqlite
  files.slice(0,5).forEach((file) => {
    const full = path.join(dir, file)
    const parser = new tcx.Parser(parseOpts)
    parser.parse_file(full)

    // data shaping, strip input data quirks
    // TODO: Create 'elapsed' counter
    parser['activity']['id'] = parser['activity']['id'].trim()
    parser['tkpt0_time'] = (typeof parser['tkpt0_time'] === 'string') ?
      parser['tkpt0_time'].trim() : ''
    parser['activity']['trackpoints'].forEach((trackpoint, index) => {
      parser['activity']['trackpoints'][index]['lat'] =
        Number.parseFloat(trackpoint['lat'])
      parser['activity']['trackpoints'][index]['lng'] =
        Number.parseFloat(trackpoint['lng'])
      parser['activity']['trackpoints'][index]['time'] =
        trackpoint['time'].trim()
    })

    // save activity to db
    console.log('saving activity:', parser['activity']['id'], file)
    stmtAct.run({
      $id: parser['activity']['id'],
      $filename: file,
      $tkpt0_time: parser['tkpt0_time'],
    })

    // save trackpoints to db
    console.log('  trackpoints:', parser['activity']['trackpoints'].length)
    parser['activity']['trackpoints'].forEach((trackpoint) => {
      stmtTrack.run({
        $activity_id: parser['activity']['id'],
        $alt_feet: trackpoint['alt_feet'],
        $dist_miles: trackpoint['dist_miles'],
        $lat: trackpoint['lat'],
        $lng: trackpoint['lng'],
        $seq: trackpoint['seq'],
        $time: trackpoint['time'],
      })
    })
    console.log('  ')
  })
})

db.close()
