package utils.aws

import com.amazonaws.services.ec2.AmazonEC2AsyncClientBuilder
import com.amazonaws.services.ec2.model.{DescribeInstancesRequest, DescribeInstancesResult, Filter}
import utils.attempt.Attempt

/**
  * An example uses of the AsyncHandler
  */
object AwsExamples {
  import scala.concurrent.ExecutionContext.Implicits.global // yeah, don't do this...

  val ec2 = AmazonEC2AsyncClientBuilder.defaultClient()

  /*
   * Unfortunately the Java future (prior to 8) is a bit rubbish so the AsyncHandler is preferable.
   * This helper does the heavy lifting.
   */
  val request = new DescribeInstancesRequest().withFilters(new Filter().withName("tag:Stack").withValues("investigations"))
  val response: Attempt[DescribeInstancesResult] = AwsAsyncHandler.awsToScala(ec2.describeInstancesAsync)(request)
  /* ---------  ^^^^^^^ hurrah! an attempt! */
}
