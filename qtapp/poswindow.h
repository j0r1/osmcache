#pragma once

#include <QQuickView>
#include <QGeoPositionInfoSource>

class PosWindow : public QQuickView
{
	Q_OBJECT
public:
	PosWindow();
	~PosWindow();
signals:
	void setHtml(QVariant html, QVariant baseUrl);
public slots:
	void log(const QString &s);
private slots:
	void onInitialTimeout();
	void onPosUpdate(const QGeoPositionInfo &update);
	void onPosError(QGeoPositionInfoSource::Error positioningError);
	void onNewConnection();
};
