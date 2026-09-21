import { join } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import express from "express";
import wisp from "wisp-server-node";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

// ---- Content filter ----
// Every site the proxy visits is looked up through Cloudflare for Families
// (1.1.1.3), which blocks adult content and known malware/phishing sites.
import dns from "node:dns";
import net from "node:net";

const FILTER_DNS = ["1.1.1.3", "1.0.0.3"];
const filterResolver = new dns.Resolver();
filterResolver.setServers(FILTER_DNS);
dns.promises.setServers(FILTER_DNS);

const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
	if (typeof options === "function") {
		callback = options;
		options = {};
	}
	if (typeof options === "number") options = { family: options };
	options = options || {};

	if (!hostname || net.isIP(hostname) || hostname === "localhost") {
		return originalLookup(hostname, options, callback);
	}

	filterResolver.resolve4(hostname, (err, addrs) => {
		if (err || !addrs || addrs.length === 0) {
			return callback(err || Object.assign(new Error("Not found"), { code: "ENOTFOUND" }));
		}
		if (addrs.every((a) => a === "0.0.0.0")) {
			return callback(
				Object.assign(new Error("Blocked by content filter: " + hostname), { code: "ENOTFOUND" })
			);
		}
		if (options.all) {
			return callback(null, addrs.map((a) => ({ address: a, family: 4 })));
		}
		callback(null, addrs[0], 4);
	});
};
// ---- End content filter ----

const app = express();
// Load our publicPath first and prioritize it over UV.
app.use(express.static("./public"));
// Load vendor files last.
// The vendor's uv.config.js won't conflict with our uv.config.js inside the publicPath directory.
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

// Error for everything else
app.use((req, res) => {
	res.status(404);
	res.sendFile("./public/404.html");
});

const server = createServer();

server.on("request", (req, res) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	app(req, res);
});
server.on("upgrade", (req, socket, head) => {
	if (req.url.endsWith("/wisp/")) {
		wisp.routeRequest(req, socket, head);
		return;
	}
	socket.end();
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
	const address = server.address();
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({
	port,
});
