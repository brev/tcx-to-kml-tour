// modules
const fs = require('fs')
const toGeoJson = require('geojson')
const path = require('path')
const sqlite3 = require('sqlite3')
const strXml = require('strxml')
const tcxDom = require('tcx-js')
const toKml = require('tokml')

// init
const db = new sqlite3.Database('data.db')
const dirKml = 'kml'
const dirTcx = 'tcx'
const files = fs.readdirSync(dirTcx)
const ids = {}
const optsTcx = {alt_feet: true, dist_miles: true, elapsed: false}
const sqlAct = `
  INSERT INTO activity VALUES (
    $id, $curr_tkpt_alt_feet, $curr_tkpt_dist_miles, $curr_tkpt_lat,
    $curr_tkpt_lng, $curr_tkpt_seq, $curr_tkpt_time, $file_kml, $file_tcx,
    $tkpt0_time
  )
`
const sqlTrack = `
  INSERT INTO trackpoint VALUES (
    $activity_id, $alt_feet, $dist_miles, $lat, $lng, $seq, $time
  )
`

// functions

const exportKml = (geos, fullKmlFile) => {
  console.log('  generating kml:', fullKmlFile)
  const geoJsonOpts = {Point: ['lat', 'lng']}
  const kmlOpts = {timestamp: 'time'}
  const geojson = toGeoJson.parse(geos, geoJsonOpts)
  const kml = toKml(geojson, kmlOpts)
  fs.writeFileSync(path.join(dirKml, fullKmlFile), kml)
}

const saveActivity = (parser, tcxFile, kmlFile) => {
  console.log(
    'activity:',
    parser['activity']['id'],
    tcxFile,
    parser['activity']['trackpoints'].length
  )
  const {activity, curr_tkpt} = parser
  const stmtAct = db.prepare(sqlAct)
  stmtAct.run({
    $id: activity['id'],
    $curr_tkpt_alt_feet: curr_tkpt['alt_feet'],
    $curr_tkpt_dist_miles: curr_tkpt['dist_miles'],
    $curr_tkpt_lat: curr_tkpt['lat'],
    $curr_tkpt_lng: curr_tkpt['lng'],
    $curr_tkpt_seq: curr_tkpt['seq'],
    $curr_tkpt_time: curr_tkpt['time'],
    $file_kml: kmlFile,
    $file_tcx: tcxFile,
    $tkpt0_time: parser['tkpt0_time'],
  })
  stmtAct.finalize()
}

const saveTrackpoint = (parser, trackpoint) => {
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
}

const shapeData = (parser) => {
  let {activity, curr_tkpt} = parser
  let {id, trackpoints} = activity
  // shape activity
  parser['activity']['id'] = id.trim()
  parser['curr_tkpt']['lat'] = Number.parseFloat(curr_tkpt['lat'])
  parser['curr_tkpt']['lng'] = Number.parseFloat(curr_tkpt['lng'])
  parser['curr_tkpt']['time'] = curr_tkpt['time'].trim()
  parser['tkpt0_time'] = parser['tkpt0_time'].trim()
  // shape trackpoints
  trackpoints.forEach((trackpoint, index) => {
    parser['activity']['trackpoints'][index]['lat'] =
      Number.parseFloat(trackpoint['lat'])
    parser['activity']['trackpoints'][index]['lng'] =
      Number.parseFloat(trackpoint['lng'])
    parser['activity']['trackpoints'][index]['time'] = trackpoint['time'].trim()
  })
  // TODO: Create 'elapsed' counter
  return parser
}

const verifyActivityTrackpoints = (parser) => {
  return parser['activity']['trackpoints'].length > 0
}

const verifyTrackpointGeo = (trackpoint) => {
  return (!(
    Number.isNaN(trackpoint['lat']) &&
    Number.isNaN(trackpoint['lng'])
  ))
}


// main

db.run("BEGIN TRANSACTION");
try { fs.mkdirSync(dirKml) } catch(error) {}

// import fresh tcx data files into sqlite
files.forEach((file) => {
  const fullTcxPath = path.join(dirTcx, file)
  const geos = []
  let parser = new tcxDom.Parser(optsTcx)
  let fullKmlFile

  parser.parse_file(fullTcxPath)
  if(! verifyActivityTrackpoints(parser)) {
    console.log("\n\n!!! Skipping empty file: ", file, "\n\n")
    return
  }
  parser = shapeData(parser)
  fullKmlFile = new Date(parser['activity']['id']).getTime() + '.kml'

  // uniques only
  if (parser['activity']['id'] in ids) {
    console.log("\n\n!!! DUPE ID: ", file, parser['activity']['id'], "\n\n")
    return
  } else {
    ids[parser['activity']['id']] = true
  }

  saveActivity(parser, file, fullKmlFile)
  parser['activity']['trackpoints'].forEach((trackpoint) => {
    if (! verifyTrackpointGeo(trackpoint)) return
    saveTrackpoint(parser, trackpoint)
    geos.push(trackpoint)
  })
  exportKml(geos, fullKmlFile)
  console.log(' ')
})

db.run("COMMIT");
db.close()
console.log('Done processing', files.length, 'TCX activity files.')
