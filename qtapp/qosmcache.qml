import QtQuick 2.0
import QtWebView 1.1

Rectangle {
	id: page
	width: 640; height: 480

	WebView {
		id: webview
		objectName: "webview"
		width: page.width
		height: page.height
		x: 0
		y: 0

		function onLoadHtml(html, base) {
			console.log("onMyLoadHtml " + base) 
			webview.loadHtml(html, base)
		}
	}
}
