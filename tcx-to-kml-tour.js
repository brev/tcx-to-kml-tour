// MODULES
const cities = require('cities')
const fs = require('fs')
const mergeImg = require('merge-img')
const moment = require('moment-mini')
const path = require('path')
const Point = require('point-geometry')
const simplify = require('simplify-geometry')
const {tag, tagClose} = require('strxml')
const tcxDom = require('tcx-js')
const textToPng = require('text2png')

// VARS
const activityIds = {}
const dirTcx = 'tcx'
const dirTour = 'tour'
const filesTcx = fs.readdirSync(dirTcx).filter((file) => file.match(/\.tcx/))
const nsKml = {
  'xmlns': 'http://www.opengis.net/kml/2.2',
  'xmlns:gx': 'http://www.google.com/kml/ext/2.2',
}
const optsTcx = {alt_feet: true, dist_miles: true, elapsed: false}
const xmlHead = '<?xml version="1.0" encoding="UTF-8"?>'


// FUNCTIONS

/**
 * Convert distance between two points into an associated time duration value,
 *  intended for rendering camera movement speed.
 */
const calculateDuration = (prevPoint, nextPoint) => {
  const distance = nextPoint.dist(prevPoint)
  let duration = distance / 0.004  // fast = 0.01, slow = 0.001
  if (duration < 0.2) duration = 0.2  // fast = 0.2, slow = 0.5
  return duration
}

/**
 * Figure out direction angle in which to aim the rendering camera, in order to
 *  smoothly continue to next point in path.
 */
const calculateHeading = (prevPoint, nextPoint) => {
  const angleRad = nextPoint.angleTo(prevPoint)
  const normalize = (angle) => (angle < 0) ? (angle + 360) : angle
  const angleDeg = normalize(rad2deg(angleRad))
  const angleMap = Number.parseInt(normalize(0 - (angleDeg - 90)), 10)
  return angleMap
}

/**
 * Create nice text overlay image for metadata display over top of rendering.
 */
const exportPng = (parser, fullPngFile) => {
  const {activity, curr_tkpt, geo} = parser
  const pngPath = path.join(dirTour, fullPngFile)
  const start = moment(new Date(activity['id']))
  const duration = moment.duration(parser['duration_mins'], 'minutes')
  const style = {
    all: {
      lineSpacing: 5,
      padding: 10,
      textColor: 'white',
    },
    font: 'Futura',
    get large() { return Object.assign({}, this.all, {
      font: `35px ${this.font}`,
    })},
    get medium() { return Object.assign({}, this.all, {
      font: `25px ${this.font}`,
    })},
    get small() { return Object.assign({}, this.all, {
      font: `18px ${this.font}`,
    })},
  }
  const content = [
    {
      text: `${geo.city}, ${geo.state_abbr}`,
      style: style.large,
    },
    {
      text: [
        start.format('llll'),
        curr_tkpt['dist_miles'].toFixed(2) + ' miles in ' +
          Math.abs(duration.asMinutes()) + ' minutes',
      ].join("\n"),
      style: style.small,
    },
  ]
  const images = content.map((img) => textToPng(img['text'], img['style']))
  console.log('  generating png:', pngPath)
  mergeImg(images, {direction: true}).then((img) => img.write(pngPath))
}

/**
 * Write out XML markup for KML touring output file.
 */
const exportTour = (trackpoints, fullKmlFile, geo) => {
  const simplifyFactor = 0.00004
  const overlayAttrs = {
    x: '0.066',
    y: '0.933',
    xunits: 'fraction',
    yunits: 'fraction',
  }
  const latlon = trackpoints.map((trackpt) => [trackpt['lng'], trackpt['lat']])
  const lineString = latlon.map((coord) => `${coord[0]},${coord[1]}`).join(' ')
  const placemarks = simplify(latlon, simplifyFactor)
  const pngPath = fullKmlFile.replace(/\.kml/, '.png')
  const tourPath = path.join(dirTour, fullKmlFile)
  let prevPoint = new Point(placemarks[0][0], placemarks[0][1])
  let flyTos, kmlTourXml, nextPoint
  flyTos = placemarks.map((placemark) => {
    let duration, heading
    nextPoint = new Point(placemark[0], placemark[1])
    duration = calculateDuration(prevPoint, nextPoint) || 0.5
    heading = calculateHeading(prevPoint, nextPoint) || 0
    prevPoint = nextPoint
    return tag('gx:FlyTo', [
      tag('gx:duration', duration.toString()),
      tag('gx:flyToMode', 'smooth'),
      tag('LookAt', [
        tag('heading', heading.toString()),
        tag('longitude', placemark[0].toString()),
        tag('latitude', placemark[1].toString()),
        tag('range', '55'),
        tag('tilt', '77'),  // 4x3 => 70.  16:9 => 77.
      ].join('')),
    ].join(''))
  })
  kmlTourXml = xmlHead +
    tag('kml', nsKml, tag('Document', [
      tag('open', '1'),
      tag('gx:Tour', [
        tag('name', `Tour ${geo['city']}, ${geo['state_abbr']}`),
        tag('gx:Playlist', flyTos.join('')),
      ].join('')),
      tag('ScreenOverlay', [
        tag('name', `Image Overlay`),
        tag('Icon', tag('href', pngPath)),
        tagClose('overlayXY', overlayAttrs),
        tagClose('screenXY', overlayAttrs),
      ].join('')),
      tag('Placemark', [
        tag('name', 'Placemark Path'),
        tag('Style', [
          tag('LineStyle', [
            tag('color', 'ccffdd66'),
            tag('gx:physicalWidth', '2'),
          ].join('')),
        ].join('')),
        tag('LineString', [
          tag('coordinates', lineString),
        ].join('')),
      ].join('')),
    ].join('')))
  console.log('  generating tour:', tourPath)
  fs.writeFileSync(tourPath, kmlTourXml)
}

