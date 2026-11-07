# Circle to Fix

Circle to Fix is a local-first Chrome Manifest V3 extension for annotating a webpage and creating a coding-agent repair prompt. It uses no external APIs and does not upload screenshots or page content.

## Load in Chrome

1. Download or open this project folder on your computer.
2. Visit `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select this folder (the folder containing `manifest.json`).
4. Open a normal webpage, then use the extension popup or press **Ctrl+Shift+X**. If Chrome reports a shortcut conflict, change it at `chrome://extensions/shortcuts`.
5. Draw a box, circle, or arrow. Add a note, generate/edit the prompt, save the PNG, then attach that PNG manually to your coding agent.

Press **Escape** or **Done** to exit drawing mode. Restricted browser pages such as `chrome://` and Chrome Web Store pages cannot be inspected.

## Privacy and data

- Page access is requested only when the user starts the extension, using `activeTab` and `scripting`.
- Element details and screenshots remain in the current page session until the extension is closed or the page is left.
- Form values are never read. Text from form controls and editable regions is excluded.
- The generated prompt includes the page URL (without query parameters or fragments), selected element details, annotation coordinates, your note, and a screenshot filename/reference. It does not embed the screenshot; save and attach the PNG separately.
- Screenshot capture uses Chrome's `captureVisibleTab` API and local Downloads. No network service is involved.

## Testing

The project has no build step or external dependencies. Validate JavaScript syntax with:

```powershell
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

For browser verification, load the unpacked extension and follow the steps above. Confirm the shortcut, all three annotation tools, element details, screenshot preview/download, prompt editing/copying, Escape, undo/clear, and compatibility messaging. Repeat on several ordinary sites (for example Wikipedia, GitHub, YouTube, Google, and another public site). Chrome restricts extensions on some browser-owned pages.
