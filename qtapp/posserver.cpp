#include "posserver.h"
#include "netlog.h"
#include <QGeoPositionInfoSource>
#include <QWebSocketServer>
#include <QWebSocket>
#include <QTimer>
#include <QDebug>
#include <QApplication>
#include <QDateTime>
#include <iostream>

using namespace std;

PosServer::PosServer()
{
	scheduleGeoLocStart(0);

#ifdef __ANDROID__
	m_lastPositionString = "null";
#else
	m_lastPositionString = "{ \"latitude\": 55, \"longitude\": 12, \"accuracy\": 1, \"timestamp\":" 
		                   + QString::number(QDateTime::currentDateTime().toMSecsSinceEpoch()) + "}";
#endif

	QString webSocketUrl = "ws://localhost:";
	QWebSocketServer *pSrv = new QWebSocketServer("QPosServer", QWebSocketServer::NonSecureMode, this);
	if (!pSrv->listen(QHostAddress::LocalHost, 44444))
		log("Unable to create websocket server");
	else
	{
		webSocketUrl += QString::number(pSrv->serverPort());
		log("Websocket server URL is " + webSocketUrl);
	}

	QObject::connect(pSrv, SIGNAL(newConnection()), this, SLOT(onNewConnection()));

	QTimer *pPosUpdateTimer = new QTimer(this);
	pPosUpdateTimer->setInterval(1000);
	QObject::connect(pPosUpdateTimer, &QTimer::timeout, this, &PosServer::onSendPositionString);
	pPosUpdateTimer->start();
}

PosServer::~PosServer()
{
}

void PosServer::onStartGeoLoc()
{
	QTimer *pTimer = qobject_cast<QTimer *>(sender());
	if (pTimer)
		pTimer->deleteLater();

	QGeoPositionInfoSource *pSrc = QGeoPositionInfoSource::createDefaultSource(this);
	if (pSrc)
	{
		log("Got position source " + pSrc->sourceName());
		QObject::connect(pSrc, &QGeoPositionInfoSource::positionUpdated, this, &PosServer::onPosUpdate);
		QObject::connect(pSrc, SIGNAL(error(QGeoPositionInfoSource::Error)), this, SLOT(onPosError(QGeoPositionInfoSource::Error)));
		pSrc->setUpdateInterval(1000);
		pSrc->startUpdates();
	}
	else
	{
		log("Unable to get default position source, trying again in 10 secs");
		scheduleGeoLocStart(10000);
	}
}

void PosServer::onPosUpdate(const QGeoPositionInfo &update)
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

void PosServer::onPosError(QGeoPositionInfoSource::Error positioningError)
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

	QGeoPositionInfoSource *pSrc = qobject_cast<QGeoPositionInfoSource*>(sender());
	if (pSrc)
	{
		QObject::disconnect(pSrc, &QGeoPositionInfoSource::positionUpdated, this, &PosServer::onPosUpdate);
		QObject::disconnect(pSrc, SIGNAL(error(QGeoPositionInfoSource::Error)), this, SLOT(onPosError(QGeoPositionInfoSource::Error)));
		pSrc->deleteLater();
	}

	log("Scheduling geoloc restart in 10 sec");
	scheduleGeoLocStart(10000);
}

void PosServer::log(const QString &str0)
{
	QString str = str0;

	str.replace("\r", "");
	qDebug() << str;

	NetLog::log(str0);
}

void PosServer::onNewConnection()
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

void PosServer::onDisconnected()
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

void PosServer::onSendPositionString()
{
	for (int i = 0 ; i < m_connections.size() ; i++)
		m_connections[i]->sendTextMessage(m_lastPositionString);
}

void PosServer::scheduleGeoLocStart(int millisec)
{
	QTimer *pTimer = new QTimer(this);
	pTimer->setSingleShot(true);
	pTimer->setInterval(millisec);
	QObject::connect(pTimer, &QTimer::timeout, this, &PosServer::onStartGeoLoc);
	pTimer->start();
}

