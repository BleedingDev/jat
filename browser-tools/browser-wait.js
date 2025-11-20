#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let waitType = null;
let waitValue = null;
let timeout = 30000; // 30 seconds default

// Parse arguments
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--timeout") {
		timeout = parseInt(args[++i]) * 1000;
	} else if (args[i] === "--text") {
		waitType = "text";
		waitValue = args[++i];
	} else if (args[i] === "--selector") {
		waitType = "selector";
		waitValue = args[++i];
	} else if (args[i] === "--url") {
		waitType = "url";
		waitValue = args[++i];
	} else if (args[i] === "--eval") {
		waitType = "eval";
		waitValue = args[++i];
	}
}

if (!waitType || !waitValue) {
	console.log("Usage: browser-wait.js --<type> <value> [--timeout <seconds>]");
	console.log("\nWait Types:");
	console.log("  --text <text>          Wait for text to appear on page");
	console.log("  --selector <selector>  Wait for CSS selector to exist");
	console.log("  --url <url>            Wait for URL to change to/contain value");
	console.log("  --eval <expression>    Wait for custom JavaScript expression to be truthy");
	console.log("\nOptions:");
	console.log("  --timeout <seconds>    Maximum wait time (default: 30)");
	console.log("\nExamples:");
	console.log('  browser-wait.js --text "Login successful"');
	console.log('  browser-wait.js --selector ".user-profile"');
	console.log('  browser-wait.js --url "/dashboard"');
	console.log('  browser-wait.js --eval "document.readyState === \'complete\'"');
	console.log('  browser-wait.js --text "Welcome" --timeout 60');
	process.exit(1);
}

const b = await puppeteer.connect({
	browserURL: "http://localhost:9222",
	defaultViewport: null,
});

const p = (await b.pages()).at(-1);

try {
	const startTime = Date.now();

	if (waitType === "text") {
		// Wait for text to appear
		await p.waitForFunction(
			(text) => document.body.innerText.includes(text),
			{ timeout },
			waitValue
		);
		console.log(`✓ Text found: "${waitValue}" (${Date.now() - startTime}ms)`);
	} else if (waitType === "selector") {
		// Wait for selector
		await p.waitForSelector(waitValue, { timeout });
		console.log(`✓ Selector found: ${waitValue} (${Date.now() - startTime}ms)`);
	} else if (waitType === "url") {
		// Wait for URL change
		await p.waitForFunction(
			(expectedUrl) => window.location.href.includes(expectedUrl),
			{ timeout },
			waitValue
		);
		console.log(`✓ URL changed to: ${waitValue} (${Date.now() - startTime}ms)`);
	} else if (waitType === "eval") {
		// Wait for custom expression
		await p.waitForFunction(waitValue, { timeout });
		console.log(`✓ Condition met: ${waitValue} (${Date.now() - startTime}ms)`);
	}
} catch (error) {
	if (error.name === "TimeoutError") {
		console.error(`✗ Timeout after ${timeout}ms waiting for: ${waitValue}`);
		process.exit(1);
	}
	throw error;
}

await b.disconnect();
