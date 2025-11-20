#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let follow = false;
let filterType = null;
let filterUrl = null;
let limit = 100;

// Parse arguments
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--follow" || args[i] === "-f") {
		follow = true;
	} else if (args[i] === "--type") {
		filterType = args[++i];
	} else if (args[i] === "--url") {
		filterUrl = args[++i];
	} else if (args[i] === "--limit") {
		limit = parseInt(args[++i]);
	} else if (args[i] === "--help") {
		console.log("Usage: browser-network.js [options]");
		console.log("\nOptions:");
		console.log("  --follow, -f           Follow network requests (live stream)");
		console.log("  --type <type>          Filter by resource type: xhr, fetch, document, script, stylesheet, image");
		console.log("  --url <pattern>        Filter by URL pattern (substring match)");
		console.log("  --limit <n>            Limit output to n requests (default: 100)");
		console.log("\nExamples:");
		console.log("  browser-network.js");
		console.log("  browser-network.js --follow --type xhr");
		console.log("  browser-network.js --url 'api.example.com' --limit 50");
		process.exit(0);
	}
}

const b = await puppeteer.connect({
	browserURL: "http://localhost:9222",
	defaultViewport: null,
});

const p = (await b.pages()).at(-1);

if (!p) {
	console.error("✗ No active tab found");
	process.exit(1);
}

const requests = new Map();
const results = [];

function shouldInclude(url, resourceType) {
	if (filterType && resourceType !== filterType) {
		return false;
	}
	if (filterUrl && !url.includes(filterUrl)) {
		return false;
	}
	return true;
}

// Enable request interception to capture request details
await p.setRequestInterception(false); // We just want to observe, not intercept

// Listen for requests
p.on('request', request => {
	const url = request.url();
	const resourceType = request.resourceType();
	
	if (!shouldInclude(url, resourceType)) return;
	
	requests.set(request, {
		url: url,
		method: request.method(),
		resourceType: resourceType,
		headers: request.headers(),
		postData: request.postData(),
		startTime: Date.now()
	});
});

// Listen for responses
p.on('response', async response => {
	const request = response.request();
	const requestData = requests.get(request);
	
	if (!requestData) return;
	
	const endTime = Date.now();
	const duration = endTime - requestData.startTime;
	
	const result = {
		url: requestData.url,
		method: requestData.method,
		status: response.status(),
		statusText: response.statusText(),
		resourceType: requestData.resourceType,
		timing: {
			duration: duration,
			timestamp: new Date(requestData.startTime).toISOString()
		},
		headers: {
			request: requestData.headers,
			response: response.headers()
		},
		size: {
			headers: JSON.stringify(response.headers()).length,
			body: 0 // Will be populated if we fetch body
		}
	};
	
	// Try to get response size
	try {
		const buffer = await response.buffer();
		result.size.body = buffer.length;
		result.size.total = result.size.headers + result.size.body;
	} catch {
		// Some responses can't be buffered (e.g., failed requests)
		result.size.total = result.size.headers;
	}
	
	// Get timing info if available
	const timing = response.timing();
	if (timing) {
		result.timing.dns = timing.dnsEnd - timing.dnsStart;
		result.timing.connect = timing.connectEnd - timing.connectStart;
		result.timing.ssl = timing.sslEnd - timing.sslStart;
		result.timing.send = timing.sendEnd - timing.sendStart;
		result.timing.wait = timing.receiveHeadersEnd - timing.sendEnd;
		result.timing.receive = endTime - requestData.startTime - (timing.receiveHeadersEnd - timing.requestTime);
	}
	
	// Clean up
	requests.delete(request);
	
	if (follow) {
		console.log(JSON.stringify(result));
	} else {
		results.push(result);
		if (results.length > limit) {
			results.shift();
		}
	}
});

// Listen for failed requests
p.on('requestfailed', request => {
	const requestData = requests.get(request);
	if (!requestData) return;
	
	const result = {
		url: requestData.url,
		method: requestData.method,
		status: 0,
		statusText: 'Failed',
		resourceType: requestData.resourceType,
		error: request.failure()?.errorText || 'Unknown error',
		timing: {
			duration: Date.now() - requestData.startTime,
			timestamp: new Date(requestData.startTime).toISOString()
		}
	};
	
	requests.delete(request);
	
	if (follow) {
		console.log(JSON.stringify(result));
	} else {
		results.push(result);
		if (results.length > limit) {
			results.shift();
		}
	}
});

if (follow) {
	// Follow mode - keep running until interrupted
	console.error("✓ Following network requests (Ctrl+C to stop)...");
	
	// Keep process alive
	process.on('SIGINT', async () => {
		console.error("\n✓ Stopped following network");
		await b.disconnect();
		process.exit(0);
	});
	
	// Keep alive indefinitely
	await new Promise(() => {});
} else {
	// Snapshot mode - wait a bit to collect requests
	console.error("✓ Collecting network requests...");
	await new Promise(resolve => setTimeout(resolve, 2000));
	
	// Output collected requests
	console.log(JSON.stringify(results, null, 2));
	
	await b.disconnect();
}
