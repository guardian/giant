"""Provision the disposable LocalStack instance, including the worker's SSM config.

Run inside the E2E LocalStack container. No requests go to AWS.
"""
import boto3

session = boto3.Session(
    aws_access_key_id="test", aws_secret_access_key="test", region_name="eu-west-1"
)
sqs = session.client("sqs", endpoint_url="http://localhost:4566")
ssm = session.client("ssm", endpoint_url="http://localhost:4566")

for name in [
    "transcription-service-task-dead-letter-queue-DEV.fifo",
    "transcription-service-gpu-task-queue-DEV.fifo",
    "transcription-service-output-queue-DEV",
    "giant-output-dead-letter-queue-DEV.fifo",
    "giant-output-queue-DEV.fifo",
    "giant-media-download-output-dead-letter-queue-DEV",
    "giant-media-download-output-queue-DEV",
]:
    attributes = (
        {"FifoQueue": "true", "ContentBasedDeduplication": "true"}
        if name.endswith(".fifo") else {}
    )
    sqs.create_queue(QueueName=name, Attributes=attributes)

parameters = {
    "gpuTaskQueueName": "transcription-service-gpu-task-queue-DEV.fifo",
    "mediaDownloadQueueName": "transcription-service-media-download-queue-DEV",
    "destinationQueueNames/transcriptionService": "transcription-service-output-queue-DEV",
    "destinationQueueNames/giant": "giant-output-queue-DEV.fifo",
    # The shared config loader also requires settings for services unused by this test.
    "auth/clientId": "unused",
    "auth/clientSecret": "unused",
    "app/secret": "disposable-e2e",
    "app/emailNotificationFromAddress": "unused@example.invalid",
    "app/rootUrl": "http://127.0.0.1:3100",
    "app/sourceMediaBucket": "data",
    "app/transcriptionOutputBucket": "transcription-output-data",
    "app/tableName": "transcription-service-DEV",
    "app/eventsTableName": "transcription-service-events-DEV",
    "app/mediaExportFunctionName": "unused",
    "app/youtubeBlocked": "true",
    "media-download/proxy-ssh-key-secret-arn": "unused",
    "media-download/proxy-ip-address": "unused",
    "media-download/gts-cookie": "unused",
    # Models are cached and HF_HUB_OFFLINE is set; this is never sent to Hugging Face.
    "dev/huggingfaceToken": "unused",
    "worker/artifactBucket": "unused",
    "worker/artifactKey": "unused",
    "llamacpp/modelPath": "/unused",
}
for name, value in parameters.items():
    ssm.put_parameter(
        Name=f"/DEV/investigations/transcription-service/{name}",
        Type="String", Value=value, Overwrite=True,
    )
print("E2E transcription queues and parameters ready")
