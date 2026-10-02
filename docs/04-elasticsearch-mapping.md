# Elasticsearch Mapping updates

Giant uses an explicit mapping for the pfi index (possibly others too), which means you'll need to update the elasticsearch
mapping when you want to add new fields to the index. Read more about elasticsearch mappings [here](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/mapping.html).

Hebrew fields use the [ICU analyzer](https://www.elastic.co/guide/en/elasticsearch/plugins/8.11/analysis-icu-analyzer.html)
provided by the `analysis-icu` plugin. This normalizes and folds Unicode text (including Hebrew vowel marks),
but does not provide Hebrew stemming. The existing language mapping setup adds these fields to both the resource
and page indices; no custom index analysis settings are needed. Quoted searches continue to use the `standard`
analyzer on the `.exact` subfields.

The local Docker image installs the plugin. Rebuild and recreate Elasticsearch with
`docker compose up -d --build elasticsearch`, then restart Giant to add the Hebrew mappings.
Existing documents need re-ingestion to populate the new Hebrew fields.

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
