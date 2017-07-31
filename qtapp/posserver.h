#pragma once

#include <QObject>
#include <QGeoPositionInfoSource>
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
private:
	void scheduleGeoLocStart(int millisec);
	void setPositionMessage(const QString &str);

	QList<QWebSocket *> m_connections;
	QList<QString> m_positionMessages;
	QString m_lastPositionString;
};
