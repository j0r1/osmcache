#include "poswindow.h"
#include <QGeoPositionInfoSource>
#include <QWebSocketServer>
#include <QTimer>
#include <QDebug>
#include <QQuickItem>
#include <iostream>

using namespace std;

PosWindow::PosWindow()
{
	//setSource(QUrl("qrc:/qosmcache.qml"));
	setSource(QUrl::fromLocalFile("qosmcache.qml"));
	setResizeMode(QQuickView::SizeRootObjectToView);
	show();

	QTimer *pTimer = new QTimer(this);
	pTimer->setSingleShot(true);
	pTimer->setInterval(0);
	QObject::connect(pTimer, &QTimer::timeout, this, &PosWindow::onInitialTimeout);
	pTimer->start();

	QWebSocketServer *pSrv = new QWebSocketServer("QPosServer", QWebSocketServer::NonSecureMode, this);
	QObject::connect(this, SIGNAL(setHtml(QVariant,QVariant)), 
			         rootObject()->findChild<QObject*>("webview"), SLOT(onLoadHtml(QVariant,QVariant)));

	QFile f(":/index_allinone.html");
	if (f.open(QIODevice::ReadOnly))
	{
		QString html(f.readAll());
		emit setHtml(html, "http://localhost");
	}
	else
		log("Couldn't open html");
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
}

