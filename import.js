// modules
const fs = require('fs')
const toGeoJson = require('geojson')
const path = require('path')
const Point = require('point-geometry')
const simplify = require('simplify-geometry')
const sqlite3 = require('sqlite3')
const strXml = require('strxml')
const tcxDom = require('tcx-js')
const toKml = require('tokml')

// init
const db = new sqlite3.Database('data.db')
const dirKml = 'kml'
const dirTcx = 'tcx'
const dirTour = 'tour'
const filesTcx = fs.readdirSync(dirTcx)
const ids = {}
const nsKml = {
  'xmlns': 'http://www.opengis.net/kml/2.2',
  'xmlns:gx': 'http://www.google.com/kml/ext/2.2',
}
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
const {tag} = strXml
const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>'


// functions

const calculateHeading = (currPoint, nextPoint) => {
  const angleRad = nextPoint.angleTo(currPoint)
  const normalize = (angle) => (angle < 0) ? (angle + 360) : angle
  const angleDeg = normalize(rad2deg(angleRad))
  const angleMap = Number.parseInt(normalize(0 - (angleDeg - 90)), 10)
  console.log(angleRad, angleDeg, angleMap)
  return angleMap
}

const deg2rad = (degs) => {
  return degs * (Math.PI / 180);
}

const exportKml = (geos, fullKmlFile) => {
  const geoJsonOpts = {Point: ['lat', 'lng']}
  const kmlOpts = {timestamp: 'time'}
  const kmlPath = path.join(dirKml, fullKmlFile)
  const geojson = toGeoJson.parse(geos, geoJsonOpts)
  const kml = toKml(geojson, kmlOpts)
  console.log('  generating kml:', kmlPath)
  fs.writeFileSync(kmlPath, kml)
}

const exportTour = (geos, fullKmlFile) => {
  const coords = geos.map((geo) => [geo['lng'], geo['lat']])
  // const simples = simplify(coords, 0.00009)
  const simples = simplify(coords, 0.0005)
  console.log(simples, simples.length)
  const tourPath = path.join(dirTour, fullKmlFile)
  let currPoint = new Point(geos[0]['lng'], simples[0]['lat'])
  let flyTos, kmlTourXml, nextPoint
  flyTos = simples.map((geo) => {
    let heading
    nextPoint = new Point(geo[0], geo[1])
    heading = calculateHeading(currPoint, nextPoint) || 0
    currPoint = nextPoint
    return tag('gx:FlyTo', [
      tag('gx:duration', '2'),
      tag('gx:flyToMode', 'smooth'),
      tag('Camera', [
        tag('altitude', '30'),
        tag('heading', heading.toString()),
        tag('longitude', geo[0].toString()),
        tag('latitude', geo[1].toString()),
        // tag('range', '30'),
        tag('tilt', '66'),
      ].join('')),
    ].join(''))
  })
  kmlTourXml = xmlHead +
    tag('kml', nsKml, tag('Document', [
      tag('name', 'A tour and features'),
      tag('open', '1'),
      tag('gx:Tour', [
        tag('name', 'Play me'),
        tag('gx:Playlist', flyTos.join('')),
      ].join('')),
    ].join('')))
  console.log('  generating tour:', tourPath)
  fs.writeFileSync(tourPath, kmlTourXml)
}

const rad2deg = (rads) => {
  return rads * (180 / Math.PI);
}

const saveActivity = (parser, tcxFile, kmlFile) => {
  const {activity, curr_tkpt} = parser
  const stmtAct = db.prepare(sqlAct)
  console.log(
    'activity:',
    parser['activity']['id'],
    tcxFile,
    parser['activity']['trackpoints'].length
  )
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
try {
  fs.mkdirSync(dirKml)
  fs.mkdirSync(dirTour)
} catch(error) {}

// import fresh tcx data files into sqlite
filesTcx.slice(11,12).forEach((file) => {
  const fullTcxPath = path.join(dirTcx, file)
  const geos = []
  let parser = new tcxDom.Parser(optsTcx)
  let fullKmlFile, kmlTour

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
  exportTour(geos, fullKmlFile)
  console.log()
})

db.run("COMMIT");
db.close()
console.log('Done processing', filesTcx.length, 'TCX activity files.')
