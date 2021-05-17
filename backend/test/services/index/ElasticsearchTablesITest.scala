package services.index

import test.integration.ElasticsearchTestService
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class ElasticsearchTablesITest extends AnyFreeSpec with Matchers with ElasticsearchTestService {
  "Elasticsearch Tables" - {
    "Create the index" in {
      elasticTables.setup().successValue
    }
  }
}
