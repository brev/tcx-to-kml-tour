CREATE TABLE activity (
  id TEXT NOT NULL,
  filename TEXT NOT NULL,
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
