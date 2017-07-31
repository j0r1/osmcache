#include "netlog.h"
#include <QTcpSocket>

NetLog *NetLog::s_pInst = nullptr;

NetLog::NetLog()
{
	m_connected = false;
	m_pSock = new QTcpSocket(this);
	QObject::connect(m_pSock, SIGNAL(connected()), this, SLOT(onConnected()));
	m_pSock->connectToHost("10.11.12.199", 54321);
	m_pSock->waitForConnected(5000);
}

NetLog::~NetLog()
{
}

void NetLog::log(const QString &msg)
{
	if (!s_pInst)
		s_pInst = new NetLog();
	s_pInst->logInternal(msg);
}

void NetLog::logInternal(const QString &msg)
{
	m_queue.push_back(msg);

	if (m_connected)
	{
		for (auto msg : m_queue)
		{
			QByteArray b;
			b.append(msg + "\n");
			m_pSock->write(b);
			m_pSock->flush();
		}
		m_queue.clear();
	}
}

void NetLog::onConnected()
{
	m_connected = true;
}
