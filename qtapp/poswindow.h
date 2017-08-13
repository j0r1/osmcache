#pragma once

#include <QQuickView>
#include <QGeoPositionInfoSource>
#include <QList>

class QCompass;

class PosWindow : public QQuickView
{
	Q_OBJECT
public:
	PosWindow();
	~PosWindow();
signals:
	void setHtml(QVariant html, QVariant baseUrl);
	void setText(QVariant s);
	void executeJavaScript(QVariant code);
public slots:
	void log(const QString &s);
private slots:
	void compassTimeout();
private:
	QCompass *m_pCompass;
};