/**
 * Convert Radians to Degrees
 */
const rad2deg = (rads) => {
  return rads * (180 / Math.PI);
}

/**
 * Modify TCX input data to fit our needs before converting to output KML
 * format.
 */
const shapeData = (parser) => {
  const {activity, curr_tkpt} = parser
  const {id, trackpoints} = activity
  const start = moment(new Date(id.trim()))
  const end = moment(new Date(curr_tkpt['time'].trim()))
  const duration = moment.duration(start.diff(end, 'minutes'), 'minutes')
  const pace = Math.abs(duration.asMinutes()) / curr_tkpt['dist_miles']
  // shape activity
  parser['activity']['id'] = id.trim()
  parser['date'] = id.trim().replace(/T.*$/, '')
  parser['curr_tkpt']['lat'] =
    Number.parseFloat(trackpoints[0]['lat']) ||
    Number.parseFloat(curr_tkpt['lat'])
  parser['curr_tkpt']['lng'] =
    Number.parseFloat(trackpoints[0]['lng']) ||
    Number.parseFloat(curr_tkpt['lng'])
  parser['curr_tkpt']['time'] = curr_tkpt['time'].trim()
  parser['duration_mins'] = duration.asMinutes()
  parser['duration_pace'] = pace
  parser['tkpt0_time'] = parser['tkpt0_time'].trim()
  // shape trackpoints
  trackpoints.forEach((trackpoint, index) => {
    parser['activity']['trackpoints'][index]['lat'] =
      Number.parseFloat(trackpoint['lat'])
    parser['activity']['trackpoints'][index]['lng'] =
      Number.parseFloat(trackpoint['lng'])
    parser['activity']['trackpoints'][index]['time'] = trackpoint['time'].trim()
  })
  // geo lookup for city, state, etc
  parser['geo'] = cities.gps_lookup(
    parser['curr_tkpt']['lat'],
    parser['curr_tkpt']['lng']
  )
  return parser
}

/**
 * Verify that a geo point lat/lon pair exist.
 */
const verifyTrackpointGeo = (trackpoint) => {
  return (!(
    Number.isNaN(trackpoint['lat']) &&
    Number.isNaN(trackpoint['lng'])
  ))
}


// MAIN

filesTcx.forEach((file, index) => {
  const fullTcxPath = path.join(dirTcx, file)
  const trackpoints = []
  let parser = new tcxDom.Parser(optsTcx)
  let fullKmlFile, fullPngFile

  parser.parse_file(fullTcxPath)
  if(parser['activity']['trackpoints'].length <= 0) {
    console.log("\n\n!!! Skipping empty file: ", file, "\n\n")
    return
  }
  parser = shapeData(parser, index)
  // uniques only
  if (parser['activity']['id'] in activityIds) {
    console.log("\n\n!!! DUPE ID: ", file, parser['activity']['id'], "\n\n")
    return
  } else {
    activityIds[parser['activity']['id']] = true
  }

  console.log(file)
  fullKmlFile = parser['activity']['id'] + '.kml'
  fullPngFile = fullKmlFile.replace(/\.kml/, '.png')
  parser['activity']['trackpoints'].forEach((trackpoint) => {
    if (! verifyTrackpointGeo(trackpoint)) return
    trackpoints.push(trackpoint)
  })
  exportTour(trackpoints, fullKmlFile, parser['geo'])
  exportPng(parser, fullPngFile)
  console.log()
})

console.log('Done processing', filesTcx.length, ' TCX activity files.')
