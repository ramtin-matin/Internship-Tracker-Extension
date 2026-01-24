# OfferTrail

https://chromewebstore.google.com/detail/OfferTrail/ncgopceepkaecgillgmdolbnbacibdgg

A simple Chrome extension to help you track job applications. It lets you save application details and quickly copy them as Tab-Separated Value (TSV) rows, good for pasting into a spreadsheet.

## Features

- **Auto-populates Application Details**: Automatically extracts the company name, job role, and URL from the active job posting page. It has specific parsers for popular platforms like Lever, Greenhouse, and Ashby, with a fallback for other sites.
- **Save Application Data**: Store details for each application, including company, role, location, application date, status, and URL.
- **One-Click Copy**: The "Save + Copy" button saves the application to your local history and simultaneously copies its details as a TSV row to your clipboard.
- **Bulk Export**: The "Copy All TSV" button copies your entire application history to the clipboard, formatted as multiple TSV rows.
- **Application History**: View your last 5 saved applications directly in the popup.
<!-- - **Manage Entries**: Delete last 5 saved applications you no longer need to track. -->

## How it Works

The extension consists of a popup UI and a content script that runs on web pages.

1.  **`popup.html` & `popup.css`**: Defines the user interface for the extension's popup.
2.  **`popup.js`**: Contains the core logic for the popup. It handles:
    - Injecting a script to scrape job data from the current page.
    - Managing user input from the form.
    - Saving, retrieving, and deleting application entries using `chrome.storage.local`.
    - Formatting and copying data to the clipboard as TSV.
    - Rendering the history of saved applications.
3.  **`extractJobInfoFromPage()` (in `popup.js`)**: This function is injected into the active tab. It analyzes the page's URL and DOM to guess the company name and job title. Lets user edit information incase it was guessed incorrectly.
4.  **`manifest.json`**: Configures the extension, defining its name, version, permissions (`storage`, `activeTab`, `scripting`, `clipboardWrite`), and UI components.

## How to Use

### Installation

1.  Clone or download this repository to your local machine.
2.  Open your Chrome-based browser (like Chrome, Brave, or Edge) and navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle switch (usually in the top-right corner).
4.  Click the "Load unpacked" button.
5.  Select the directory where you cloned/downloaded this repository.
6.  The OfferTrail extension icon will appear in your browser's toolbar.

### Tracking an Application

1.  Navigate to a job posting you want to save.
2.  Click the OfferTrail extension icon in your toolbar.
3.  The popup will appear, with the Company, Role, and URL fields automatically filled. (although for now Role isn't accurately filled, so double check)
4.  Verify the auto-filled information and fill in the remaining fields (Location, Status). The date is automatically set to today.
5.  Click **Save + Copy**. The application is now saved, and a TSV row is copied to your clipboard.
6.  Paste the row directly into your spreadsheet (e.g., Google Sheets, Excel).
7.  To export all saved applications, click **Copy All TSV**.
