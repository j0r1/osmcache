######################################################################
# Automatically generated by qmake (3.0) Thu Jul 27 21:10:21 2017
######################################################################

TEMPLATE = app
TARGET = qosmcache
INCLUDEPATH += .

CONFIG += c++11

QT += widgets positioning websockets webview quick sensors
android {
	QT += androidextras
}

RESOURCES += qosmcache.qml index_allinone.html

# Input
HEADERS += poswindow.h netlog.h posserver.h
#FORMS += poswindow.ui
SOURCES += poswindow.cpp qtmain.cpp netlog.cpp posserver.cpp

DISTFILES += \
    android/AndroidManifest.xml \
    android/gradle/wrapper/gradle-wrapper.jar \
    android/gradlew \
    android/res/values/libs.xml \
    android/build.gradle \
    android/gradle/wrapper/gradle-wrapper.properties \
    android/gradlew.bat

android {
	ANDROID_PACKAGE_SOURCE_DIR = $$PWD/android
	ANDROID_PACKAGE_SOURCE_DIR = $$PWD/android
	ANDROID_JAVA_SOURCES.path = /src/org/qtproject/qosmcache
	ANDROID_JAVA_SOURCES.files = $$files($$PWD/*.java)
	INSTALLS += ANDROID_JAVA_SOURCES
}

