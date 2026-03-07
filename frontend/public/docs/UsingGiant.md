# **Using Giant** {#using-giant}

_Navigate this user guide using `Cmd-F` (`Ctrl-F` on Windows) to find keywords, or by clicking on headers in the sidebar. Within the guide text, links are shown in bold and a distinct colour._

[Giant](/) is a tool for securely searching, managing and sharing documents and data. It supports PDF, Office documents, emails, ZIP files, audio, video and more.

It can extract searchable text from documents that do not already have it (known as [OCR](https://en.wikipedia.org/wiki/Optical_character_recognition)). For example, PDFs of scanned paper documents and photographs containing text are searchable in Giant.

To get access to Giant email [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk) and [esd@guardian.co.uk](mailto:esd@guardian.co.uk). And for help, also email those teams rather than the IT Service Desk.

## **Why put stuff into Giant?** {#why-put-stuff-into-giant}

- All files saved into Giant are stored in an encrypted file system under the Guardian's control. Google, Amazon etc cannot read the content.
- Searching in Giant is much easier than on a hard disk, because you can control the scope of your search, and because Giant performs [optical character recognition](https://en.wikipedia.org/wiki/Optical_character_recognition) on all documents, meaning even photos of documents or "unsearchable" JPEG or PDF documents become searchable.
- Having a document in Giant addresses the risk of document proliferation, where multiple versions of a document shared between different people end up in multiple locations (download folders on different computers, private user folders, email attachments, messenger attachments, etc). If something is in Giant, everyone with permission can view it without having to make a copy. And if we need to get rid of something, the task is simple because it's just in one place.
- For similar reasons, Giant gives you document portability. You don't need to take a copy to work from home – just access it in Giant from anywhere.
- Because Giant 'renders' the file for you, you don't need to install special software on every computer you use to view unusual file types such as emails.

## **Quick start** {#quick-start}

If you're new to Giant, this is the fastest way to get started:

1. Open [**Search**](/search), choose relevant datasets/workspaces in the sidebar, and run a simple keyword search.
2. Open a result and use `Cmd-F` (`Ctrl-F` on Windows) to search within the document itself.
3. Create a workspace in [**Workspaces**](/workspaces) using the **New Workspace** button.
4. Upload files to that workspace by dragging files in, or by using the Upload button.
5. Share the workspace (if needed) with colleagues using **Share Workspace**.

For details on each step, see the [**Search page**](#the-search-page), [**Viewing documents**](#viewing-documents), [**Workspaces**](#workspaces), and [**Sharing access to documents in a workspace**](#sharing-access-to-documents-in-a-workspace).

## **Giant’s three main sections** {#giants-three-main-sections}

At the top of every Giant window you will find links for the three main entry points for Giant's data: 'Search', 'Datasets' and 'Workspaces'.

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/01_title_bar.png" alt="Giant header showing Search, Datasets, and Workspaces tabs" width="100%" />

<div class="doc-caption">

The three main Giant sections are shown at the top of every page.

</div>

</div>

- The [**Search**](/search) page allows you to search for content using a sophisticated search interface.

- The [**Datasets**](/collections) page allows you to browse through collections of material that you have permission to view. There are two kinds of dataset:
  - Large collections of related documents such as a tranche of leaked material provided by a source. These are created when the Investigations & Reporting team bulk upload such a collection.
  - The sum total of an individual user's uploads. Each user has their own personal dataset.

Documents in datasets are organised in the same structure as the source material that was uploaded into Giant. You cannot rearrange items in datasets.

- [**Workspaces**](/workspaces) are user-defined collections of documents, from one or many datasets. Workspaces can be created, named and organised by any Giant user. Workspaces organised like an editable file system so – provided you have access – the documents therein can be arranged into folders; and they can be renamed, added, removed, etc.

You can use workspaces either to create curated selections of significant documents from datasets, from workspaces shared with you, and from documents you upload yourself.

| **Note** | Documents don't actually _live_ inside workspaces. Under the hood, workspaces are collections of links to documents that come from one or more datasets. When you upload documents 'into' a workspace, what you're actually doing is uploading the files to your personal dataset (mine is called 'Luke Hoyland Documents') and then making a reference to that document within your active workspace. You can see _all_ your uploads - no matter what workspaces they are in - if you go to your own dataset. |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

# **The Search page** {#the-search-page}

Click the **Search** button in the top left of any Giant screen to get to the search page.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/02_1_search_page_empty.png" alt="Empty Giant Search page" width="100%" />

<div class="doc-caption">

The Giant search page.

</div>

</div>

## **Search filters** {#search-filters}

First, select the areas in Giant that you want to search. The left-hand sidebar in Giant shows a list of the datasets and workspaces that you have access to. Click the checkbox for specific ones to limit the scope of your search to those datasets and workspaces. If you don't have any checkboxes checked, Giant will search everything that you have access to.

Below the search bar you'll see a set of filters, including for Workspaces and Datasets. You can select and deselect them using these filter buttons also. We call them 'chips'.

<div class="doc-figure" style="width: 100%;">

<img src="/docs/images/02_2_search_chips.png" alt="Search filters shown as chips below query bar" width="100%" />

<div class="doc-caption">

This filter will restrict your search to material that is in dataset 'Luke Hoyland Documents' and/or in the workspace 'Eine kleine workspace'.

</div>

</div>

Below the Datasets and Workspaces on the left-hand panel are some extra ways to filter your search: **Creation Date** and **File Type**. They also have corresponding 'chips' below your search query.

- If you select a **Creation Date** Giant will filter down its results to those that it knows were created within the date range you have selected. Please be aware that this date is not always known, so searching by date can sometimes mean things don't get returned that perhaps should.
- In the Creation date chip, if you select an end date but no start date, Giant will display all matching files created before that date. Similarly, if you select a start date but no end date, you'll see all matches created after that date.
- If you select one or more **File Types** Giant will only search documents of those types.

You can also perform excluding or **'negative searches'** by switching the sidebar checkbox to a 'minus', and similarly with the button on the left of each chip. This will filter your searches to everything **except** the values in that filter.

<div class="doc-figure" style="width: 30%;">

<img src="/docs/images/02_3_search_chips_negative.png" alt="Negative search chip excluding a dataset" width="100%" />

<div class="doc-caption">

This negative search filter will exclude anything from the Dataset 'Luke Hoyland Documents'.

</div>

</div>

## **The Search field itself** {#the-search-field-itself}

By default, if you simply type some words into the search field in Giant, it will search for any document that contains those words somewhere within the document.

This will include text in images, words spoken in audio and video files, etc.

If you put your search in quotes it will only return matches of the words _in that exact order_.

If you want to be more sophisticated than that, there are more options available. These are called [search operators](#search-operators).

## **Search operators** {#search-operators}

Under normal conditions Giant will search for documents containing every word in your search term. But you can use special syntax to perform more advanced searches:

- **OR / ||**: If you type the search term `X OR Y` or `X || Y` Giant will search for documents that either contain X or Y. Remember to use uppercase `OR`, or Giant will search for `or`.
- **NOT / !**: If you type `NOT X` Giant will search for documents that don't contain X. Same goes for `! X`.
- **AND / &&**: If you type `X AND Y` or `X && Y` you're telling Giant that both X and Y must be in the document. Remember to use uppercase `AND` for it to be treated as a search operator. `AND` is actually the default behaviour for Giant, but can be useful if you already have an `OR` operator in your search. This is where parentheses come in...
- **(parentheses)**: Putting stuff in brackets tells Giant the scope of multiple operators. Two examples:
  - `(X OR Y) AND Z` means the documents can contain X or Y, but they must always contain Z. `(X || Y) && Z` does the same thing.
  - `(X AND Y) NOT Z` means Giant searches for documents that contain X and Y, but don't contain Z. `(X && Y) ! Z` does the same.

- **Fuzzy matches**: Sometimes you want to include documents containing spelling mistakes, in order to do this you can use the `~` character to perform a 'fuzzy' search. The query `mississippi~` would allow up to 2 characters to be mistyped. You can be explicit with how many characters you want to allow to be mistyped by including a number after the `~`. So `mississippi~4` would allow up to 4 wrong characters.
- **Proximity**: As we said earlier, if you put a search term in quotes Giant will search for that exact set of words in that exact order. Proximity allows you to be a bit slacker with that determination. If you combine a quoted search with that _~_ character again, you're telling Giant the words don't have to be in that exact order, so long as they appear close to each other. You can define how close with a number.
  - For example, the phrase query `"quick fox"` would match only this exact phrase, but if we modify that to `"quick fox"~10` Giant will match documents where the terms `quick` and `fox` are within 10 words of each other.

- **Wildcards**: _Warning: wildcard queries can be very inefficient, take a long time to complete and potentially cause system instability. This is especially true when a wildcard is used to prefix a term. Only use when necessary._
  - **Single-character wildcards**: The question mark operator can be used to substitute characters. For example, `?at` would match cat, mat, sat, etc.
  - **Multiple-character wildcards**: Unlike the `?` operator, the `*` operator allows multiple characters to match. For example, `f*t` would match fat, flat, first, format, etc.

## **Search troubleshooting** {#search-troubleshooting}

Sometimes you'll receive the message that a search has failed and you should check your query. This can happen for several reasons, but often it's because your query contains characters which are part of the query syntax. These are called unescaped special characters or unescaped control characters.

Giant's query syntax has powerful features such as phrase queries, regular expressions and proximity queries. Unfortunately these features require the use of special characters under the hood, effectively preventing you from searching for terms that actually contain those same characters. One example of this is the forward slash: `/`. This is used to define a regular expression query such as `/joh?n(ath[oa]n)/` to return all permutations of the name Jon/John/Jonathon/Jonathan. But of course forward slashes are often used in file paths (such as in URLs), so there may be times that forward slashes are a part of what you're looking for.

To prevent Giant's query parser from interpreting your forward slash as the beginning of a regular expression query, you can _escape_ the forward slash by preceding it with a back slash, like so: \/.

Escaping means converting a special character which means something to the query language and making it be treated like a literal character.

The following is a list of characters you will need to escape if you want to search for the literal character:

<div style="width: 30%;">

| Character you want to search | How to 'escape' it             |
| :--------------------------- | :----------------------------- |
| +                            | `\+`                           |
| -                            | `\-`                           |
| &&                           | `\&&`                          |
| \|\|                         | <code>&#92;&#124;&#124;</code> |
| !                            | `\!`                           |
| (                            | `\(`                           |
| )                            | `\)`                           |
| {                            | `\{`                           |
| }                            | `\}`                           |
| ^                            | `\^`                           |
| "                            | `\"`                           |
| ~                            | `\~`                           |
| \*                           | `\*`                           |
| ?                            | `\?`                           |
| \                            | `\\`                           |

</div>

## **Search results** {#search-results}

If your search gets a hit, the documents that match the search terms will be listed below. The search terms will be highlighted, showing the surrounding text to give you some context.

<div class="doc-figure" style="width: 80%;">

<img src="/docs/images/02_search_results_highlighted_rev.png" alt="Search results with highlighted matches" width="100%"  />

<div class="doc-caption">

Search results showing matches in context

</div>

</div>

The result will provide a preview of the surrounding text of the search hit, so you can get an idea of the context.

As you can see in the illustration above, some documents will show multiple hits: up to five are listed. There are two reasons for this:

1. Giant performs optical character recognition (OCR) on many document types, sometimes in multiple languages. This means that for such documents there is a searchable index of not only the regular text in the document but also of each set of 'OCR' text extracted from the documents. Sometimes this will take you to the same content as the text search hit; sometimes to something that wasn't originally searchable (such as some words in an image).
2. Some documents will contain multiple instances of some of the terms you searched for, so up to five matches are shown per document.

## **Search URLs** {#search-urls}

Almost everything you do in Giant causes the URL in the location bar to be updated. So if you perform an interesting search and want to save it, or share it with a colleague, just copy that URL and store it/send it/whatever.

Note, however, that these URLs will not produce the same results if the person you share with them has different permissions to you on the material being searched. They may not be allowed to perform the search at all.

# **Viewing documents** {#viewing-documents}

You can view documents by getting to them through several different routes:

- Performing a [search](#the-search-page) and clicking on a search result.
- Navigating through a [workspace](#workspaces) and double-clicking on a file you find therein.
- Browsing through a dataset and double-clicking on a file you find therein.
- Traversing through the filesystem from another document by clicking on the first document's path in the document sidebar and navigating to a document elsewhere in the same file path.

The document will be opened in a document viewer window. This consists of a sidebar with some information about the document (location, upload information, and any metadata that Giant extracted from the document), plus the document view itself. Document views come in several different flavours, depending on file format:

- **Text based documents** such as PDFs and MS Word documents are displayed in a single view, with the OCR'd text overlayed on top of the original document. Search term matches will be highlighted in the document itself. You can also search for other terms within the documents and these will be highlighted in a different colour to the original search term matches. We call this flavour the **combined view mode** because the extracted text and the original file are presented in the same view.
- **Emails** are displayed in a form that resembles an email, showing the To:, From:, Subject: fields etc.
- **Spreadsheets** are displayed as a searchable table. At the time of writing this is limited in utility.
- **Other document types** - raw text, images, audio, video, etc (plus any files Giant didn't convert into the above flavour) - have multiple 'view modes', with the searchable text displayed in a different view to the original media. Documents are initially opened in the extracted text mode to allow you to see search results (and perform further searches in the document)

## **Combined view documents** {#combined-view-documents}

<div class="doc-figure" style="width: 80%;">

<img src="/docs/images/03_1_docviewer_page.png" alt="Combined document view with highlighted search match" width="100%"  />

<div class="doc-caption">

A 'combined document view'. If you came to this document via a search, the first match for the search will be displayed, highlighted in cyan

</div>

</div>

Some documents will contain more than one match of your search term. In the combined document view you can step through each match using the widget at the top right of the page. Pressing the down arrow will take you to the next match in the document.

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/03_docviewer_twin_search_widget.png" alt="Two-level find widget in combined document view" width="100%"  />

<div class="doc-caption">

When you come to a 'combined view' document through a search, the find widget has two levels: the top level lets you step through matches for your original search term. The second level allows you to search for anything else within the current document.

</div>

</div>

If the content in the document is difficult to read, you can try the following:

- Expand or contract the window content using the zoom buttons:

  <img src="/docs/images/04_1_docviewer_zoom.png" alt="Document viewer zoom controls" width="40%" />

- Rotate documents on their side using the rotation buttons:

  <img src="/docs/images/04_docviewer_rotate.png" alt="Document viewer rotation controls" width="40%" />

- If all else fails, use the "View as Text" button in the sidebar:

  <img src="/docs/images/04_2_docviewer_view_as_text.png" alt="View as Text button in document sidebar" width="75%" />

## **Searching within a combined view document** {#searching-within-a-combined-view-document}

You can search for things within the document itself, without going back to Giant's search page. Press `Cmd-F` (`Ctrl-F` on Windows) or type something into the search-in-document widget. If you came to the document from a search, this appears below the main search widget. If you came to the document by browsing, it'll be the only widget there.

<div style="width: 75%;">

| _Searching for text in a document found by search:_                                 | _Searching for text in a document found by browsing:_   |
| :---------------------------------------------------------------------------------- | :------------------------------------------------------ |
| _![Docviewer searchresults find](/docs/images/05_docviewer_searchresults_find.png)_ | _![Docviewer find](/docs/images/06_docviewer_find.png)_ |

</div>

## **Documents with multiple view modes** {#multi-view-documents}

Giant can process other file formats such as emails, images, video files, audio files. For many of these when you open the file you'll be given the option to view it in different ways. For example:

## **Image files** {#image-files}

All image files are processed by Giant's optical character recognition engine to extract text into an accompanying textual 'view', meaning you can find text in images through this OCR text. When you first open an image document the 'OCR text' view may be shown instead of the image itself when you open the document. If there's no text this may be a pretty uninteresting page! To view the image itself instead, look at the bottom right of the window and you'll see alternative view modes, including 'Preview'. Use 'Preview' to view the image itself.

<div class="doc-figure" style="width: 80%;">

<img src="/docs/images/06_1_docviewer_image_switch_to_preview.gif" alt="Animated demo of switching an image document from OCR text to Preview mode" width="100%"  />

<div class="doc-caption">

An image opened from a search result. The user switches to 'Preview' view mode

</div>

</div>

## **Audio and video files** {#audio-and-video-files}

In a similar fashion to the way Giant extracts text from images, it transcribes and translates spoken content in audio and video files. Again, these searchable transcription 'view modes' will be what you see when you open those files, because that 'view' is the searchable one. If you want to see or hear the original media file, switch to Preview mode.

<div class="doc-figure" style="width: 80%;">

<img src="/docs/images/06_1_docviewer_video_switch_to_preview.gif" alt="Animated demo of switching a video document from transcript text to Preview mode" width="100%"  />

<div class="doc-caption">

Video and audio files initially open with the transcript text. Click Preview view mode to see the video itself

</div>

</div>

<div style="width: 50%;">

| **Note** | The list of languages that the transcription system supports can be found [here](https://github.com/openai/whisper/blob/ba3f3cd54b0e5b8ce1ab3de13e32122d0d5f98ab/whisper/tokenizer.py#L10). At the time of writing it's 100 languages. |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

</div>

# **Workspaces** {#workspaces}

Workspaces are like a folder structure on a computer or a server. You can create workspaces, create folders within them, upload documents into them, move documents around within them or add documents from elsewhere in Giant.

The two principal uses of workspaces are:

1. To create a curated set of documents from a big dataset. Often a big dataset will include masses of stuff that isn't interesting. Workspaces allow you to bookmark the things that are, and organise them however you see fit.
2. As a repository for documents that you have uploaded into Giant. (See [Why put stuff into Giant](#why-put-stuff-into-giant)).

These use cases are non-exclusive. You can, for example, have a workspace containing documents from multiple datasets along with additional files you have uploaded yourself. And a single file can be in as many different workspaces as you want.

Files in a workspace are **private to you by default** – however you can share access with others within the Guardian. You can choose to create a 'public' workspace – which makes the contents viewable for all other Giant users at the Guardian – or you can [add specific users to a workspace](#sharing-access-to-documents-in-a-workspace) to share its documents with those people.

## **Finding workspaces** {#finding-workspaces}

All the workspaces that you currently have permission to view are shown in the search sidebar in Giant and in the [Workspaces](/workspaces) section.

In the Workspaces section they are grouped into three lists:

1. Workspaces you created. This may include entirely private workspaces and workspaces that you have shared with others. You have full control over these workspaces.
2. Workspaces that someone else created and shared with you. You can add files to these workspaces, and organise their structure. But you can't delete them or change their sharing settings.
3. Public workspaces that are viewable by all Giant users at the Guardian. These are used for collections of non-confidential material that is already in the public domain. Your access controls for these depend on whether you created them (full control, like type 1\) or someone else (same control as for other workspaces shared with you, like type 2).

## **Creating a new workspace** {#creating-a-new-workspace}

In Giant, click the **Workspaces** button at the top of the screen and hit the **New Workspace** button in the left-hand sidebar.

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/07_workspaces_new_button.png" alt="New Workspace button in Workspaces sidebar" width="100%"  />

<div class="doc-caption">

The New Workspace button

</div>

</div>

You'll be shown the New Workspace dialog box:

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/08_workspaces_new_dialog.png" alt="New Workspace dialog with name, colour, and Public option" width="100%"  />

<div class="doc-caption">

Give the workspace a name and a tag colour if you want to organise your workspaces into different categories. Don't click the 'Public' checkbox before reading the following section

</div>

</div>

## **Public workspaces** {#public-workspaces}

The **Public** checkbox in the New Workspace dialog allows you to create a workspace that is visible to all other users of Giant at the Guardian. It isn't completely public\!

Public workspaces should really only be used for material that is already in the public domain and that has no special data protection status. The material is technically secure, but since hundreds of people have access it's unwise to put anything confidential in here.

Don't click on this if you want to keep your workspace private to you, or if you plan to share your workspace with a limited number of colleagues. To achieve the latter see [Sharing access](#sharing-access-to-documents-in-a-workspace) below.

## **Uploading new documents into a workspace** {#uploading-new-documents-into-a-workspace}

Workspaces are where you upload and organise your files in Giant. To begin you upload your files to a workspace and you can then browse and search through them.

Navigate to a workspace. Click on nothing if you want to upload files to the top of the workspace. Or click on a folder within the workspace to upload files to that folder. Then tell Giant what files you want to upload in one of two ways:

**1. Manual upload**

Drag a selection of files, or a directory and all its contents, into the spot in the workspace that you want to upload the files to.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/09_1_workspaces_upload_drag.gif" alt="Animated demo of dragging files or folders into a workspace to upload" width="100%"  />

<div class="doc-caption">

Drag a folder or some files to somewhere in your workspace

</div>

</div>

<div style="width: 50%;">

| **Note** | You can't select a combination of files and directories at the same time because your computer may misreport the selection to the browser. |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------- |

</div>

**2. The Upload button**

Click the Upload button at the top of the screen:

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/09_workspaces_upload_button.png" alt="Upload button in a workspace" width="100%"  />

<div class="doc-caption">

Workspaces upload button

</div>

</div>

If you do the latter you'll be shown a window where you can choose one of two options:

<div class="doc-figure" style="width: 60%;">

<img src="/docs/images/10_workspaces_upload_selection_dialog.png" alt="Upload selection dialog with Add Files and Add Directory" width="100%"  />

<div class="doc-caption">

The upload selection dialog, showing the location you chose to upload the files to

</div>

</div>

- **Add Files** to add specific files from your computer to your chosen location in the workspace. You can select more than one file at once if your computer allows it. The files will be added side by side to your chosen location in your workspace.
- **Add Directory** to add an entire folder from your computer to the chosen location in the workspace. Here the directory structure on your computer will be preserved: everything will end up inside a folder of the same name, and any subfolders therein will have been retained with their original contents.

Your computer will now open a file picker dialog. Navigate to the files or folder you want to upload, select them, then hit OK/Open/Upload or whatever button it is that your computer shows to upload the files.

## **Confirming the upload selection** {#confirming-the-upload-selection}

Whether you dragged files into the workspace manually or went via the Upload button, before the files actually upload you'll be shown a list of what you've chosen, for you to review:

<div class="doc-figure" style="width: 60%;">

<img src="/docs/images/10_1_workspaces_upload_review_dialog.png" alt="Upload review dialog showing selected files and folders" width="100%"  />

<div class="doc-caption">

The upload selection review dialog for 'Add Directory'. You can expand subfolders to see what's inside them. Hit X to remove anything from the list to be uploaded

</div>

</div>

- If you selected too many things you can click on the X icon to remove them from the stuff you're going to upload.
- If you've gone completely wrong, click outside the list to cancel and start again.

Once you're happy, hit **Upload**. Giant will start uploading the files. If there are a lot **please don't close the window**. The upload is being performed by your browser. Don't interrupt it. You can of course move to a new tab while it plods away.

Once uploaded, the files will appear in the workspace. The spinning icon indicates that Giant is **processing** the files. For some tasks, such as transcription, translation, and OCR, the time this takes will depend on how big the file is (for example how many pages it has). Files that are 'processing' are already uploaded, so at this stage you can safely navigate away from the page.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/11_workspaces_file_listing_processed.png" alt="Workspace file list showing processing status" width="100%"  />

<div class="doc-caption">

Once a file shows as 'processed', Giant has extracted all the text and made a safely viewable version of the file

</div>

</div>

Once a file says it has 'processed', you can [view](#viewing-documents) it or [search](#the-search-page) for it.

As noted earlier, files uploaded via a workspace are stored in your personal dataset, and the workspace keeps references to them. In day-to-day use, you can treat workspace entries just like files.

## **Saving web content into Giant** {#saving-web-content-into-giant}

You can give Giant the URL of a webpage and it will snapshot the page, extract the text, and ingest, transcribe and translate any multimedia content therein (such as videos). There are two ways to do this:

## **Tell Giant to fetch content from a URL** {#tell-giant-to-fetch-content-from-a-url}

Within a workspace click the **Capture from URL** button:

<div class="doc-figure" style="width: 100%;">

<img src="/docs/images/12_workspaces_capture_from_url_button.png" alt="Capture from URL button in workspace" width="100%"  />

<div class="doc-caption">

The Capture from URL button

</div>

</div>

Enter the URL of the page you want captured and where in the workspace you want to save it.

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/13_workspaces_capture_from_url_selection_dialog.png" alt="Capture from URL dialog with URL and destination options" width="100%"  />

<div class="doc-caption">

The Capture from URL dialog with options to choose a workspace, workspace folder, and name

</div>

</div>

Giant will go and fetch it. If the page contains audio or video content this process can take more than 15 minutes because our transcription service will attempt to transcribe and translate any spoken content. You do not need to wait on the page while files are being processed.

## **Send a webpage to Giant** {#send-a-webpage-to-giant}

While browsing the internet you may wish to save the content of something you view on a webpage or social media post. You can send the material directly to Giant from there. Video and audio will be transcribed and translated, and the whole thing will be searchable for later retrieval.

This feature only works if your browser has the [Guardian Staff Extension](https://sites.google.com/a/guardian.co.uk/esd/web-tools/composer-workflow/teleporter/), aka Teleporter.

From a webpage right-click and opt to **Capture with Giant**. You’ll be given the same options as above, after which you can go about your browsing business while Giant grabs the material and stores it for you.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/14_workspaces_capture_from_url_workflow.gif" alt="Workflow for capturing web content with Giant" width="100%" />

<div class="doc-caption">

Workflow for capturing web content with Giant.

</div>

</div>

## **Adding existing Giant files to a workspace** {#adding-existing-giant-files-to-a-workspace}

You can add files that are already in Giant to a workspace, even if they're already in some other workspace. The first method allows you to add an existing file to any workspace, including a new one. The second method allows you to move or copy one or many files and folders from one workspace to another.

### **Method 1: if you have a document open in Giant** {#if-youre-in-a-document}

Use this method if you have a file open but not the workspace(s) that it may belong to. This could happen if someone sent you the URL of the file, or if you found the file in search. You can add any file that you open to as many workspaces as you like. The files themselves aren’t duplicated \- Giant just keeps a record of which workspaces the file has been added to. So even if the file belongs to someone else, if you add it to a new workspace it won’t disappear from wherever they had it.

Open the file. In the left-hand sidebar you will see the **Add to Workspace** button.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/15_1_docsidebar_add_to_workspace_button.png" alt="Add to Workspace button in document sidebar" width="100%"  />

<div class="doc-caption">

The Add to Workspace dialog button is shown in a document's sidebar

</div>

</div>

You'll be shown a dialog box where you should pick a target workspace. Every workspace that you have access to will be listed in the dropdown menu. (If you want instead to add the file to a brand new workspace, [create it](#creating-a-new-workspace) first.) You can abbreviate the list by typing some characters that appear in the workspace name: the list will shorten to show only those workspaces with that text in their name.

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/15_docsidebar_add_to_workspace_dialog.png" alt="Add to Workspace dialog with workspace and folder selection" width="100%"  />

<div class="doc-caption">

The Add to Workspace dialog, with options to pick a workspace, a location within that workspace, and a new name for the document if you so wish

</div>

</div>

Once you have selected a workspace, the dialog will show the folder structure of that workspace. Expand the arrows to select a specific location. If you accidentally select a folder but you want to save the file at the top of the workspace, clear the selection by choosing a different workspace in the dropdown menu and then reselecting your intended workspace.

As with all documents in a workspace, you can rename them to something that makes more sense to you. This will rename the file as shown in your target workspace only – not in any other location. To rename the file change the text in the **Save As** field.

Then hit **Save**. Now navigate to your workspace and you'll see the file there.

### **Method 2: moving or copying files from one workspace to another workspace** {#method-2-moving-or-copying-a-file-from-one-workspace-to-another-workspace}

Use this method if you have files or folders in a workspace but want to move or copy them into another workspace in order to share it with different people, to have copies of the material in different workspaces for different projects, etc.

1. First, make sure that the workspace you want to put the files into exists, and is [shared with the right people](#sharing-access-to-documents-in-a-workspace).
2. Now switch to the workspace where the files already are.
3. Select the material and drag from the 'source' workspace into the 'target' workspace entry in the sidebar to the left.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/17_1_workspaces_drag_to_move_animated.gif" alt="Animated demo of dragging items from one workspace to another" width="100%"  />

<div class="doc-caption">

Drag to copy or move files from one workspace into another

</div>

</div>

4. You’ll be shown a dialog asking if you want to copy these items or move them. 'Copying' makes a new reference to the file in the target workspace, so that it appears in both places. 'Moving' removes the file/folder entry in the source workspace and puts it in the new workspace.
5. Now switch to that workspace and put the file or folder in the exact location within that workspace that you want. (See [Organising files in a workspace](#organising-files-in-workspaces) below)

## **Organising files in workspaces** {#organising-files-in-workspaces}

To **create a folder** click the **New Folder** button:

<div class="doc-figure" style="width: 40%;">

<img src="/docs/images/16_workspaces_new_folder_button.png" alt="New Folder button in a workspace" width="100%"  />

<div class="doc-caption">

Making a new folder in a workspace

</div>

</div>

To **move files** just drag them around, like you do in the Finder on a Mac. `Shift-click` and `Cmd-click` will work for multiple selections:

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/17_workspaces_drag_to_move.png" alt="Dragging files and folders within a workspace" width="100%"  />

<div class="doc-caption">

Moving selections around in a workspace

</div>

</div>

To **rename a file** or **remove a file**, right-click on it:

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/18_workspaces_contextual_menu_rename.png" alt="Workspace context menu with Rename option" width="100%"  />

<div class="doc-caption">

You can rename a file in a workspace by right-clicking on it

</div>

</div>

Note that renaming a file here will just rename it in this workspace. The original document in a dataset, or links to it in any other workspace, will not get renamed.

When **removing a file from a workspace,** the file is only removed from that workspace and remains in Giant as well as in any other workspaces it has been added to. To permanently delete something from Giant, see [Delete files completely](#delete-files-completely).

If you alone own a document (i.e. no one else uploaded the same file), you may be able **delete it from Giant entirely** by right-clicking on it in your workspace and opting to 'Delete file'.

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/19_workspaces_contextual_menu_delete.png" alt="Workspace context menu with Delete file option" width="100%"  />

<div class="doc-caption">

If you're the sole owner of a file, you can delete all trace of it from Giant

</div>

</div>

Please note that it isn't always possible to delete files for several reasons. For example the file may be shared with someone else. Or someone else may have an identical file for different reasons. Because of Giant’s security design it is intentionally not possible for one user to know which other users have a file or have permission to view it. So Giant can’t actually tell you why something can’t be deleted. If Giant refuses to delete a file and you need it to be deleted for everyone, please contact [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk) and we’ll try to help.

## **Searching for documents in a workspace** {#searching-for-documents-in-a-workspace}

At present there are two ways to do this:

1. You can search a folder within a workspace by right-clicking on that folder.
2. You can search the workspace you are in by means of the **Search Workspace** button at the top.
3. You can search combinations of one or more whole workspaces (and/or datasets) by selecting those items in the sidebar of Giant's [Search view](#the-search-page).

### **1. Searching a single folder in a workspace** {#searching-a-single-folder-in-a-workspace}

Go to your workspace and right-click on the folder that you want to search. You'll see an option to **Search in Folder**:

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/20_workspaces_contextual_menu_search_in_folder.png" alt="Folder context menu with Search in Folder option" width="100%"  />

<div class="doc-caption">

Right-click on a folder to tell Giant to perform a search of the documents inside it

</div>

</div>

This will take you to Giant's search view, with that workspace and folder preselected as [chips](#search-filters) in active filters:

<div class="doc-figure" style="width: 100%;">

<img src="/docs/images/21_search_chips_workspace_folder.png" alt="Search page with workspace and folder chips preselected" width="100%"  />

<div class="doc-caption">

After you choose 'Search in Folder', Giant takes you to the Search page, with the workspace and folder preselected as filters

</div>

</div>

Now, type whatever it is you want to search for and hit Search (or just Enter/Return). Giant will restrict its search to just the folder that you selected.

### **Searching a whole workspace** {#searching-a-whole-workspace}

Click **Search** in the Giant page header to switch to Giant's search view:

<div class="doc-figure" style="width: 100%;">

<img src="/docs/images/22_workspaces_search_workspace_button.png" alt="Search Workspace button in workspace header" width="100%"  />

<div class="doc-caption">

Click the Search Workspace button to restrict a search to stuff in that workspace

</div>

</div>

For more on search see [the Search section above](#the-search-page).

## **Sharing access to documents in a workspace** {#sharing-access-to-documents-in-a-workspace}

Documents uploaded to a workspace you create are **private to you by default**. However you can choose to share any workspace that you created.

To share access with others, click the **Share Workspace** button that is displayed when you are viewing your workspace:

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/24_workspaces_share_dialog.png" alt="Share Workspace dialog with email list" width="100%"  />

<div class="doc-caption">

Sharing a workspace with colleagues

</div>

</div>

Add the email addresses of who you want to have access. These people **will be able to** **view and edit anything in the workspace**: they can add files, rename them, move them and remove them. These people **will not be able to delete the workspace, rename it, or share it with more people**.

You can remove people by clicking the `X` next to their email. If you remove everyone only you will have access.

The **Public** checkbox gives all Giant users at the Guardian access to the workspace. This will move the workspace out of the **Created by Me** list in the **Workspaces** view and into the Public list.

Note that workspace sharing settings apply to all of the documents in a workspace – including, for example, documents that you added from a dataset that a sharer does not have full access to. (They'll be able to access just the documents you have shared with them via your workspace.) If you don't want to share all the files in a workspace with the same set of people, make another workspace, share it with the right people, and then go back to your first workspace and add only the right items to the new workspace using the [Add to Workspace option](#adding-existing-giant-files-to-a-workspace) described above.

You can see who a workspace is shared with by hovering over the text that says how many people it is shared with.

## **Workspace URLs** {#workspace-urls}

Once you have shared access with a workspace, you can refer to it by its URL: URLs in Giant are the same for everyone, so you can point people at files or workspaces by copying the URL and sending it to a colleague. You can also direct colleagues to particular folders within the workspace by clicking on that folder (or a file within it) and copying the URL from your browser’s location bar. If you send your colleague that URL it will open that particular location within the workspace.

# **Datasets** {#datasets}

In practice you will mostly work with search and with workspaces, rather than with datasets – unless you are working on a big project involving a big, shared set of files that have been leaked to the Guardian.

Under the hood in Giant, documents are organised into datasets. These are large collections of documents. So far as you are concerned there are two kinds of datasets:

- Large collections of related documents that were added en masse by the Investigations & Reporting engineering team or ESD. These tend to be big data leaks and that sort of thing.
- Your own personal dataset. This contains all the files that you have uploaded into Giant using the [upload to workspace](#uploading-new-documents-into-a-workspace) tool.

When you go to the [Datasets](/collections) view in Giant you will see any dataset that has been shared with you, plus a personal dataset named after you e.g. "Luke Hoyland Documents". Documents in your own personal dataset are only viewable by you, unless you choose to [share any of them in a workspace](#sharing-access-to-documents-in-a-workspace).

## **Dataset structure** {#dataset-structure}

Unlike workspaces, the files and folders in datasets are organised exactly as they were when the material was added to Giant. For leaks this is useful because the context of a document is often important. But it also means in practice that for your own documents, workspaces are far more useful – because you are likely to want to rearrange things as they accumulate.

In your personal dataset, once you have uploaded documents in Giant you'll see a list of uploads by date, reflecting the times at which you uploaded content. Within each upload the files are structured exactly as they were when you uploaded them, and with the exact name they had when you uploaded them. This view is only really useful if you want to remind yourself about the original state of files that you put into workspaces and subsequently reorganised/renamed.

## **Your personal dataset** {#your-personal-dataset}

As noted above, files you upload into workspaces are stored in your personal dataset. If you go to the [Datasets view](/collections) in Giant you'll see yours. Mine is called "Luke Hoyland Documents".

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/25_datasets_my_documents.png" alt="Datasets view showing personal documents dataset" width="100%"  />

<div class="doc-caption">

Your own dataset contains everything you have uploaded

</div>

</div>

This dataset is organised into folders corresponding to each time you uploaded a bunch of files, sorted by date. You'll quickly see that this isn't a very helpful way of organising files, which is why we have workspaces. But the personal dataset can be useful in some circumstances, – e.g.

- If you've forgotten what workspace you put something into.
- If you removed a file from a workspace but now need to find it.
- If you deleted a workspace but still want to find a file that originally you uploaded into that workspace.

The easiest way to search across every file you have ever uploaded is to go to the [search view](/search), and in the datasets list on the side select your personal dataset. Then search. But you can of course browse through all those upload folders in the Datasets view if you really want to.

# **Problems** {#problems}

## **Files that show processing errors** {#reprocess-old-or-problem-files}

Documents that say they processed 'with errors' are usually still viewable in Giant. For example Giant may have failed to generate a 'combined view' for a doc. If so, you will still be able to search and view the doc - but using separate view modes for searchable text and the document 'Preview'.

However some documents may display a 'Could not process document' error when you open them. For these, please check if any other view mode is available at the bottom of the screen.

Files that once failed to process may process now, following improvements to the worker robots. Others may have been added to Giant before some functionality became available (such as transcription and translation). So if you encounter a file that doesn't appear to be fully functional, feel free to tell Giant to reprocess it. It shouldn't cause any harm.

To force Giant to reprocess a file, locate it in a workspace and right-click on it. You should see an option to reprocess the original source file which Giant will (usually) have stowed away in an encrypted storage container:

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/26_workspaces_node_reprocess.png" alt="Workspace file context menu with Reprocess option" width="100%"  />

<div class="doc-caption">

The contextual menu provides an option to reprocess files

</div>

</div>

If after you've reprocessed a file Giant still fails to render it in any useful way, please contact the engineering team at [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk). It may be in a file format for which we [haven't yet provided a processor](#problem-file-formats). Hopefully we can fix that.

You do have one other last resort, which is to download the file in its original format, but **please think carefully before you do so**. Files you view in Giant are protected, so documents that might have contained malware, web beacons and suchlike cannot do any harm. If you download the original you have no such protection.

## **Download original file** {#download-original}

If you're confident that a document is safe to download, use the Download option in the sidebar when you have the document open. You will be given options for what format to download it in. The most risky is 'Original' ... but it's also usually the most useful.

<div class="doc-figure" style="width: 75%;">

<img src="/docs/images/27_docviewer_download_button.png" alt="Download button in document sidebar" width="100%"  />

<div class="doc-caption">

The document sidebar has a Download option

</div>

</div>

<div class="doc-figure" style="width: 50%;">

<img src="/docs/images/28_docviewer_download_original.png" alt="Download dialog with Original format option" width="100%"  />

<div class="doc-caption">

Exercise caution when selecting the 'Original' option for your download format

</div>

</div>

## **Problem file formats** {#problem-file-formats}

The following list shows known issues with particular file formats. In most cases Giant will succeed in indexing these files, so they will show up in searches. But it may have trouble displaying them to you in a useful way.

- **Complex spreadsheets**: Giant can only render spreadsheets as tables, and it has problems rendering very complex or long spreadsheets. It's still worth uploading spreadsheets to Giant because it will 'index' them for search purposes. But you may have to download such a file to inspect it properly.
- **Exotic email formats**: Email formats change often and are often inconsistent. If you open an email in Giant and it doesn't look right, please [tell us](mailto:digital.investigations@guardian.co.uk).
- **Uncommon image formats**: We haven't yet built a worker to handle HEIC files. This should change.
- **Uncommon video formats**: We haven't yet built a worker to handle MPEG-TS files. This should change.
- **Apple iWorks documents**: Giant doesn't do a good job rendering Apple Numbers, Pages and Keynote documents. This too should change.
- **Missing languages**: Our translation and optical character recognition systems don't recognise every language and script. If you encounter one that didn't work, please let us know. We may be able to help (even if it's not possible to do in Giant).

## **Identify errors in your uploaded files** {#upload-processing-errors}

The [My Uploads](/settings/my-uploads) view in Giant Settings shows you the state of all your uploads. This can be useful if you think something may have failed to upload, or to have processed once it made it into Giant.

## **Delete files completely** {#delete-files-completely}

There may be reasons where something needs deleting entirely from Giant. A deletion in Giant is instant and irreversible. The original source file is deleted plus all record of the file is removed from the three databases that underlie Giant. Only use this feature if you are entirely confident that the file should be deleted for everyone, not just yourself. If you just want a file removed from your perspective, use the "Remove from workspace" feature instead. _(See [Workspaces](#workspaces) above)_

If you're sure you need to delete something completely, you can do so if you are the sole owner of the file. Right-click on it and you'll see a **Delete file** option _(see image above)_.

There are circumstances under which it will be impossible for you to delete a file – most notably, if you aren't the owner of the file. If Giant says no, then please contact the [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk) and we’ll try to help.
