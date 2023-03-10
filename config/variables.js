
var ENV = process.env.ENVIRONMENT || 'prod';

module.exports = { 
    mongoURL        : process.env.MongoURILOCAL,
    mongoURLEU      : process.env.MongoURIEU,
    mongoURLAWS      : process.env.MongoURIAWS,
    mongoURL158      : process.env.MongoURI158,
    mongoOptions    : { 
                        useNewUrlParser: true, 
                        useUnifiedTopology: true 
                      },
    mongoDB         : 'bigfoot',
    filePathUpload  : (ENV === 'prod' ? process.env.uploadFilePath : process.env.uploadFilePathDev),

    domainTLD       : [{name: 'com'}],
    emailGen        : [{name: 'webmaster'}, {name: 'info'}, {name: 'legal'}, {name: 'contact'}],
    ipAddresses     : ['103.104.17','211.20.18','211.72.53','122.116.227','122.52.119','61.244.218','50.74.20','127.0.0','::1'],
    webAppURL       : 'https://play.google.com/apps/testing/com.chinesepod.express',
    mobileAppURL    : 'https://play.google.com/store/apps/details?id=com.chinesepod.express',
    
};
