
### Data

Put `.TCX` files into `tcx/` directory.

### Database

Initialize fresh & clean sqlite3 database:

```
cat schema.sql | sqlite3 data.db
```

### Import

Import TCX files from `./tcx/` directory into sqlite3 database:

```
node import.js
```
