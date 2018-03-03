const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')
const tcx = require('tcx-js')

const db = new sqlite3.Database('data.db')
const dir = 'tcx'
const files = fs.readdirSync(dir)
const ids = {}
const parseOpts = {alt_feet: true, dist_miles: true, elapsed: false}
const sqlAct = `
  INSERT INTO activity VALUES (
    $id, $curr_tkpt_alt_feet, $curr_tkpt_dist_miles, $curr_tkpt_lat,
    $curr_tkpt_lng, $curr_tkpt_seq, $curr_tkpt_time, $filename, $tkpt0_time
  )
`
const sqlTrack = `
  INSERT INTO trackpoint VALUES (
    $activity_id, $alt_feet, $dist_miles, $lat, $lng, $seq, $time
  )
`


// main

db.run("BEGIN TRANSACTION");

// import fresh tcx data files into sqlite
files.forEach((file) => {
  const stmtAct = db.prepare(sqlAct)
  const full = path.join(dir, file)
  const parser = new tcx.Parser(parseOpts)
  parser.parse_file(full)

  if(parser['activity']['trackpoints'].length <= 0) {
    console.log("\n\n!!! Skipping empty file: ", file, "\n\n")
    return
  }

  // data shaping, strip input data quirks
  // TODO: Create 'elapsed' counter
  parser['activity']['id'] = parser['activity']['id'].trim()
  parser['curr_tkpt']['lat'] = Number.parseFloat(parser['curr_tkpt']['lat'])
  parser['curr_tkpt']['lng'] = Number.parseFloat(parser['curr_tkpt']['lng'])
  parser['curr_tkpt']['time'] = parser['curr_tkpt']['time'].trim()
  parser['tkpt0_time'] = parser['tkpt0_time'].trim()
  parser['activity']['trackpoints'].forEach((trackpoint, index) => {
    parser['activity']['trackpoints'][index]['lat'] =
      Number.parseFloat(trackpoint['lat'])
    parser['activity']['trackpoints'][index]['lng'] =
      Number.parseFloat(trackpoint['lng'])
    parser['activity']['trackpoints'][index]['time'] =
      trackpoint['time'].trim()
  })

  if (parser['activity']['id'] in ids) {
    console.log("\n\n!!! DUPE ID: ", file, parser['activity']['id'], "\n\n")
    return
  } else {
    ids[parser['activity']['id']] = true
  }

  // save activity to db
  // db.serialize(() => {
  console.log('saving activity:', parser['activity']['id'], file)
  stmtAct.run({
    $id: parser['activity']['id'],
    $curr_tkpt_alt_feet: parser['curr_tkpt']['alt_feet'],
    $curr_tkpt_dist_miles: parser['curr_tkpt']['dist_miles'],
    $curr_tkpt_lat: parser['curr_tkpt']['lat'],
    $curr_tkpt_lng: parser['curr_tkpt']['lng'],
    $curr_tkpt_seq: parser['curr_tkpt']['seq'],
    $curr_tkpt_time: parser['curr_tkpt']['time'],
    $filename: file,
    $tkpt0_time: parser['tkpt0_time'],
  })
  stmtAct.finalize()

  // save trackpoints to db
  console.log('  trackpoints:', parser['activity']['trackpoints'].length)
  parser['activity']['trackpoints'].forEach((trackpoint) => {
    const stmtTrack = db.prepare(sqlTrack)
    stmtTrack.run({
      $activity_id: parser['activity']['id'],
      $alt_feet: trackpoint['alt_feet'],
      $dist_miles: trackpoint['dist_miles'],
      $lat: trackpoint['lat'],
      $lng: trackpoint['lng'],
      $seq: trackpoint['seq'],
      $time: trackpoint['time'],
    })
    stmtTrack.finalize()
  })

  console.log(' ')
  // })
})

console.log('Making DB Commit....')
db.run("COMMIT");
db.close()
console.log('Done processing', files.length, 'TCX activity files.')
