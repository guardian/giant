package model

import java.io.InputStream

case class ObjectMetadata(size: Long, mimeType: String)
case class ObjectData(data: InputStream, metadata: ObjectMetadata)

