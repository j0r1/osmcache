#pragma once

#include <QQuickView>
#include <QGeoPositionInfoSource>
#include <QList>

class QWebSocket;

class PosWindow : public QQuickView
{
	Q_OBJECT
public:
	PosWindow();
	~PosWindow();
signals:
	void setHtml(QVariant html, QVariant baseUrl);
	void setText(QVariant s);
public slots:
	void log(const QString &s);
private slots:
	void onInitialTimeout();
	void onPosUpdate(const QGeoPositionInfo &update);
	void onPosError(QGeoPositionInfoSource::Error positioningError);
	void onNewConnection();
	void onDisconnected();
	void onSendPositionString();
private:
	QList<QWebSocket *> m_connections;
	QString m_lastPositionString;
};
