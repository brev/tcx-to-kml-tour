CREATE TABLE activity (
  id TEXT NOT NULL,
  curr_tkpt_alt_feet REAL,
  curr_tkpt_dist_miles REAL,
  curr_tkpt_lat REAL,
  curr_tkpt_lng REAL,
  curr_tkpt_seq INTEGER NOT NULL,
  curr_tkpt_time TEXT NOT NULL,
  file_kml TEXT NOT NULL,
  file_tcx TEXT NOT NULL,
  tkpt0_time TEXT NOT NULL,
  PRIMARY KEY(id)
);

CREATE TABLE trackpoint (
  activity_id TEXT NOT NULL,
  alt_feet REAL,
  dist_miles REAL,
  lat REAL,
  lng REAL,
  seq INTEGER NOT NULL,
  time TEXT NOT NULL,
  PRIMARY KEY(activity_id, seq),
  FOREIGN KEY (activity_id) REFERENCES activity (id)
);
