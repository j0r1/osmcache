import QtQuick 2.0
import QtWebView 1.1

Rectangle {
	id: page
	width: 640; height: 480

	WebView {
		id: webview
		objectName: "webview"
		width: page.width
		height: page.height-message.height
		x: 0
		y: 0

		function onLoadHtml(html, base) {
			//console.log("onMyLoadHtml " + base) 
			//console.log(html);
			webview.loadHtml(html, base)
		}
	}

	Text {
		id: message
		objectName: "message"
		x:0
		y: page.height-message.height
		width: page.width
		height: 40

		function onSetText(s)
		{
			console.log(s)
			message.text = s
		}
	}
}
