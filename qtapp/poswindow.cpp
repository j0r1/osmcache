#include "poswindow.h"
#include "netlog.h"
#include <QGeoPositionInfoSource>
#include <QWebSocketServer>
#include <QWebSocket>
#include <QTimer>
#include <QDebug>
#include <QQuickItem>
#include <QApplication>
#include <QDateTime>
#include <iostream>

using namespace std;

PosWindow::PosWindow()
{
#ifdef __ANDROID__
	setSource(QUrl("qrc:/qosmcache.qml"));
#else
	setSource(QUrl::fromLocalFile("qosmcache.qml"));
#endif
	setResizeMode(QQuickView::SizeRootObjectToView);
	show();

	QObject::connect(this, SIGNAL(setHtml(QVariant,QVariant)), 
			         rootObject()->findChild<QObject*>("webview"), SLOT(onLoadHtml(QVariant,QVariant)));
	QObject::connect(this, SIGNAL(setText(QVariant)), 
			         rootObject()->findChild<QObject*>("message"), SLOT(onSetText(QVariant)));

	QString webSocketUrl = "ws://localhost:44444";

	QFile f(":/index_allinone.html");
	if (f.open(QIODevice::ReadOnly))
	{
		QString html(f.readAll());

		html.replace("var m_GEOWebSocketURL = null;", "var m_GEOWebSocketURL = '" + webSocketUrl + "'");
		html.replace("var g_showAttrib = true;", "var g_showAttrib = false;");
		emit setHtml(html, "http://localhost");
	}
	else
		log("Couldn't open html");
}

PosWindow::~PosWindow()
{
}

void PosWindow::log(const QString &str0)
{
	QString str = str0;

	str.replace("\r", "");
	qDebug() << str;

	emit setText(str);

	NetLog::log(str0);
}
