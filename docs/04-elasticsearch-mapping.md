# Elasticsearch Mapping updates

Giant uses an explicit mapping for the pfi index (possibly others too), which means you'll need to update the elasticsearch
mapping when you want to add new fields to the index. Read more about elasticsearch mappings [here](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/mapping.html).

In Giant the elasticsearch mapping is defined in [ElasticsearchResources.scala](https://github.com/guardian/giant/blob/main/backend/app/services/index/ElasticsearchResources.scala#L24).
In some cases you may find simply updating this file is enough to trigger a mapping update. In other situations
(for example adding a new top level field to the PFI index) you'll need to perform a manual update using the 
[update mapping API](https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-put-mapping.html). 

For example, the field `transcriptExtracted` was added with the command below:

```bash
curl -X PUT "localhost:9200/pfi/_mapping?pretty" -H 'Content-Type: application/json' -d'
{
  "properties": {
        "transcriptExtracted": {
          "type": "boolean"
        }
  }
}
'
```