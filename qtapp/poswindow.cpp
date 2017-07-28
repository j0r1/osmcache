#include "poswindow.h"
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

	QTimer *pTimer = new QTimer(this);
	pTimer->setSingleShot(true);
	pTimer->setInterval(0);
	QObject::connect(pTimer, &QTimer::timeout, this, &PosWindow::onInitialTimeout);
	pTimer->start();

#ifdef __ANDROID__
	m_lastPositionString = "null";
#else
	m_lastPositionString = "{ \"latitude\": 55, \"longitude\": 12, \"accuracy\": 1, \"timestamp\":" 
		                   + QString::number(QDateTime::currentDateTime().toMSecsSinceEpoch()) + "}";
#endif

	QString webSocketUrl = "ws://localhost:";
	QWebSocketServer *pSrv = new QWebSocketServer("QPosServer", QWebSocketServer::NonSecureMode, this);
	if (!pSrv->listen(QHostAddress::LocalHost))
		log("Unable to create websocket server");
	else
	{
		webSocketUrl += QString::number(pSrv->serverPort());
		log("Websocket server URL is " + webSocketUrl);
	}

	QObject::connect(pSrv, SIGNAL(newConnection()), this, SLOT(onNewConnection()));
	QObject::connect(this, SIGNAL(setHtml(QVariant,QVariant)), 
			         rootObject()->findChild<QObject*>("webview"), SLOT(onLoadHtml(QVariant,QVariant)));
	QObject::connect(this, SIGNAL(setText(QVariant)), 
			         rootObject()->findChild<QObject*>("message"), SLOT(onSetText(QVariant)));

	QFile f(":/index_allinone.html");
	if (f.open(QIODevice::ReadOnly))
	{
		QString html(f.readAll());

		html.replace("var m_GEOWebSocketURL = null;", "var m_GEOWebSocketURL = '" + webSocketUrl + "'");
		emit setHtml(html, "http://localhost");
	}
	else
		log("Couldn't open html");

	QTimer *pPosUpdateTimer = new QTimer(this);
	pPosUpdateTimer->setInterval(1000);
	QObject::connect(pPosUpdateTimer, &QTimer::timeout, this, &PosWindow::onSendPositionString);
	pPosUpdateTimer->start();
}

PosWindow::~PosWindow()
{
}

void PosWindow::onInitialTimeout()
{
	QGeoPositionInfoSource *pSrc = QGeoPositionInfoSource::createDefaultSource(this);
	if (pSrc)
	{
		log("Got position source " + pSrc->sourceName());
		QObject::connect(pSrc, &QGeoPositionInfoSource::positionUpdated, this, &PosWindow::onPosUpdate);
		QObject::connect(pSrc, SIGNAL(error(QGeoPositionInfoSource::Error)), this, SLOT(onPosError(QGeoPositionInfoSource::Error)));
		pSrc->setUpdateInterval(1000);
		pSrc->startUpdates();
	}
	else
		log("Unable to get default position source");
}

void PosWindow::onPosUpdate(const QGeoPositionInfo &update)
{
	//log("Got update");
	auto coord = update.coordinate();
	auto t = update.timestamp();

	QString msg = coord.toString() + " (" + t.toString() + ")";
	log("Position: " + msg);
	//m_pPosEdit->setText(msg);

	m_lastPositionString = "{ \"latitude\": " + QString::number(coord.latitude()) + 
		                   ", \"longitude\": " + QString::number(coord.longitude()) + 
						   ", \"accuracy\": 1" +
						   ", \"timestamp\": " + QString::number(t.toMSecsSinceEpoch()) + 
						   "}";
}

void PosWindow::onPosError(QGeoPositionInfoSource::Error positioningError)
{
	QString errStr;

	if (positioningError == QGeoPositionInfoSource::AccessError)
		errStr = "AccessError";
	else if (positioningError == QGeoPositionInfoSource::ClosedError)
		errStr = "ClosedError";
	else if (positioningError == QGeoPositionInfoSource::NoError)
		errStr = "NoError";
	else if (positioningError == QGeoPositionInfoSource::UnknownSourceError)
		errStr = "UnknownSourceError";
	else
		errStr = "Error code not recognized";
	log("Got error: " + errStr);
}

void PosWindow::log(const QString &str0)
{
	QString str = str0;

	str.replace("\r", "");
	qDebug() << str;

	emit setText(str);

	/*
	bool important = false;
	QString lower = str.toLower();
	if (lower.indexOf("todo") >= 0 || lower.indexOf("warning") >= 0 ||
			lower.indexOf("error") >= 0 || lower.indexOf("!") >= 0)
		important = true;

	QTextCursor curs = m_pLogEdit->textCursor();

	QStringList lines = str.split("\n");

	for (int i = 0 ; i < lines.size() ; i++)
	{
		QString part = lines.at(i);

		if (important)
			m_pLogEdit->append("<b>" + part + "</b> ");
		else
			m_pLogEdit->append(part);
	}

	if (curs.atEnd())
		m_pLogEdit->setTextCursor(curs);
		*/
}

void PosWindow::onNewConnection()
{
	QWebSocketServer *pSrv = qobject_cast<QWebSocketServer*>(sender());
	if (!pSrv)
		return;

	QWebSocket *pSocket = pSrv->nextPendingConnection();
	if (!pSocket)
		return;

	log("New connection");
	m_connections.push_back(pSocket);
	QObject::connect(pSocket, SIGNAL(disconnected()), this, SLOT(onDisconnected()));
}

void PosWindow::onDisconnected()
{
	QWebSocket *pSock = qobject_cast<QWebSocket *>(sender());
	if (!pSock)
		return;

	int idx = -1;
	for (int i = 0 ; i < m_connections.size() ; i++)
	{
		if (m_connections[i] == pSock)
		{
			idx = i;
			break;
		}
	}

	if (idx >= 0)
	{
		log("Removing closed connection");
		m_connections.removeAt(idx);
	}
	else
		log("Disconnected socket not found in list");
}

void PosWindow::onSendPositionString()
{
	for (int i = 0 ; i < m_connections.size() ; i++)
		m_connections[i]->sendTextMessage(m_lastPositionString);
}

