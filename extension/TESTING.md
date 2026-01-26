# Testing the JAT Browser Extension

## Prerequisites

- Google Chrome or Chromium browser
- Chrome Developer Mode enabled

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" toggle in the top right
3. Click "Load unpacked" button
4. Select the `/home/jw/code/jat/extension/dist/` directory
5. The extension should appear in your extensions list

## Testing Functionality

### 1. Popup Interface
- Click the JAT extension icon in the Chrome toolbar
- Verify the popup opens with the bug reporter interface
- Check all buttons are visible: Screenshot, Console Logs, Network Logs, Select Element, Create Bug Report

### 2. Screenshot Capture
- Navigate to any webpage
- Open the JAT popup
- Click "📸 Screenshot" button
- Should see "Screenshot captured successfully!" message
- Screenshots are stored in extension storage

### 3. Console Log Capture
- Open any webpage with console logs (or open Developer Tools and type `console.log('test')`)
- Open JAT popup
- Click "🐛 Console Logs" button
- Should see "Captured X console logs!" message

### 4. Element Picker
- Open JAT popup
- Click "🎯 Select Element" button
- Popup should close and page should show blue overlay instruction
- Click on any element on the page
- Element information is captured and stored

### 5. Network Request Capture
- Navigate to any webpage (to generate network requests)
- Open JAT popup
- Click "🌐 Network Logs" button
- Should see "Captured X network requests!" message

### 6. Bug Report Form
- Open JAT popup
- Click "📝 Create Bug Report" button
- Should see modal form overlay on the webpage
- Fill out the form and submit
- Bug report data is saved to extension storage

## Debugging

### Check Extension Logs
1. Go to `chrome://extensions/`
2. Find JAT Browser Extension
3. Click "Details"
4. Click "Inspect views: background page" to see background script console
5. Click "Inspect views: popup.html" (when popup is open) to see popup console

### Check Content Script Logs
1. Open any webpage
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for messages starting with "JAT Browser Extension"

### Common Issues

**Extension won't load:**
- Make sure you're loading the `dist/` directory, not the root `extension/` directory
- Check that `manifest.json` exists in the loaded directory
- Look for error messages in the Extensions page

**Popup doesn't open:**
- Check if there are JavaScript errors in the popup console
- Verify `popup.html` and `popup.js` exist in the dist directory

**Features don't work:**
- Check content script is loaded by looking for console messages
- Verify permissions in manifest.json
- Check background script console for errors

## Permissions Required

The extension requests these permissions:
- `activeTab` - Access current tab for screenshots and element selection
- `storage` - Store captured data locally  
- `scripting` - Inject content scripts into web pages
- `webRequest` - Monitor network requests for debugging
- `<all_urls>` - Host permissions for content scripts on all websites

## File Structure Verification

The dist/ directory should contain:
```
dist/
├── background.js       # Background service worker
├── content.js         # Content script (injected into web pages)  
├── manifest.json      # Extension manifest
├── popup.html         # Popup interface HTML
├── popup.js           # Popup JavaScript
└── icons/            # Extension icons (optional)
    └── icon.svg
```

## Next Steps

Once basic functionality is verified, the extension is ready for the implementation of specific features:
- Full page screenshot capture
- Enhanced console log filtering
- Advanced element inspection
- Network request filtering and analysis
- Bug report submission to JAT backend