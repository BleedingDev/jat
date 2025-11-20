#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let follow = false;
let filter = null;
let limit = 100;

// Parse arguments
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--follow" || args[i] === "-f") {
		follow = true;
	} else if (args[i] === "--filter") {
		filter = args[++i];
	} else if (args[i] === "--limit") {
		limit = parseInt(args[++i]);
	} else if (args[i] === "--help") {
		console.log("Usage: browser-console.js [options]");
		console.log("\nOptions:");
		console.log("  --follow, -f           Follow console output (live stream)");
		console.log("  --filter <type>        Filter by type: log, warn, error, info, debug");
		console.log("  --limit <n>            Limit output to n messages (default: 100)");
		console.log("\nExamples:");
		console.log("  browser-console.js");
		console.log("  browser-console.js --follow --filter error");
		console.log("  browser-console.js --limit 50");
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

const messages = [];

function formatMessage(msg) {
	const output = {
		type: msg.type(),
		text: msg.text(),
		timestamp: new Date().toISOString(),
	};

	// Get location if available
	const location = msg.location();
	if (location && location.url) {
		output.location = {
			url: location.url,
			line: location.lineNumber,
			column: location.columnNumber
		};
	}

	// Get stack trace for errors
	if (msg.type() === 'error' && msg.stackTrace()) {
		output.stackTrace = msg.stackTrace().callFrames.map(frame => ({
			function: frame.functionName || '<anonymous>',
			url: frame.url,
			line: frame.lineNumber,
			column: frame.columnNumber
		}));
	}

	// Get args
	const args = msg.args();
	if (args.length > 0) {
		output.args = args.map(arg => {
			try {
				return arg.toString();
			} catch {
				return '[object]';
			}
		});
	}

	return output;
}

function shouldInclude(msg) {
	if (filter && msg.type() !== filter) {
		return false;
	}
	return true;
}

// Listen for console messages
p.on('console', msg => {
	if (!shouldInclude(msg)) return;

	const formatted = formatMessage(msg);
	
	if (follow) {
		console.log(JSON.stringify(formatted));
	} else {
		messages.push(formatted);
		if (messages.length > limit) {
			messages.shift();
		}
	}
});

if (follow) {
	// Follow mode - keep running until interrupted
	console.error("✓ Following console output (Ctrl+C to stop)...");
	
	// Keep process alive
	process.on('SIGINT', async () => {
		console.error("\n✓ Stopped following console");
		await b.disconnect();
		process.exit(0);
	});
	
	// Keep alive indefinitely
	await new Promise(() => {});
} else {
	// Snapshot mode - wait a bit to collect messages
	console.error("✓ Collecting console messages...");
	await new Promise(resolve => setTimeout(resolve, 1000));
	
	// Output collected messages
	console.log(JSON.stringify(messages, null, 2));
	
	await b.disconnect();
}
