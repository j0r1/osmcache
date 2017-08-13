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
#include <QCompass>
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
	QObject::connect(this, SIGNAL(executeJavaScript(QVariant)), 
			         rootObject()->findChild<QObject*>("webview"), SLOT(onRunJavaScript(QVariant)));

	m_pCompass = new QCompass(this);
	if (m_pCompass->start())
	{
		QTimer *pCompassTimer = new QTimer(this);
		QObject::connect(pCompassTimer, &QTimer::timeout, this, &PosWindow::compassTimeout);
		pCompassTimer->setInterval(1000);
		pCompassTimer->start();
	}
	else
	{
		qDebug() << "Unable to start sensor";
	}

	QString webSocketUrl = "ws://localhost:44444";

	QFile f(":/index_allinone.html");
	if (f.open(QIODevice::ReadOnly))
	{
		QString html(f.readAll());

		html.replace("var m_GEOWebSocketURL = null;", "var m_GEOWebSocketURL = '" + webSocketUrl + "'");
		html.replace("var g_showAttrib = true;", "var g_showAttrib = false;");
		html.replace("var g_compassReading = null;", "var g_compassReading = '?';");
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

void PosWindow::compassTimeout()
{
	//qDebug() << "compassTimeout";
	auto reading = m_pCompass->reading();
	if (!reading)
	{
		qDebug() << "No compass reading";
		return;
	}

	log("Compass: " + QString::number(reading->azimuth()));
	emit executeJavaScript("g_compassReading = " + QString::number(reading->azimuth()));
}

