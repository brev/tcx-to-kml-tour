
### Data

Put `.TCX` files into `tcx/` directory.


### Database

Initialize fresh & clean sqlite3 database:

```shell
cat schema.sql | sqlite3 data.db
```


### Import

Import TCX files from `./tcx/` directory into sqlite3 database:

```shell
node import.js
```

Confirm the import worked:

```shell
sqlite3 data.db  
# select * from activity;
# select * from trackpoint;

ls kml/*.kml
# see list of associated kml files
```


### Calculations

Find activities and miles in total:
```sql
select count(*), sum(curr_tkpt_dist_miles) from activity;
  505|1925.68802997232
```

Find activities and miles *per* each year:

```sql
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2012-%';
  95|220.463629090529
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2013-%';
  139|548.22200414156
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2014-%';
  85|363.548059657324
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2015-%';
  61|281.700321674819
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2016-%';
  60|187.036295542227
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2017-%';
  55|273.862653808403
select count(*), sum(curr_tkpt_dist_miles) from activity where id like '2018-%';
  10|50.8550660574619
```
