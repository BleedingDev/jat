# JAT Browser Extension

A Chrome extension for bug reporting with Manifest V3, built with TypeScript and Vite.

## Features

- **Screenshot Capture**: Capture full page and visible area screenshots
- **Console Log Capture**: Automatically capture and store console logs
- **Network Request Monitoring**: Track network requests and responses  
- **Element Picker**: Click to select and inspect any element on the page
- **Bug Report Form**: Integrated form to create detailed bug reports

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" 
   - Click "Load unpacked" and select the `dist/` folder

## Build Scripts

- `npm run dev` - Build with watch mode for development
- `npm run build` - Production build
- `npm run type-check` - TypeScript type checking
- `npm run clean` - Clean dist directory

## Project Structure

```
extension/
├── src/
│   ├── popup/           # Extension popup UI
│   │   ├── popup.html
│   │   └── popup.ts
│   ├── content/         # Content script (runs on web pages)
│   │   └── content.ts
│   └── background/      # Background service worker
│       └── background.ts
├── public/
│   └── icons/           # Extension icons
├── dist/                # Built extension (load this in Chrome)
├── manifest.json        # Extension manifest
├── package.json
├── tsconfig.json
└── vite.config.ts       # Build configuration
```

## Permissions

The extension requests these permissions:

- `activeTab` - Access to current tab for screenshots and element selection
- `storage` - Store captured data locally
- `scripting` - Inject content scripts
- `webRequest` - Monitor network requests for debugging
- `<all_urls>` - Host permissions for content scripts

## Usage

1. Click the JAT extension icon in Chrome toolbar
2. Use the popup to:
   - 📸 **Screenshot** - Capture current page
   - 🐛 **Console Logs** - Capture console output
   - 🌐 **Network Logs** - Capture recent network requests
   - 🎯 **Select Element** - Pick an element on the page
   - 📝 **Create Bug Report** - Open the bug report form

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Build Tool**: Vite with TypeScript
- **Browser Support**: Chrome 88+, Edge 88+
- **Module System**: ES modules
- **Type Safety**: Full TypeScript coverage

## Related Tasks

This extension provides the foundation for:
- Screenshot capture (full page and visible)
- Console log capture  
- Content script for element picker
- Popup UI with feedback form
- Network request capture

## License

MIT