/*global UVServiceWorker,__uv$config*/
importScripts("uv.bundle.js");
importScripts("uv.config.js");
importScripts(__uv$config.sw || "uv.sw.js");

const uv = new UVServiceWorker();

const BLOCKED = [
	// Google ads + tracking
	"doubleclick.net", "googlesyndication.com", "googleadservices.com",
	"adservice.google.com", "google-analytics.com",
	"googletagmanager.com", "googletagservices.com",
	// Big ad exchanges
	"amazon-adsystem.com", "adnxs.com", "criteo.com", "criteo.net",
	"pubmatic.com", "rubiconproject.com", "openx.net", "adsrvr.org",
	"casalemedia.com", "indexww.com", "smartadserver.com", "yieldmo.com",
	"33across.com", "sharethrough.com", "media.net", "bidswitch.net",
	"contextweb.com", "3lift.com", "teads.tv", "adform.net",
	// "Recommended stories" junk
	"taboola.com", "outbrain.com", "revcontent.com", "mgid.com",
	// Pop-ups and redirect ads
	"popads.net", "popcash.net", "propellerads.com", "adsterra.com",
	"hilltopads.net", "clickadu.com", "adcash.com", "onclickads.net",
	// Adult / inappropriate ad networks
	"exoclick.com", "juicyads.com", "trafficjunky.net",
	"trafficstars.com", "tsyndicate.com", "ero-advertising.com",
	"plugrush.com", "adxpansion.com", "trafficfactory.biz",
	"crakrevenue.com",
	// Scam, fake-download, and redirect ads
	"ad-maven.com", "admaven.com", "galaksion.com", "richads.com",
	"popmyads.com", "clickaine.com",
	// Trackers
	"scorecardresearch.com", "moatads.com", "quantserve.com",
	"hotjar.com", "chartbeat.com", "adsafeprotected.com",
	"doubleverify.com", "zedo.com",
];

function isBlocked(request) {
	try {
		const url = new URL(request.url);
		if (!url.pathname.startsWith(__uv$config.prefix)) return false;
		const real = new URL(
			__uv$config.decodeUrl(url.pathname.slice(__uv$config.prefix.length))
		);
		const host = real.hostname;
		return BLOCKED.some((d) => host === d || host.endsWith("." + d));
	} catch (e) {
		return false;
	}
}

async function handleRequest(event) {
	if (uv.route(event)) {
		if (isBlocked(event.request)) {
			return new Response("", { status: 204 });
		}
		return await uv.fetch(event);
	}
	return await fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
