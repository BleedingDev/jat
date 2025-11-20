#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let selector = null;
let maxDepth = 10;
let includeHidden = false;

// Parse arguments
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--selector") {
		selector = args[++i];
	} else if (args[i] === "--max-depth") {
		maxDepth = parseInt(args[++i]);
	} else if (args[i] === "--include-hidden") {
		includeHidden = true;
	} else if (args[i] === "--help") {
		console.log("Usage: browser-snapshot.js [options]");
		console.log("\nOptions:");
		console.log("  --selector <css>       Snapshot only this element and its children");
		console.log("  --max-depth <n>        Maximum tree depth (default: 10)");
		console.log("  --include-hidden       Include hidden elements");
		console.log("\nExamples:");
		console.log("  browser-snapshot.js");
		console.log("  browser-snapshot.js --selector 'main'");
		console.log("  browser-snapshot.js --max-depth 5 --include-hidden");
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

try {
	// Get accessibility tree snapshot
	const client = await p.target().createCDPSession();
	const snapshot = await client.send('Accessibility.getFullAXTree');
	
	// Also get basic page info
	const pageInfo = await p.evaluate(() => ({
		url: window.location.href,
		title: document.title,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight
		}
	}));

	// Build simplified tree structure
	function buildTree(node, depth = 0) {
		if (depth > maxDepth) return null;
		if (!includeHidden && node.role && node.role.value === "none") return null;

		const result = {
			role: node.role?.value || "unknown",
		};

		if (node.name?.value) result.name = node.name.value;
		if (node.value?.value) result.value = node.value.value;
		if (node.description?.value) result.description = node.description.value;
		
		// Add useful attributes
		if (node.properties) {
			const attrs = {};
			for (const prop of node.properties) {
				if (prop.name === "level" || prop.name === "checked" || prop.name === "disabled") {
					attrs[prop.name] = prop.value.value;
				}
			}
			if (Object.keys(attrs).length > 0) result.attrs = attrs;
		}

		// Recursively build children
		if (node.children && node.children.length > 0) {
			const children = node.children
				.map(child => buildTree(child, depth + 1))
				.filter(Boolean);
			if (children.length > 0) result.children = children;
		}

		return result;
	}

	// Find root node
	const rootNode = snapshot.nodes[0];
	const tree = buildTree(rootNode);

	const output = {
		page: pageInfo,
		tree: tree,
		stats: {
			nodes: snapshot.nodes.length,
			depth: maxDepth
		}
	};

	console.log(JSON.stringify(output, null, 2));

} catch (error) {
	console.error(`✗ Snapshot failed: ${error.message}`);
	process.exit(1);
}

await b.disconnect();
