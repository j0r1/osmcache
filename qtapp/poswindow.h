#pragma once

#include <QQuickView>
#include <QGeoPositionInfoSource>
#include <QList>

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
private:
	void keyReleaseEvent(QKeyEvent *e);
};
