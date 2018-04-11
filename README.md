# TCX to KML Tour

<video src="meta/demo.webm"></video>

Converts [Garmin `.tcx` activity files](https://en.wikipedia.org/wiki/Training_Center_XML)
into `.kml` files for touring or movie-making in
[Google Earth Desktop](https://www.google.com/earth/desktop/).


## Setup

Requirements:
* `git`
* `node` JS

```bash
git clone https://github.com/brev/tcx-to-kml-tour.git
cd tcx-to-kml-tour
npm install
```


## Input

Reads your `.tcx` activity files from `tcx/` directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
    xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="
      http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
      http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Running">
      <Id>2016-10-09T15:03:13+00:00</Id>
      <Lap StartTime="2016-10-09T15:03:13+00:00">
        <Track>
          <Trackpoint>
            ...
```


## Convert

```shell
node tcx-to-kml-tour.js
```


## Output

Writes `.kml` touring and `.png` overlay files into `tour/` directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <gx:Tour>
      <gx:Playlist>
        <gx:FlyTo>
          <LookAt>
            ...
    <ScreenOverlay>
      ...
    <Placemark>
      <LineString>
        <coordinates>
          ...
```
