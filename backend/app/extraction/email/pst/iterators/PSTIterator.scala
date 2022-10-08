package extraction.email.pst.iterators

import com.pff._

// Used with some of the PSTMessage functions which operate over iterables using pairs of 'getNumberOfBlah' and 'getBlah(index)' functions
abstract class PSTIterator[T](val attachmentCount: Int, getAtIndex: Int => T) extends Iterator[T] {
  private var currentIdx = 0

  override def hasNext: Boolean = currentIdx < attachmentCount

  override def next(): T = {
    val c = getAtIndex(currentIdx)
    currentIdx += 1
    c
  }
}

class AttachmentIterator(msg: PSTMessage) extends PSTIterator[PSTAttachment](msg.getNumberOfAttachments(), msg.getAttachment)
class RecipientIterator(msg: PSTMessage) extends PSTIterator[PSTRecipient](msg.getNumberOfRecipients(), msg.getRecipient)
