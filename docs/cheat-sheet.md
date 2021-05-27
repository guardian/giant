# Cheat sheet

How do I...


## Look at the pages index
- Run dev-nginx to get nginx mappings
- Start nginx
- Go to `https://elasticsearch.pfi.local.dev-gutools.co.uk/`

OR

- Go to `http://localhost:9200`

```bash
curl https://elasticsearch.pfi.local.dev-gutools.co.uk/pfi-pages-text
```

OR

https://cerebro.pfi.local.dev-gutools.co.uk/#/rest?host=Local%20Elasticsearch

pfi-pages-text/_search

## Delete things from the pages index

Cerebro is useful
Delete everything (probably don't do this in prod...):

```bash
curl -H 'Content-type: application/json' -XPOST 'http://elasticsearch:9200/pfi-pages-text/_delete_by_query' -d '{
 "query": {
  "match_all": {}
 }
}'
```
