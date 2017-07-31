#include <QApplication>
#include <QCoreApplication>
#include "poswindow.h"
#include "posserver.h"
#include <QQuickView>
#include <QUrl>
#include <QtWebView>
#include <QDebug>
#include <QUdpSocket>
#include <QByteArray>
#include "netlog.h"


int main(int argc, char *argv[])
{
	if (argc > 1 && QString(argv[1]) == "-service")
	{
		QCoreApplication app(argc, argv);
		NetLog::log("Starting service");

		PosServer s;
		return app.exec();
	}

	QApplication app(argc, argv);
    QtWebView::initialize();

	NetLog::log("Starting application");

    for (int i = 0 ; i < argc ; i++)
    {
        qDebug() << argv[i];
		NetLog::log("Argument: " + QString(argv[i]));
    }

    PosWindow w;

	return app.exec();
}
