#pragma once

#include <QObject>
#include <QList>

class QTcpSocket;

class NetLog : public QObject
{
	Q_OBJECT
public:
	~NetLog();

	static void log(const QString &msg);
private:
	NetLog();

	void logInternal(const QString &msg);
private slots:
	void onConnected();
private:
	QList<QString> m_queue;
	QTcpSocket *m_pSock;
	bool m_connected;

	static NetLog *s_pInst;
};
