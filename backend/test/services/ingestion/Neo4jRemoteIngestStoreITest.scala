package services.ingestion

import com.dimafeng.testcontainers.Neo4jContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import org.joda.time.DateTime
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers
import test.integration.{Neo4jTestContainer, Neo4jTestService}

import scala.concurrent.ExecutionContext.Implicits.global

class Neo4jRemoteIngestStoreITest extends AnyFunSuite with Matchers
  with TestContainersForAll with Neo4jTestContainer {
  override type Containers = Neo4jContainer
  private var database: Neo4jTestService = _

  override def startContainers(): Containers = {
    val container = getNeo4jContainer()
    database = new Neo4jTestService(container.container.getBoltUrl)
    container
  }

  private def run(query: String): Unit = {
    database.neo4jHelper.transaction { tx =>
      tx.run(query).consume()
      Right(())
    }.toOption.get
  }

  private def withJob(check: Neo4jRemoteIngestStore => Unit): Unit = {
    database.deleteAllNeo4jNodes()
    run("""
      MERGE (u:User {username: 'capture-user'})
      CREATE (w:Workspace {id: 'original-workspace'})
      CREATE (p:WorkspaceNode {id: 'original-parent', type: 'folder'})-[:PART_OF]->(w)
      CREATE (f:WorkspaceNode {id: 'destination', name: 'Original name', type: 'folder'})-[:PART_OF]->(w)
      CREATE (f)-[:PARENT]->(p)
    """)
    val store = new Neo4jRemoteIngestStore(database.neo4jDriver, global, database.neo4jQueryLoggingConfig)
    store.insertRemoteIngest(
      "job", "Original name", "original-workspace", "original-parent", "destination",
      "collection", DateTime.now, "https://example.com", "capture-user", "media-task", "snapshot-task", "english"
    ).successValue shouldBe "job"
    check(store)
  }

  test("destination ID survives renaming and moving within a workspace") {
    withJob { store =>
      run("""
        MATCH (f:WorkspaceNode {id: 'destination'})-[r:PARENT]->()
        MATCH (w:Workspace {id: 'original-workspace'})
        CREATE (p:WorkspaceNode {id: 'new-parent', type: 'folder'})-[:PART_OF]->(w)
        DELETE r
        CREATE (f)-[:PARENT]->(p)
        SET f.name = 'Renamed'
      """)
      val job = store.getRemoteIngestJob("job").successValue
      job.destinationFolderId shouldBe Some("destination")
      job.workspaceId shouldBe "original-workspace"
    }
  }

  test("jobs follow their destination when moved to another workspace") {
    withJob { store =>
      run("""
        MATCH (f:WorkspaceNode {id: 'destination'})-[part:PART_OF]->()
        MATCH (f)-[parent:PARENT]->()
        CREATE (w:Workspace {id: 'new-workspace'})
        CREATE (p:WorkspaceNode {id: 'new-parent', type: 'folder'})-[:PART_OF]->(w)
        DELETE part, parent
        CREATE (f)-[:PART_OF]->(w)
        CREATE (f)-[:PARENT]->(p)
      """)
      val job = store.getRemoteIngestJob("job").successValue
      job.destinationFolderId shouldBe Some("destination")
      job.workspaceId shouldBe "new-workspace"
      store.getRelevantRemoteIngestJobs("original-workspace").successValue shouldBe empty
      store.getRelevantRemoteIngestJobs("new-workspace").successValue.map(_.id) shouldBe List("job")
    }
  }

  test("legacy jobs without a destination ID can still be read and listed") {
    withJob { store =>
      run("MATCH (ri:RemoteIngest {id: 'job'}) REMOVE ri.destinationFolderId")
      val job = store.getRemoteIngestJob("job").successValue
      job.destinationFolderId shouldBe None
      job.workspaceId shouldBe "original-workspace"
      store.getRelevantRemoteIngestJobs("original-workspace").successValue.map(_.id) shouldBe List("job")
    }
  }
}
