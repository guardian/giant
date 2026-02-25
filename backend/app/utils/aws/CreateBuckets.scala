package utils.aws

import com.typesafe.config.ConfigFactory
import services.Config
import software.amazon.awssdk.services.s3.model.CreateBucketRequest

object CreateBuckets {
  def createIfNotExists(): List[String] = {
    val config = Config(ConfigFactory.load())
    val s3Client = new S3Client(config.s3)(scala.concurrent.ExecutionContext.Implicits.global)

    config.s3.buckets.all.foldLeft(List.empty[String]) { (acc, bucket) =>
      if(!s3Client.doesBucketExist(bucket)) {
        val request = CreateBucketRequest.builder().bucket(bucket).build()
        s3Client.s3.createBucket(request)
        acc :+ bucket
      } else {
        acc
      }
    }
  }
}
