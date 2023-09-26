package extraction.email;

import jakarta.mail.internet.MimePart;

// See `mail.mime.contenttypehandler` here: https://docs.oracle.com/javaee/6/api/javax/mail/internet/package-summary.html
// This allows us to intercept crappy MIME types and correct them before the email parser barfs everywhere
public class EmailContentTypeCleaner {
    public static String cleanContentType(MimePart mp, String contentType) {
        return contentType
            .replace("charset='US-ASCII'", "charset=US-ASCII")
            .replace("ISO-8859-6-i", "ISO-8859-6");
    }
}
