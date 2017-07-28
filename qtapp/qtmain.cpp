#include <QApplication>
#include "poswindow.h"
#include <QQuickView>
#include <QUrl>
#include <QtWebView>

int main(int argc, char *argv[])
{
	QApplication app(argc, argv);
	QtWebView::initialize();
	PosWindow w;

	return app.exec();
}
