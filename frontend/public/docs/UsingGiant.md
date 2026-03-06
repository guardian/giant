# **Using Giant** {#using-giant}

[Giant](https://giant.pfi.gutools.co.uk/) is a tool for securely searching, managing and sharing documents and data. It supports PDF, Office documents, emails, ZIP files, audio, video and more.

It can extract searchable text from documents that do not already have it (known as [OCR](https://en.wikipedia.org/wiki/Optical_character_recognition)). For example, PDFs of scanned paper documents and photographs containing text are searchable in Giant.

To get access to Giant email [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk) and [esd@guardian.co.uk](mailto:esd@guardian.co.uk). And for help, also email those teams rather than the IT Service Desk.

## **Why put stuff into Giant?** {#why-put-stuff-into-giant?}

- All files saved into Giant are stored in an encrypted file system under the Guardian's control. Google, Amazon etc cannot read the content.
- Searching in Giant is much easier than on a hard disk, because you can control the scope of your search, and because Giant performs [optical character recognition](https://en.wikipedia.org/wiki/Optical_character_recognition) on all documents, meaning even photos of documents or "unsearchable" JPEG or PDF documents become searchable.
- Having a document in Giant addresses the risk of document proliferation, where multiple versions of a document shared between different people end up in multiple locations (download folders on different computers, private user folders, email attachments, messenger attachments, etc). If something is in Giant, everyone with permission can view it without having to make a copy. And if we need to get rid of something, the task is simple because it's just in one place.
- For similar reasons, Giant gives you document portability. You don't need to take a copy to work from home – just access it in Giant from anywhere.
- Because Giant 'renders' the file for you, you don't need to install special software on every computer you use to view unusual file types such as emails.

## **Giant’s three main sections** {#giant’s-three-main-sections}

At the top of every Giant window you will find links for the three main entry points for Giant's data: "Search", "Datasets" and "Workspaces".

<img src="/docs/images/01_title_bar.png" width="50%" />

<div style="width: 25%;">

_The three main Giant sections are shown at the top of every page_

---

</div><br/>

- The [**Search**](https://giant.pfi.gutools.co.uk/search) page allows you to search for content using a sophisticated search interface.

- The [**Datasets**](https://giant.pfi.gutools.co.uk/collections) page allows you to browse through collections of material that you have permission to view. There are two kinds of dataset:
  - Large collections of related documents such as a tranche of leaked material provided by a source. These are created when the Investigations & Reporting team bulk upload such a collection.
  - The sum total of an individual user's uploads. Each user has their own personal dataset.

Documents in datasets are organised in the same structure as the source material that was uploaded into Giant. You cannot rearrange items in datasets.

- [**Workspaces**](https://giant.pfi.gutools.co.uk/workspaces/) are user-defined collections of documents, from one or many datasets. Workspaces can be created, named and organised by any Giant user. Workspaces organised like an editable file system so – provided you have access – the documents therein can be arranged into folders; and they can be renamed, added, removed, etc.

You can use workspaces either to create curated selections of significant documents from datasets, from workspaces shared with you, and from documents you upload yourself.

| **Note** | Documents don't actually _live_ inside workspaces. Under the hood, workspaces are collections of links to documents that come from one or more datasets. When you upload documents "into" a workspace, what you're actually doing is uploading the files to your personal dataset (mine is called "Luke Hoyland Documents") and then making a reference to that document within your active workspace. You can see _all_ your uploads - not matter what workspaces they are in - if you go to your own dataset. |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

# **The Search page** {#the-search-page}

Click on the **Search** button in the top left of any Giant screen to get to the search page.

<img src="/docs/images/02_1_search_page_empty.png" width="75%" />

<div style="width: 25%;">

_The Giant search page_

---

</div>

## **Search filters** {#search-filters}

First, select the areas in Giant that you want to search. The left-hand sidebar in Giant shows a list of the datasets and workspaces that you have access to. Click the checkbox for specific ones to limit the scope of your search to those datasets and workspaces. If you don't have any checkboxes checked, Giant will search everything that you have access to.

Below the search bar you'll see a set of filters, including for Workspaces and Datasets. You can select and deselect them using these filter buttons also. We call them 'chips'.

<img src="/docs/images/02_2_search_chips.png" width="100%" />

<div style="width: 25%;">

_This filter will restrict your search to material that is in dataset 'Luke Hoyland Documents' and/or in the workspace 'Eine kleine workspace'_

---

</div><br/>

Below the Datasets and Workspaces on the left-hand panel are some extra ways to filter your search: **Creation Date** and **File Type**. They two have corresponding 'chips' below your search query.

- If you select a **Creation Date** Giant will filter down its results to those that it knows were created within the date range you have selected. Please be aware that this date is not always known, so searching by date can sometimes mean things don't get returned that perhaps should.
- In the Creation date chip, if you select an end date but no start date, Giant will display all matching files created before that date. Similarly, if you select a start date but no end date, you'll see all matches created after that date.
- If you select one or more **File Types** Giant will only search documents of those types.

You can also perform excluding or **'negative searches'** by switching the sidebar checkbox to a 'minus', and similarly with the button on the left of each chip. This will filter your searches to everything **except** the values in that filter.

<img src="/docs/images/02_3_search_chips_negative.png" width="30%" />

<div style="width: 25%;">

_This negative search filter will exclude anything from the Dataset 'Luke Hoyland Documents'_

---

</div><br/>

## **The Search field itself** {#the-search-field-itself}

By default, if you simply type some words into the search field in Giant, it will search for any document that contains those words somewhere within the document.

This will include text in images, words spoken in audio and video files, etc.

If you put your search in quotes it will only return matches of the words _in that exact order_.

If you want to be more sophisticated than that, there are more options available. These are called search operators.

## **Search operators** {#search-operators}

Under normal conditions Giant will search for documents containing every word in your search term. But you can use special syntax to perform more advanced searches:

- **OR / ||**: If you type the search term _"X OR Y"_ or _"X || Y"_ Giant will search for documents that either contain X or Y. Remember to use caps for _OR_, or Giant will will search for "or"!
- **NOT / !**: If you type _"NOT X"_ Giant will search for documents that don't contain X. Same goes for _"! X"_.
- **AND / &&**: If you type _"X AND Y"_ or _"X && Y"_ you're telling Giant that both X and Y must be in the document. Remember to use _AND_ in caps for it to be treated as a search operator. "AND" is actually the default behaviour for Giant, but can be useful if you already have an OR operator in your search. This is where parentheses come in...
- **(parentheses)**: Putting stuff in brackets tells Giant the scope of multiple operators. Two examples:
  - _"(X OR Y) AND Z"_ means the documents can contain X or Y, but they must always contain Z. _"(X || Y) && Z"_ does the same thing.
  - _"(X AND Y) NOT Z"_ means Giant searches for documents that contain X and Y, but don't contain Z. _"(X && Y) ! Z"_ does the same.

- **Fuzzy matches**: Sometimes you want to include documents containing spelling mistakes, in order to do this you can use the _~_ character to perform a "fuzzy" search. The query _"mississippi~"_ would allow up to 2 characters to be mistyped. You can be explicit with how many characters you want to allow to be mistyped by including a number after the ~. So _"mississippi~4"_ would allow up to 4 wrong characters.
- **Proximity**: As we send earlier if you put a search term Giant will search for that exact set of words in that exact order. Proximity allows you to be a bit slacker with that determination. If you combine a quoted search with that _~_ character again, you're telling Giant the the words don't have to be in that exact order, so long as they appear close to each other. You can define how close with a number.
  - For example, the phrase query _"quick fox"_ would match only this exact phrase, but if we modify that to _"quick fox"~10_ Giant will match documents where the terms "quick" and "fox" are within 10 words of each other.

- **Wildcards**: _Warning: wildcards queries can be very inefficient, take a long time to complete and potentially cause system instability. This is especially true when a wildcard is used to prefix a term. Only use when necessary._
  - **Single-character wildcards**: The question mark operator can be used to substitute characters. For example, _"?at"_ would match cat, mat, sat, etc.
  - **Multiple-character wildcards**: Unlike the ? operator the _ operator allows multiple characters to match. For example, _"f\*t"\* would match fat, flat, feast, fervent, etc.

## **Search troubleshooting** {#search-troubleshooting}

Sometimes you'll receive the message that a search has failed and you should check your query. This can happen for several reasons, but often it's because your query contains characters which are part of the query syntax. These are called unescaped special characters or unescaped control characters.

Giant's query syntax has powerful features such as phrase queries, regular expressions and proximity queries. Unfortunately these features require the use of special characters under the hood, effectively preventing you from searching for terms that actually contain those same characters. One example of this is the forward slash: _"/"_. This is used to define a regular expressions query such as _"/joh?n(ath[oa]n)/"_ to return all permutations of the name Jon/John/Jonathon/Jonathan. But of course forward slashes are often used in file paths (such as in URLs), so there may be times that forward slashes are a part of what you're looking for.

To prevent Giant's query parser from interpreting your forward slash as the beginning of a regular expressions query, you can _escape_ the forward slash by preceding it with a back slash, like so: \/.

Escaping means converting a special character which means something to the query language and making it be treated like a literal character.

The following is a list of characters you will need to escape if you want to search for the literal character:

<div style="width: 25%;">

| Character you want to search | How to 'escape' it |
| :--------------------------- | :----------------- |
| +                            | \\+                |
| -                            | \\-                |
| &&                           | \\&&               |
| \|\|                         | \\\|\|             |
| !                            | \\!                |
| (                            | \\(                |
| )                            | \\)                |
| {                            | \\{                |
| ^                            | \\^                |
| "                            | \\"                |
| ~                            | \\~                |
| \*                           | \\\*               |
| ?                            | \\?                |
| \                            | \\\                |

</div><br/>

## **Search results** {#search-results}

If your search gets a hit, the documents that match the search terms will be listed below. The search terms will be highlighted, showing the surrounding text to give you some context.

<img src="/docs/images/02_search_results_highlighted_rev.png" width="80%" />

<div style="width: 25%;">

_Search results showing matches in context_

---

</div><br/>

The result will provide a preview of the surrounding text of the search hit, so you can get an idea of the context.

As you can see in the illustration above, some documents will show multiple hits: up to five are listed. There are two reasons for this:

1. Giant performs optical character recognition (OCR) on many document types, sometimes in multiple languages. This means that for such documents there is a searchable index of not only the regular text in the document but also of each set of "OCR" text extracted from the documents. Sometimes this will take you to the same content as the text search hit; sometimes to something that wasn't originally searchable (such as some words in an image).
2. Some documents will contain multiple instances of some of the terms you searched for, so up to five matches are shown per document.

# **Viewing documents** {#viewing-documents}

You can view documents by getting to them through several different routes:

- Performing a [search](#searching-for-documents) and clicking on a search result.
- Navigating through a [workspace](#workspaces) and double clicking on a file you find therein.
- Browsing through a dataset and double clicking on a file you find therein.
- Traversing through the filesystem from another document by clicking on the first document's path in the document sidebar and navigating to a document elsewhere in the same file path.

The document will be opened in a document viewer window. This consists of a sidebar with some information about the document (location, upload information, and any metadata that Giant extracted from the document), plus the document view itself. Document views come in several different flavours, depending on file format:

- **Text based documents** such as PDFs and MS Word documents are displayed in a single view, with the OCR'd text overlayed on top of the original document. Search term matches will be highlighted in the document itself. You can also search for other terms within the documents and these will be highlighted in a different colour to the original search term matches. We call this flavour the **combined view mode** because the extracted text and the original file are presented in the same view. 
- **Emails** are displayed in a form that resembles an email, showing the To:, From:, Subject: fields etc. 
- **Spreadsheets** are displayed as a searchable table. At the time of writing this is limited in utility.
- **Other document types** - raw text, images, audio, video, etc (plus any fails Giant didn't convert into the above flavour) - have multiple 'view modes', with the searchable text displayed in a different view to the original media. Documents are initially opened in the extracted text mode to allow you to see search results (and perform further searches in the docuyment)  

## **Combined view documents** {#combined-view-documents}

<img src="/docs/images/03_1_docviewer_page.png" width="80%" />

<div style="width: 25%;">

_A 'combined document view'. If you came to this document via a search, the first match for the search will be displayed, highlighted in cyan_

---

</div><br/>

Some documents will contain more than one match of your search term. In the combined document view you can step through each match using the widget at the top right of the page. Pressing the down arrow will take you to the next match in the document. 

</div><br/>

<img src="/docs/images/03_docviewer_twin_search_widget.png" width="30%" />

<div style="width: 25%;">

_When you come to a 'combined view' document through a search, the find widget has two levels: the top leavel lets you step through matches for your original search term. The second level allows you to search for anything else within the current document._

---

</div><br/>

If the content in the document is difficult to read, you can try the following:

- Expand or contract the window content using the zoom buttons:

  <img src="/docs/images/04_1_docviewer_zoom.png" width="35%" />
- Rotate documents on their side using the rotation buttons:  

  <img src="/docs/images/04_docviewer_rotate.png" width="35%" />
- If all else fails, use the "View as Text" button in the sidebar:

  <img src="/docs/images/04_2_docviewer_view_as_text.png" width="75%" />


## **Searching within a combined view document** {#searching-within-a-combined-view-document}

You can search for things within the document itself, without going back to Giant's search page. Hit **Command F** or type something into the search-in-document widget. If you came to the document from a search, this appears below the main search widget. If you came to the document by browsing, it'll be the only widget there.

| _Searching for text in a document found by search:_                                 | _Searching for text in a document found by browsing:_   |
| :---------------------------------------------------------------------------------- | :------------------------------------------------------ |
| _![Docviewer searchresults find](/docs/images/05_docviewer_searchresults_find.png)_ | _![Docviewer find](/docs/images/06_docviewer_find.png)_ |

## **Other document formats** {#other-document-formats}

Giant can process other file formats such as emails, images, video files, audio files. For many of these when you open the file you'll be given the option to view it in different ways. For example:

## **Image files** {#image-files}

All images files are processed by Giant's optical character recognition engine to extract text into an accompanying textual "view", meaning you can find text in images through this OCR text. When you first open an image document the "OCR text" view may be shown instead of the image itself when you open the document. If there's no text this may be a pretty uninteeresting page! To view the image itself instead, look at the bottom right of the window and you'll see alternative view modes, including "Preview". Use "preview" to view the image itself.

<img src="/docs/images/06_1_docviewer_image_switch_to_preview.gif" width="80%" />

<div style="width: 25%;">

_An image opened from a search result. The user switches to 'Preview' view mode_

---

</div><br/>

## **Audio and video files** {#audio-and-video-files}

In a similar fashion to the way Giant extracts text from images, it transcibes and translates words spoken content in audio and video files. Again, these searchable transcription "views" modes will be what you see when you open those files, because that 'view' is the searchable one. If you want to see or hear the original media file, switch to Preview mode.

<img src="/docs/images/06_1_docviewer_video_switch_to_preview.gif" width="80%" />

<div style="width: 25%;">

_Video and audio files initially open with the transcript text. Click Preview view mode to see the video itself_

---

</div><br/>

<div style="width: 50%;">

| **Note** | The list of languages that the transcription system supports can be found [here](https://github.com/openai/whisper/blob/ba3f3cd54b0e5b8ce1ab3de13e32122d0d5f98ab/whisper/tokenizer.py#L10). At the time of writing it's 100 languages. |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

</div>

# **Workspaces** {#workspaces}

Workspaces are like a folder structure on a computer or a server. You can create workspaces, create folders within them, upload documents into them, move documents around within them or add documents from elsewhere in Giant.

The two principal uses of workspaces are:

1. To create a curated set of documents from a big dataset. Often a big dataset will include masses of stuff that isn't interesting. Workspaces allow you to bookmark the things that are, and organise them however you see fit.
2. As a repository for documents that you have uploaded into Giant. (See [Why put stuff into Giant](#why-put-stuff-into-giant?)).

These use cases are non-exclusive. You can, for example, have a workspace containing documents from multiple datasets along with additional files you have uploaded yourself. And a single file can be in as many different workspaces as you want.

Files in a workspace are **private to you by default** – however you can share access with others within the Guardian. You can choose to create a "public" workspace – which makes the contents viewable for all other Giant users at GNM – or you can [add specific users to a workspace](#sharing-access-to-documents-in-a-workspace) to share its documents with those people.

## **Finding workspaces** {#finding-workspaces}

All the workspaces that you currently have permission to view are shown in the search sidebar in Giant and in the [Workspaces](https://giant.pfi.gutools.co.uk/workspaces) section.

In the Workspaces section they are grouped into three lists:

1. Workspaces you created. This may include entirely private workspaces and workspaces that you have shared with others. You have full control over these workspaces.
2. Workspaces that someone else created and shared with you. You can add files to these workspaces, and organise their structure. But you can't delete them or change their sharing settings.
3. Public workspaces that are viewable by all Giant users at GNM. These are used for collections of non-confidential material that is already in the public domain. Your access controls for these depend on whether you created them (full control, like type 1\) or someone else (same control as for other workspaces shared with you, like type 2).

## **Creating a new workspace** {#creating-a-new-workspace}

In Giant click on the Workspaces button at the top of the screen and hit the **New Workspace** button in the left-hand sidebar.

<img src="/docs/images/07_workspaces_new_button.png" width="80%" />

<div style="width: 25%;">

_The New Workspace button_

---

</div><br/>


You'll be shown the New Workspace dialog box:

<img src="/docs/images/08_workspaces_new_dialog.png" width="50%" />

<div style="width: 25%;">

_Give the workspace a name and a tag colour if you want to organise your workspaces into different categories. Don't click the 'Public' chekbox before reading the following section_

---

</div>

## **Public workspaces** {#public-workspaces}

The "public" checkbox in the New Workspace dialog allows you to create a workspace that is visible to all other users of Giant at the Guardian. It isn't completely public\!

Public workspaces should really only be used for material that is already in the public domain and that has no special data protection status. The material is technically secure, but since hundreds of people have access it's unwise to put anything confidential in here.

Don't click on this if you want to keep your workspace private to you, or if you plan to share your workspace with a limited number of colleagues. To achieve the latter see [Sharing access](#sharing-access-to-documents-in-a-workspace) below.

## **Uploading new documents into a workspace** {#uploading-new-documents-into-a-workspace}

Workspaces are where you upload and organise your files in Giant. To begin you upload your files to a workspace and you can then browse and search through them.

Navigate to a workspace. Click on nothing if you want to upload files to the top of the workspace. Or click on a folder within the workspace to upload files to that folder. Then hit the “Upload to Workspace” button.

![Workspaces upload button](/docs/images/09_workspaces_upload_button.png)

You'll be shown a window where you can choose one of two options:  
![Workspaces upload selection dialog](/docs/images/10_workspaces_upload_selection_dialog.png)

- **Add Files** to add specific files from your computer to your chosen location in the workspace. You can select more than one file at once if your computer allows it. The files will be added side by side to your chosen location in your workspace.
- **Add Directory** to add an entire folder from your computer to the chosen location in the workspace. Here the directory structure on your computer will be preserved: everything will end up inside a folder of the same name, and any subfolders therein will have been retained with their original contents.

Your computer will now open a file finding dialog. Navigate to the files or folder you want to upload, select them, then hit OK/Open/Upload or whatever button it is that your computer shows to upload the files.

You'll then be shown a list of your selection, so you can confirm it's what you wanted.

- If you selected too many things you can click on the X icon to remove them from the stuff you're going to upload.
- If you've gone completely wrong just click off the list to cancel and start again.

Once you're happy, hit Upload. Giant will start uploading the files. If there are a lot please don't close the window. Let it progress.

Once uploaded, the files will appear in the workspace. The spinning icon indicates that Giant is **processing** the files. For some tasks, such as OCR, the time this takes will depend on how big the file is (for example how many pages it has). This process is now being performed by Giant rather than your computer. So you can safely navigate away from the page though and come back once they are done.

![Workspaces file listing processed](/docs/images/11_workspaces_file_listing_processed.png)

Once a file says it has "processed", you can [view](#viewing-documents) it or [search](#searching-for-documents) for it.

Under the hood, the file is actually stored in your own personal dataset, which includes every file you upload. The workspace is really little more than a nicely organisable set of bookmarks. But since they behave just like files, you can treat them just like files.

## **Saving online content into Giant**

You can give Giant the URL of a webpage and it will snapshot the page, extract the text, and ingest, transcribe and translate any multimedia content therein (such as videos). There are two ways to do this:

### **From Giant: ‘Capture from URL’**

![Workspaces capture from url button](/docs/images/12_workspaces_capture_from_url_button.png)  
Within a workspace click on Capture to Giant, enter the URL of the page you want captured and where you want to save it.  
![Workspaces capture from url selection dialog](/docs/images/13_workspaces_capture_from_url_selection_dialog.png)  
Giant will go and fetch it. It may take a while if the page contains audio or video content.

### **From a webpage: right click and ‘Capture with Giant’**

This will only work if your browser has the Guardian Staff Extension.

From a webpage right click and opt to **Capture with Giant**. You’ll be given the same options as above, after which you can go about your browsing business while Giant grabs the material and stores it for you.  
![Workspaces capture from url workflow](/docs/images/14_workspaces_capture_from_url_workflow.gif)

## **Adding existing Giant files to a workspace** {#adding-existing-giant-files-to-a-workspace}

You can add files that are already in Giant to a workspace, even if they're already in some other workspace. The first method allows you to add an existing file to any workspace, including a new one. The second method allows you to move or copy one or many files and folders from one workspace to another.

### **Method 1: how to add a file to a workspace from within the file itself** {#method-1:-how-to-add-a-file-to-a-workspace-from-within-the-file-itself}

Use this method if you have a file open but not the workspace(s) that it may belong to. This could happen if someone sent you the URL of the file, or if you found the file in search. You can add any file that you open to as many workspaces as you like. The files themselves aren’t duplicated \- Giant just keeps a record of which workspaces the file has been added to. So even if the file belongs to someone else, if you add it to a new workspace it won’t disappear from wherever they had it.

Open the file. In the left hand sidebar you will see a button **Add to Workspace**. You'll be shown a dialog box where you should pick a target workspace. Every workspace that you have access to will be listed in the dropdown menu. (If you want instead to add the file to a brand new workspace, [create it](#creating-a-new-workspace) first.) You can abbreviate the list by typing some characters that appear in the workspace name: the list will shorten to show only those workspaces with that text in their name.  
![Docsidebar add to workspace dialog](/docs/images/15_docsidebar_add_to_workspace_dialog.png)

Once you have selected a workspace, the dialog will show the folder structure of that workspace. Twist down the arrows to select a specific location. If you accidentally select a folder but you want to save the file at the top of the workspace, clear the selection by choosing a different workspace in the dropdown menu and then reselecting your intended workspace.

As with all documents in a workspace, you can rename them to something that makes more sense to you. This will rename the file as shown in your target workspace only – not in any other location. To rename the file change the text in the **Save As** field.

Then hit **Save**. Now navigate to your workspace and you'll see the file there.

### **Method 2: moving or copying a file from one workspace to another workspace** {#method-2:-moving-or-copying-a-file-from-one-workspace-to-another-workspace}

Use this method if you have a file in a workspace but want to move or copy it into another workspace in order to share it with different people, to have copies of the file in different workspaces for different projects, etc.

1. First, make sure that the workspace you want to put the file into exists, and is [shared with the right people](#sharing-access-to-documents-in-a-workspace).
2. Now switch to the workspace where the file already is.
3. Select the file or folder of files and drag it from the “source” workspace into the “target” workspace that will be listed in the sidebar to the left. If you need to scroll down, drag the file down to the bottom of the window \- this should case Giant to scroll the whole window including the sidebar.
4. Drag the folder over the top of the target workspace and release the mouse. You’ll now be shown an dialog asking if you want to copy the file or move it. “Copying” makes a new reference to the file in the target workspace, so that it appears in both places. (In fact there is only one real version of the file: you’re just making it show in both workspaces.) “Moving” removes the file/folder entry in the source workspace and puts it in the new workspace.
5. Now switch to that workspace and put the file or folder in the exact location within that workspace that you want. (See [Organising files in a workspace](#organising-files-in-workspaces) below)

## **Organising files in workspaces** {#organising-files-in-workspaces}

To **create a folder** click the **New Folder** button:

![Workspaces new folder button](/docs/images/16_workspaces_new_folder_button.png)

To **move files** just drag them around, like you do in the Finder on a Mac. Shift-click and cmd-click will work for multiple selections:

![Workspaces drag to move](/docs/images/17_workspaces_drag_to_move.png)

To **rename a file** or **remove a file**, right-click on it:

![Workspaces contextual menu rename](/docs/images/18_workspaces_contextual_menu_rename.png)

Note that renaming a file here will just rename it in this workspace. The original document in a dataset, or links to it in any other workspace, will not get renamed.

When **removing a file from a workspace,** the file is only removed from that workspace and remains in Giant as well as in any other workspaces it has been added to. To permanently delete something from Giant, please see below.

If you alone own a document (i.e. no one else uploaded the same file), you may be able **delete it from Giant entirely** by right-clicking on it in your workspace and opting to “Delete file”.

![Workspaces contextual menu](/docs/images/19_workspaces_contextual_menu.png)

Please note that it isn't always possible to delete files for several reasons. For example the file may be shared with someone else. Or someone else may have an identical file for different reasons. Because of Giant’s security design it is intentionally not possible for one user to know which other users have a file or have permission to view it. So Giant can’t actually tell you why something can’t be deleted. If Giant refuses to delete a file and you need it to be deleted for everyone, please contact [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk) and we’ll try to help.

## **Searching for documents in a workspace** {#searching-for-documents-in-a-workspace}

At present there are two ways to do this:

1. You can search a folder within a workspace by right-clicking on that folder.
2. You can search one or more whole workspaces by selecting those workspaces in Giant's "Search" view.

### **Searching a single folder in a workspace** {#searching-a-single-folder-in-a-workspace}

Go to your workspace and right click on the folder that you want to search. You'll see an option to **Search in folder**:  
![Workspaces contextual menu search in folder](/docs/images/20_workspaces_contextual_menu_search_in_folder.png)

This will take you to Giant's search view, with that workspace folder preselected as a [chip](https://docs.google.com/document/d/1uejYdU7w5GJpmg9R2u-Wi6qr1YfSg7bWHRRazDwHjUU/edit#heading=h.ik23h3kcne5f) in the search field:

![Search chips workspace folder](/docs/images/21_search_chips_workspace_folder.png)

Now, next to the chip, type whatever it is you want to search for and hit Search (or just Enter/Return). Giant will constrict its search to just the folder that you selected.

### **Searching a whole workspace** {#searching-a-whole-workspace}

Click “Search” in the Giant page header to switch to Giant's search view:

![Docsidebar click search header](/docs/images/22_docsidebar_click_search_header.png)

To restrict your search to just the documents in a particular workspace, click the checkbox next to that workspace's name, on the left:  
![Search sidebar workspace checkbox](/docs/images/23_search_sidebar_workspace_checkbox.png)  
Then enter your search term in the search box. For more on search see [above](#searching-for-documents).

## **Sharing access to documents in a workspace** {#sharing-access-to-documents-in-a-workspace}

Documents uploaded to a workspace you create are **private to you by default**. However you can choose to share any workspace that you created.

To share access with others, click the “Share Workspace” button that is displayed when you are viewing your workspace:

![Workspaces share dialog](/docs/images/24_workspaces_share_dialog.png)

Add the email addresses of who you want to have access. These people **will be able to** **view and edit anything in the workspace**: they can add files, rename them, move them and remove them. These people **will not be able to delete the workspace, rename it, or share it with more people**.

You can remove people by clicking the ‘X’ next to their email. If you remove everyone only you will have access.

The **public** checkbox gives all Giant users at GNM access to the workspace. This will move the workspace out of the **Created by Me** list in the **Workspaces** view and into the Public list.

Note that workspace sharing settings applies to all of the documents in a workspace – including, for example, documents that you added from a dataset that a sharer does not have full access to. (They'll be able to access just the documents you have shared with them via your workspace.) If you don't want to share all the files in a workspace with the same set of people, make another workspace, share it with the right people, and then go back to your first workspace and add only the right items to the new workspace using the [Add to Workspace option](#adding-existing-giant-files-to-a-workspace) described above.

You can see who a workspace is shared with by hovering over the text that says how many people it is shared with.

## **Workspace URLs** {#workspace-urls}

Once you have shared access with a workspace, you can refer to it by its URL: URLs in Giant are the same for everyone, so you can point people at files or workspaces by copying the URL and sending it to a colleague. You can also direct colleagues to particular folders within the workspace by clicking on that folder (or a file within it) and copying the URL from your browser’s location bar. If you send your colleague that URL it will open that particular location within the workspace.

# **Datasets** {#datasets}

In practice you will mostly work with search and with workspaces, rather than with datasets – unless you are working on a big project involving a big, shared set of files that have been leaked to the Guardian.

Under the hood in Giant, documents are organised into datasets. These are large collections of documents. So far as you are concerned there are two kinds of datasets:

- Large collections of related documents that were added en masse by the Investigations & Reporting engineering team or ESD. These tend to be big data leaks and that sort of thing.
- Your own personal dataset. This contains all the files that you have uploaded into Giant using the [upload to workspace](#uploading-new-documents-into-a-workspace) tool.

When you go to the [Datasets](https://giant.pfi.gutools.co.uk/collections) view in Giant you will see any dataset that has been shared with you, plus a personal dataset named after you e.g. "Luke Hoyland Documents". Documents in your own personal dataset are only viewable by you, unless you choose to [share any of them in a workspace](#sharing-access-to-documents-in-a-workspace).

## **Dataset structure** {#dataset-structure}

Unlike workspaces, the files and folders in datasets are organised exactly as they were when the material was added to Giant. For leaks this is useful because the context of a document is often important. But it also means in practice that for your own documents, workspaces are far more useful – because you are likely to want to rearrange things as they accumulate.

In your personal dataset, once you have uploaded documents in Giant you'll see a list of uploads by date, reflecting the times at which you uploaded content. Within each upload the files are structured exactly as they were when you uploaded them, and with the exact name they had when you uploaded them. This view is only really useful if you want to remind yourself about the original state of files that you put into workspaces and subsequently reorganised/renamed.

## **Your personal dataset** {#your-personal-dataset}

Every file that you upload into a workspace is actually stored in your personal dataset. If you go to the [Datasets view](https://giant.pfi.gutools.co.uk/collections) in Giant you'll see yours. Mine is called "Luke Hoyland Documents".  
![Datasets my documents](/docs/images/25_datasets_my_documents.png)

This dataset is organised into folders corresponding to each time you uploaded a bunch of files, sorted by date. You'll quickly see that this isn't a very helpful way of organising files, which is why we have workspaces. But the personal dataset can be useful in some circumstances, – e.g.

- If you've forgotten what workspace you put something into.
- If you removed a file from a workspace but now need to find it.
- If you deleted a workspace but still want to find a file that originally you uploaded into that workspace.

The easiest way to search across every file you have ever uploaded is to go to the [search view](https://giant.pfi.gutools.co.uk/search), and in the datasets list on the side select your personal dataset. Then search. But you can of course browse through all those upload folders in the Datasets view if you really want to.

# **Other tools in Giant** {#other-tools-in-giant}

## **Transcription and translation** {#transcription-and-translation}

We’ve added a feature to create transcripts of audio files that you upload into Giant. This will allow you to search your audio files in Giant by words spoken in those files. You can copy the text from the transcripts if you wish to use those quotes elsewhere. And you can download the transcript file via the Download button shown in the sidebar alongside transcribed documents.

The list of languages supported by the transcription and translation tool is updated [here](#unusual-file-formats). Currently 100 languages are supported.

## **Reprocess old or problem files** {#reprocess-old-or-problem-files}

There may be times when you want Giant to re-analyse a document and extract its content, index it, and make it render nicely in your process. As Giant has improved over time you may have old files that failed to process. Subsequent fixes may mean that such a document would process OK now. Or you may have files that were processed before we introduced the unified document viewer.

| Documents processed before the advent of the “unified document viewer” in 2022 show in three separate view modes: basic “text” and “OCR” \- which just look like plain text, and “preview” – which looks like the original document). If you perform a search that finds a match in such a document, Giant can't take you to the matching text in the preview of the document, so you won't see it highlighted there. If you really want to see documents in the separate view modes you can access those modes via the "View as text” button in the sidebar when the document is being displayed. |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

To force Giant to reprocess a file, locate it in a workspace and right click on it. You should see an option to reprocess the original source file which Giant will (usually) have stowed away in an encrypted storage container:  
 ![Workspaces node reprocess](/docs/images/26_workspaces_node_reprocess.png)

## **Delete files completely** {#delete-files-completely}

There may be reasons where something needs deleting entirely from Giant. A deletion in Giant is instant and irreversible. The original source file is deleted plus all record of the file is removed from the three databases that underlie Giant. Only use this feature if you are entirely confident that the file should be deleted for everyone, not just yourself. If you just want a file removed from your perspective, use the "Remove from workspace" feature instead. _(See workspaces section above)_

If you're sure you need to delete something completely, you can do so if you are the sole owner of the file. Right click on it and you'll see a Delete file option _(see image above)_.

There are circumstances under which it will be impossible for you to delete a file – most notably, if you aren't the owner of the file. If Giant says no, then please contact the [digital.investigations@guardian.co.uk](mailto:digital.investigations@guardian.co.uk) and we’ll try to help.

# **Troubleshooting** {#troubleshooting}

## **Upload/processing errors** {#upload/processing-errors}

The My Uploads view in Giant Settings shows you the state of all your uploads. This can be useful if you think something may have failed to upload, or to have processed once it made it into Giant. It's here:

[https://giant.pfi.gutools.co.uk/settings/my-uploads](https://giant.pfi.gutools.co.uk/settings/my-uploads)

As we encounter new eccentricities in file types, we are making fixes to the robots that process files for Giant. So files that failed to process in the past may succeed now. If you want to check with an old file, see “Reprocess old or problem files” in the section immediately above this one.
