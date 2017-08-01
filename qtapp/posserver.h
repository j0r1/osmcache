#pragma once

#include <QObject>
#include <QGeoPositionInfoSource>
#include <QGeoCoordinate>
#include <QList>

class QWebSocket;

class PosServer : public QObject
{
	Q_OBJECT
public:
	PosServer();
	~PosServer();
public slots:
	void log(const QString &s);
private slots:
	void onStartGeoLoc();
	void onPosUpdate(const QGeoPositionInfo &update);
	void onPosError(QGeoPositionInfoSource::Error positioningError);
	void onNewConnection();
	void onDisconnected();
	void onSendPositionString();
	void onWebsocketMessage(const QString &msg);
	void onWebsocketTimeoutCheck();
private:
	void scheduleGeoLocStart(int millisec);
	void setPositionMessage(const QString &str);

	class WebSocketAndTime
	{
	public:
		WebSocketAndTime(QWebSocket *pSock, double t) : m_pSock(pSock), m_t(t) { }

		QWebSocket *socket() { return m_pSock; }
		double getLastReceiveTime() const { return m_t; }
		void setLastReceiveTime(double t) { m_t = t; }
	private:
		QWebSocket *m_pSock;
		double m_t;
	};

	QList<WebSocketAndTime *> m_connections;
	QList<QString> m_positionMessages;
	QString m_lastPositionString;

	QGeoCoordinate m_target;
};
