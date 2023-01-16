
let rpoUsers = require('./repositories/users')
let rpoPromotions = require('./repositories/promotions2015')
let rpoVideoMail = require('./repositories/videoMail')
let rpoVideoMailNames = require('./repositories/videoMailNames')

const _ = require("lodash");  
let jobService = require('./services/jobService')

exports.getRandomLead = async function(inputs) {
  const moment = require('moment');

  const pickTime = () => {
    let now = new Date();
    let hour = now.getHours();
    return [60 * 9 - 60 * hour, 60 * 18 - 60 * hour];
  };

  const pickNextAccount = async function () {
    let targetTime = pickTime();
    if (!targetTime) {
      return await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });
    }
    return await rpoUsers.getNativeProduction(`
      SELECT id, name, email, ip_country, ip_address, confirm_status, code, created_at as createdAt FROM users
      WHERE updated_at > '${new Date(
        Date.now() - 360 * 24 * 60 * 60 * 1000
      ).toISOString()}'
      AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000
      ).toISOString()}')
      AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'emailReviewLogic' and last_update > '${new Date(
        Date.now() - 3 * 60 * 60 * 1000
      ).toISOString()}')
      AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value < ${
        targetTime[0]
      })
      AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value > ${
        targetTime[1]
      })
      AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'invalidEmail')
      AND id NOT IN (select user_id from mailing_donotcontact)
      ORDER BY RAND()
      LIMIT 1
    `);
  };

  const validateEmail = function (email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  let userData;
  // console.log("here", inputs);
  if (inputs.email) {

    userData = await this.getUserData(inputs);
    // console.log(userData);
  } else {
    let notPicked = true;
    let i = 0;
    while (notPicked && i < 3) {
      userData = await pickNextAccount();
      if (userData && userData.id && validateEmail(userData.email)) {
        notPicked = false;
      } else if (userData && userData.id && !validateEmail(userData.email)) {
        // await UserOptions.updateOrCreate(
        //   { user_id: userData.id, option_key: 'invalidEmail' },
        //   {
        //     user_id: userData.id,
        //     option_key: 'invalidEmail',
        //     option_value: userData.email,
        //   }
        // );
      }
      i++;
    }
  }


  if (!userData || !userData.id) {
    return null;
  }

  // if (!validateEmail(userData.email)) {
  //   await UserOptions.updateOrCreate(
  //     { user_id: userData.id, option_key: 'invalidEmail' },
  //     {
  //       user_id: userData.id,
  //       option_key: 'invalidEmail',
  //       option_value: userData.email,
  //     }
  //   );
  //   return null;
  // }

  let curMonth;
  let prevMonth;
  let prevPrevMonth;
  const monthNames = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // let currentDate = new Date();
  let currentDate = new Date(new Date().setMonth(new Date().getMonth() - 1));

  curMonth = currentDate.getMonth() + 1;
  prevMonth =
    new Date(new Date().setMonth(currentDate.getMonth() - 1)).getMonth() + 1;
  let from = new Date(new Date().setMonth(currentDate.getMonth() - 2));
  prevPrevMonth = from.getMonth() + 1;

  let startDate = `${from.getFullYear()}-${(
    '0' +
    (from.getMonth() + 1)
  ).slice(-2)}-01 UTC`;


  var iconv = require('iconv-lite');
  var buff = new Buffer.from(userData.email, 'utf8');
  userData.email = iconv.decode(buff, 'ISO-8859-1');

  async function calculateLogs(date, email, type) {
    let sql = `
    SELECT MONTH(log.accesslog_time) as month, count(distinct DAY(log.accesslog_time)) AS count FROM chinesepod_logging.cp_accesslog log
    WHERE log.accesslog_time > $1 AND accesslog_user = $2
      AND log.accesslog_urlbase REGEXP $3
    GROUP BY MONTH(log.accesslog_time);
    `;
    return (
      await BackupLogging.getDatastore().sendNativeQuery(sql, [
        date,
        email,
        type,
      ])
    )['rows'];
  }

  function calculateCounts(data, timeframe, type) {
    let segment = data[type];
    if (segment) {
      let subset = segment.filter((period) => period.month === timeframe);
      if (subset.length > 0) {
        return subset[0]['count'];
      }
    }
    return 0;
  }

  const arrSum = function (arr) {
    return arr.reduce(function (a, b) {
      return a + b;
    }, 0);
  };

  function toObject(arr) {
    var rv = {};
    arr.forEach((option) => {
      rv[option.option_key] = option.option_value;
    });
    return rv;
  }

  let logData = {};
  let transactionData = {};
  let userAccess = {};
  let mailingUnsubscribe = [];
  let latestLog;
  let emailLog = [];
  let userOptions = [];
  let lessonsStudied = [];
  let userPreferences;
  let userVocabulary;
  let recentVocabulary;

  Promise.delay = function (t, val) {
    return new Promise((resolve) => {
      setTimeout(resolve.bind(null, val), t);
    });
  };

  Promise.raceAll = function (promises, timeoutTime, timeoutVal) {
    return Promise.all(
      promises.map((p) => {
        return Promise.race([p, Promise.delay(timeoutTime, timeoutVal)]);
      })
    );
  };

  logData['web'] = await this.getCalculateLogs(
    moment().subtract(2, 'months').format('YYYY-MM-DD HH:mm:ss'),
    userData.email,
    'https://www.chinesepod.com|https://chinesepod.com'
  )

  transactionData = await this.getTransactions(userData.id)
  userAccess = await this.getUserSiteLinks(userData.id, 2)
  mailingUnsubscribe = await this.getMailingDoNotContact(userData.id)
  emailLog = await this.getEmailLog(userData.id)
  latestLog = await this.getBackupLogging(userData.email)
  userOptions = await this.getUserOptions(userData.id)
  lessonsStudied = await this.getUserContents(userData.id)
  userPreferences = await this.getUserPreferences(userData.id)

  let usrVoc = await this.getUserVocabulary(userData.id)

  userVocabulary = usrVoc.length;
  recentVocabulary = usrVoc.filter(
    (i) => moment(i.last_test_date) > moment().subtract(14, 'days')
  ).length;

  var location = {
    signup: userData.ip_country,
  };

  if ((latestLog && latestLog['access_ip']) || userData.ip_address) {
    const geoip = require('geoip-lite');
    try {
      let geo;
      if (userData.ip_address) {
        geo = geoip.lookup(userData.ip_address);
        location.signupData = geo;
      }
      if (latestLog && latestLog['access_ip']) {
        geo = geoip.lookup(latestLog['access_ip']);
        if (geo && geo['country']) {
          location.latest = await this.getCountryFullName(
            geo['country']
          );
        }
        location.latestData = geo;
      }
      location.geoData = geo;
      location.eu = geo ? geo.eu : 0;
    } catch (e) {
      console.log(e);
    }
  }

  // CLEANUP USER OPTIONS
  userOptions = toObject(userOptions);
  userOptions['charSet'] = userOptions['charSet']
    ? userOptions['charSet']
    : 'simplified';
  userOptions['level'] = userOptions['level']
    ? this.intToLevel(userOptions['level'])
    : '';

  //CONVERT SOME OPTIONS TO Boolean
  userOptions['pinyin'] = userOptions['pinyin'] === 'true';
  userOptions['autoMarkStudied'] = !(
    userOptions['autoMarkStudied'] === 'false'
  );
  userOptions['newDash'] = !(userOptions['newDash'] === 'false');

  //PARSE SOME OPTIONS FROM JSON
  userOptions['emailPreferences'] = userOptions['emailPreferences']
    ? JSON.parse(userOptions['emailPreferences'])
    : {
        subscribedPromotions: true,
        subscribedAcademic: true,
        subscribedWeeklyNewLessons: true,
        subscribedWordOfTheDay: true,
        betaNotifications: true,
      };
  userOptions['viewedCheckout'] = userOptions['viewedCheckout']
    ? JSON.parse(userOptions['viewedCheckout'])
    : false;
  userOptions['learningObjective'] = userOptions['learningObjective']
    ? JSON.parse(userOptions['learningObjective'])
    : false;

  let jsLastSeen;
  let phpLastSeen;

  if (userData.lastSeenAt && parseInt(userData.lastSeenAt)) {
    jsLastSeen = new Date(parseInt(userData.lastSeenAt));
  }

  if (userPreferences && userPreferences.lastSeenAt) {
    phpLastSeen = userPreferences.lastSeenAt;
  }

  if (jsLastSeen && phpLastSeen) {
    if (jsLastSeen > phpLastSeen) {
      userData.lastSeenAt = jsLastSeen;
    } else {
      userData.lastSeenAt = phpLastSeen;
    }
  }

  if (!userData.lastSeenAt) {
    if (userData.updatedAt > userData.createdAt) {
      userData.lastSeenAt = userData.updatedAt;
    } else {
      userData.lastSeenAt = userData.createdAt;
    }
  }

  let returnData = {
    ...userOptions,
    ...{
      userVocabulary,
      recentVocabulary,
      userData: _.pick(userData, [
        'id',
        'email',
        'name',
        'code',
        'trial',
        'createdAt',
        'updatedAt',
        'lastSeenAt',
      ]),
      // token: await this.getUserToken(userData.id),
      // tempToken: jwToken.sign({ userId: userData.id }, '14d'),
      active: false,
      subscription: await this.getAccessType(userData.id),
      review_date: new Date(),
      // review_data: emailReviewLogic && emailReviewLogic['option_value'] ? JSON.parse(emailReviewLogic['option_value']) : '',
      formerly_paid:
        transactionData && transactionData['createdAt']
          ? transactionData['createdAt']
          : '',
      email_confirmed: !!userData.confirm_status,
      unsubscribed:
        Array.isArray(mailingUnsubscribe) && !!mailingUnsubscribe.length,
      act_curr:
        logData && logData['web']
          ? calculateCounts(logData, curMonth, 'web')
          : 0,
      act_prev: logData && ['web']
        ? calculateCounts(logData, prevMonth, 'web')
        : 0,
      act_prev_prev:
        logData && logData['web']
          ? calculateCounts(logData, prevPrevMonth, 'web')
          : 0,
      browser: userAccess['signup_user_agent'],
      used_app_ios_curr:
        logData && logData['ios_all']
          ? calculateCounts(logData, curMonth, 'ios')
          : 0,
      used_app_ios_recent:
        logData && logData['ios_all']
          ? calculateCounts(logData, prevMonth, 'ios')
          : 0,
      used_app_ios_ever:
        logData && logData['ios_all']
          ? arrSum(logData['ios_all'].map((log) => log.count))
          : 0,
      used_app_android_curr:
        logData && logData['android_all']
          ? calculateCounts(logData, curMonth, 'android')
          : 0,
      used_app_android_recent:
        logData && logData['android_all']
          ? calculateCounts(logData, prevMonth, 'android')
          : 0,
      used_app_android_ever:
        logData && logData['android_all']
          ? arrSum(logData['android_all'].map((log) => log.count))
          : 0,
      used_app_recap_curr:
        logData && logData['recap_all']
          ? calculateCounts(logData, curMonth, 'recap')
          : 0,
      used_app_recap_recent:
        logData && logData['recap_all']
          ? calculateCounts(logData, prevMonth, 'recap')
          : 0,
      used_app_recap_ever:
        logData && logData['recap_all']
          ? arrSum(logData['recap_all'].map((log) => log.count))
          : 0,
      drip_emails_sent: emailLog && Array.isArray(emailLog) ? emailLog : [],
      last_drip_email:
        emailLog && Array.isArray(emailLog) && emailLog.length
          ? emailLog[emailLog.length - 1]
          : '',
      location: location,
      overviewMonth: monthNames[curMonth],
      trailingMonthT1: monthNames[prevMonth],
      trailingMonthT2: monthNames[prevPrevMonth],
      lessonsStudied: lessonsStudied,
      userCourseCount: await this.getUserCoursesCount(userData.id),
      // characterLessons: await UserContents.find({
      //   user_id: userData.id,
      //   updatedAt: { '>=': new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
      //   lesson: {
      //     in: sails.config.custom.recapWhitelist,
      //   },
      //   studied: 1,
      // })
      //   .sort('updatedAt DESC')
      //   .limit(1),
      // characterStudies: await UserContents.count({
      //   user_id: userData.id,
      //   updatedAt: { '>=': new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
      //   lesson: {
      //     in: sails.config.custom.recapWhitelist,
      //   },
      //   studied: 1,
      // }),
    },
  };

  if (userData.createdAt > new Date('2018-01-01')) {
    returnData.active = true;
  } else if (
    returnData['act_curr'] ||
    returnData['act_prev'] ||
    returnData['act_prev_prev'] ||
    returnData['used_app_android_ever'] ||
    returnData['used_app_ios_ever'] ||
    returnData['used_app_recap_ever']
  ) {
    returnData.active = true;
  } else if (returnData['subscription'] !== 'free') {
    returnData.active = true;
  }
  // await UserOptions.updateOrCreate(
  //   { user_id: userData.id, option_key: 'emailReviewLogic' },
  //   {
  //     user_id: userData.id,
  //     option_key: 'emailReviewLogic',
  //     option_value: JSON.stringify(returnData),
  //   }
  // );

  return returnData;

}

exports.sendEmailRandomLeads = async function(inputs) {
  
  const moment = require('moment-timezone');
  const nodemailer = require('nodemailer');
  console.log("calling send email random leads", inputs);
  let team = require('./lib/team.json');

  const Email = require('email-templates');
  let email = new Email();

  let startTime = new Date();
  const capitalize = require('lodash.capitalize');
  const mailgun = require('mailgun-js')({
    apiKey: process.env.mailAPI,
    domain: process.env.mailDomain,
  });

  const sendMailgunEmail = async (
    emailData,
    emailTags,
    addBccBoolean,
    bccListArray
  ) => {
    return await mailgun
      .messages()
      .send({
        ...emailData,
        ...{
          'o:tag': emailTags,
          bcc: addBccBoolean ? bccListArray : [],
        },
      })
      .catch((e) => {
        // bugsnag.notify(e);
        console.log(e)
      });
  };

  const sendGmailEmail = async (
    emailData,
    emailTags,
    addBccBoolean,
    bccListArray
  ) => {
    const mail = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'susie@chinesepod.com',
        pass: 'bigfoot1234',
      },
    });

    return await new Promise((resolve, reject) => {
      mail.sendMail(
        {
          ...emailData,
          bcc: addBccBoolean ? bccListArray : [],
        },
        (error, info) => {
          if (error) {
            bugsnag.notify(error);
            reject(error);
          } else {
            resolve({ ...info, ...{ id: info.messageId } });
          }
        }
      );
    });
  };

  let user = await this.getRandomLead(inputs);

  // console.log(user);
  if (!user || !user.userData) {
    console.log(`Not a valid user - ${JSON.stringify(user)}`)
    return 'No Valid User Found';
  }

  // return "Complete"+ inputs.email;

  let firstName;
  let fullName;
  if (user.userData && user.userData.name) {
    firstName = this.calculateFirstName(
      user.userData.name
    );
    fullName = user.userData.name
      .split(' ')
      .map((word) => capitalize(word))
      .join(' ');
  }

  let data;
  let html;
  let northAmerica = false;
  let userOffset;
  let localTime;
  let now = new Date();
  let userTimeOnSite =
    user.userData && user.userData.createdAt
      ? moment(now).diff(moment(user.userData.createdAt), 'days')
      : 0;
  let weekday = ![0, 6].includes(now.getDay());
  let extendedWeek = now.getDay() !== 0; //not sunday
  let hour = now.getHours();
  let currentYear = now.getFullYear();
  let userTimezone =
    user.location && user.location.geoData && user.location.geoData.timezone
      ? user.location.geoData.timezone
      : 0;

  if (userTimezone) {
    userOffset = moment.tz(userTimezone).utcOffset();
    localTime = new Date(
      new Date().setTime(now.getTime() + userOffset * 60 * 1000)
    );
    // sails.log.info({
    //   userTimezone: userTimezone,
    //   offset: userOffset,
    //   localTime: localTime,
    // });

    // COMMENT OUT - FELIX
    // TODO: REPLICATE UPSERT IN MONGO

    // if (!user.tzOffset || user.tzOffset !== userOffset) {
    //   await Promise.all([
    //     UserOptions.updateOrCreate(
    //       { user_id: user.userData.id, option_key: 'timezone' },
    //       {
    //         user_id: user.userData.id,
    //         option_key: 'timezone',
    //         option_value: userTimezone,
    //       }
    //     ),
    //     UserOptions.updateOrCreate(
    //       { user_id: user.userData.id, option_key: 'continent' },
    //       {
    //         user_id: user.userData.id,
    //         option_key: 'continent',
    //         option_value: userTimezone.split('/')[0],
    //       }
    //     ),
    //     UserOptions.updateOrCreate(
    //       { user_id: user.userData.id, option_key: 'tzOffset' },
    //       {
    //         user_id: user.userData.id,
    //         option_key: 'tzOffset',
    //         option_value: userOffset,
    //       }
    //     ),
    //   ]);
    // }
  }

  let deliveryWindow = localTime
    ? localTime.getHours() >= 9 && localTime.getHours() < 19
    : true;
  let sameDayAsUTC = localTime ? localTime.getDate() === now.getDate() : true;
  let justJoined =
    user.userData.createdAt > new Date(Date.now() - 3 * 60 * 60 * 1000);

  if (justJoined) {
    try {
      userEmailQueue.add(
        'SendEmailToRandomLead',
        { email: user.userData.email, ignore: true },
        {
          delay: 1000 * 60 * 60 * 3,
          jobId: `UserEmailQueue-${user.userData.email}-repeat-${
            Date.now() + 1000 * 60 * 60 * 3
          }`,
          timeout: 120000,
        }
      );
    } catch (e) {}

    return `Outside Review Window for Email to ${
      user.userData.email
    } - skipped - time: ${Math.round(
      (new Date() - startTime) / 1000
    )} seconds`;
  }

  let inofficeAsia = hour >= 1 && hour < 11;
  let inofficeUS = hour >= 13 && hour < 23;
  let location = userOffset <= -120 ? 'america' : 'asia';

  //TODO: Determine whether firstname should be kept here
  let inoffice =
    weekday &&
    ((location === 'america' && inofficeUS) ||
      (location === 'asia' && inofficeAsia));

  let addBcc =
    user.userData.email &&
    user.userData.email.slice(1, 2).toUpperCase() === 'M';
  let bccList = [
    'ugis@chinesepod.com',
    'mgleiss@chinesepod.com',
    'ali@chinesepod.com',
  ];

  //TODO: REMOVE & CLEANUP LATER
  if (new Date() < new Date('2021-05-15 05:00')) {
    addBcc = true;
    bccList = ['wesley@chinesepod.com'];
  }

  let previousEmails = user.drip_emails_sent.map(
    (email) => email.email_id.split('--')[0]
  );
  let previousEmailsCategories = user.drip_emails_sent.map(
    (email) => email.email_id.split('-')[0]
  );

  console.log("prev emails",previousEmails);

  let openedEmails = user.drip_emails_sent
    .filter((email) => email.opens)
    .map((email) => email.email_id.split('--')[0]);

  // let lessonsRecapReady = (
  //   await ContentsRecapReady.find().select('lessonId')
  // ).map((lesson) => lesson.lessonId);

  let promoCode;

  //TESTING VARIABLES GO HERE!!!!!


  //NON-FIXED HOLIDAYS
  const easterStart = new Date('2021-04-02');
  const easterFollowup = new Date('2021-04-04');
  const easterEnd = new Date('2021-04-04 22:00 UTC');

  const goldenWeekStart = new Date('2020-10-01 00:00:00 UTC');
  const goldenWeekFollowUpOne = new Date('2020-10-04 00:00:00 UTC');
  const goldenWeekFollowUpTwo = new Date('2020-10-05 00:00:00 UTC');
  const goldenWeekFollowUpThree = new Date('2020-10-06 00:00:00 UTC');
  const goldenWeekFinal = new Date('2020-10-07 00:00:00 UTC');
  const goldenWeekEnd = new Date('2020-10-07 21:00:00 UTC');

  //MOTHERS DAY
  let mothersDayStart = new Date('2021-05-07 02:00:00 UTC');
  // if (currentYear === 2022) {
  //   mothersDayStart = new Date('2022-05-08 02:00:00 UTC');
  // } else if (currentYear === 2023) {
  //   mothersDayStart = new Date('2023-05-14 02:00:00 UTC');
  // }
  const mothersDayEnd = moment(mothersDayStart.toISOString())
    .add(2, 'days')
    .toDate();

  //MEMORIAL DAY
  let memorialDayStart = new Date('2021-05-31 14:00:00 UTC');
  if (currentYear === 2022) {
    memorialDayStart = new Date('2022-05-30 14:00:00 UTC');
  } else if (currentYear === 2023) {
    memorialDayStart = new Date('2023-05-29 14:00:00 UTC');
  }
  const memorialDayEnd = moment(memorialDayStart.toISOString())
    .add(1, 'days')
    .toDate();
  const memorialDayFollowupEnd = moment(memorialDayEnd)
    .add(1, 'days')
    .toDate();

  //DRAGON BOAT
  let dragonBoatDayStart = new Date('2021-06-14 02:00:00 UTC');
  if (currentYear === 2022) {
    dragonBoatDayStart = new Date('2022-06-03 02:00:00 UTC');
  } else if (currentYear === 2023) {
    dragonBoatDayStart = new Date('2023-06-22 02:00:00 UTC');
  }
  const dragonBoatDayEnd = moment(dragonBoatDayStart.toISOString())
    .add(2, 'days')
    .toDate();
  const dragonBoatDayFollowupEnd = moment(dragonBoatDayEnd)
    .add(1, 'days')
    .toDate();

  //ANZAC DAY
  const anzacDayStart = new Date(currentYear, 3, 25, 0);
  const anzacDayEnd = moment(anzacDayStart.toISOString())
    .add(1, 'days')
    .toDate();

  //FREEDOM DAY
  const freedomDayStart = new Date(currentYear, 3, 27, 8);
  const freedomDayEnd = moment(freedomDayStart.toISOString())
    .add(1, 'days')
    .toDate();

  //KINGS DAY
  const kingsDayStart = new Date(currentYear, 3, 27, 8);
  const kingsDayEnd = moment(kingsDayStart.toISOString())
    .add(1, 'days')
    .toDate();

  //EUROPE DAY
  const europeDayStart = new Date(currentYear, 4, 9, 8);
  const europeDayEnd = moment(europeDayStart.toISOString())
    .add(12, 'hours')
    .toDate();
  const europeDayFollowupEnd = moment(europeDayEnd).add(1, 'days').toDate();

  //DENMARK DAY
  const denmarkDayStart = new Date(currentYear, 5, 5, 8);
  const denmarkDayEnd = moment(denmarkDayStart.toISOString())
    .add(1, 'days')
    .toDate();
  const denmarkDayFollowupEnd = moment(denmarkDayEnd).add(1, 'days').toDate();

  //SWEDEN DAY
  const swedenDayStart = new Date(currentYear, 5, 6, 8);
  const swedenDayEnd = moment(swedenDayStart.toISOString())
    .add(1, 'days')
    .toDate();
  const swedenDayFollowupEnd = moment(swedenDayEnd).add(1, 'days').toDate();

  //CANADA DAY
  const canadaDayStart = new Date(currentYear, 6, 1, 13);
  const canadaDayEnd = moment(canadaDayStart.toISOString())
    .add(1, 'days')
    .toDate();
  const canadaDayFollowupEnd = canadaDayEnd;

  //US INDEPENDENCE DAY
  const independenceDayStart = new Date(currentYear, 6, 3, 13);
  const independenceDayEnd = moment(independenceDayStart.toISOString())
    .add(3, 'days')
    .toDate();
  const independenceDayFollowupEnd = moment(independenceDayEnd)
    .add(1, 'days')
    .toDate();

  // SUMMER SALE
  const summerSaleStart = new Date(currentYear, 7, 4, 2);
  const summerSaleEnd = new Date(currentYear, 8, 1, 2);

  // LABOR DAY SALE
  let laborDayStart = new Date(currentYear, 8, 5, 13);
  let laborDayEnd = new Date(currentYear, 8, 7, 22);
  if (currentYear === 2021) {
    laborDayStart = new Date('2021-09-04 13:00:00 UTC');
    laborDayEnd = new Date('2021-09-06 22:00:00 UTC');
  } else if (currentYear === 2022) {
    laborDayStart = new Date('2022-09-03 13:00:00 UTC');
    laborDayEnd = new Date('2022-09-05 22:00:00 UTC');
  } else if (currentYear === 2023) {
    laborDayStart = new Date('2023-09-02 13:00:00 UTC');
    laborDayEnd = new Date('2023-09-04 22:00:00 UTC');
  }

  //TODO: 2020 SPECIFIC DATES
  const thanksgivingStart = new Date('2020-11-26 08:00 EST');
  const thanksgivingEnd = new Date('2020-11-26 23:00 EST');

  const blackFridayStart = new Date('2020-11-27 08:00 EST');
  const blackFridayEnd = new Date('2020-11-29 02:00 EST');

  const cyberMondayStart = new Date('2020-11-30 08:00 EST');
  const cyberMondayEnd = new Date('2020-11-30 23:59 EST');

  //TODO: 2021 SPECIFIC DATES
  const cnyPromoStart = new Date('2021-02-09 03:00 UTC');
  const cnyPromoEnd = new Date('2021-02-12 03:00 UTC');
  const cnyPromoFollowupEnd = new Date('2021-02-14 03:00 UTC');
  const cnyPromoLastChanceEnd = new Date('2021-02-16 03:00 UTC');

  //WINTER HOLIDAYS
  const holidaysStart = moment({
    year: 2020,
    month: 11,
    day: 22,
    hour: 12,
  }).toDate();
  const holidaysEnd = moment(holidaysStart).add(3, 'days').toDate();
  const holidaysFollowupEnd = moment(holidaysEnd).add(1, 'days').toDate();

  //NEW YEAR'S
  const newYearStart = moment({ year: 2020, month: 11, day: 30 }).toDate();
  const newYearEnd = moment({
    year: 2020,
    month: 11,
    day: 31,
    hour: 12,
  }).toDate();
// console.log(user);
  if (
    // EMAIL CONFIRMATION DRIP
    deliveryWindow &&
    inoffice &&
    !user.email_confirmed &&
    user.userData.createdAt >
      new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) &&
    !previousEmails.includes('email-confirmation-personal')
  ) {
    console.log('1')
    if (firstName) {
      html = await email.render('confirm-email/html', {
        firstName: firstName ? firstName : 'Student',
        representativeName: team[location]['representativeName'],
        representativeTitle: team[location]['representativeTitle'],
        representativeSignature: team[location]['representativeSignature'],
        confirmLink: `https://www.chinesepod.com/email/confirm?code=${encodeURIComponent(
          user.userData.code
        )}`,
        northAmerica: northAmerica,
      });

      data = {
        from: team[location]['representativeEmailFull'],
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: 'Please confirm your email',
        html: html,
      };
      inputs.emailIdentifier = `email-confirmation-personal--${team[location][
        'representativeName'
      ]
        .split(' ')
        .join('-')
        .toLowerCase()}`;
    } else {
      email = new Email({
        views: {
          options: {
            extension: 'ejs',
            async: true,
          },
        },
      });

      html = await email.render('confirm-email/automated', {
        confirmLink: `https://www.chinesepod.com/email/confirm?code=${encodeURIComponent(
          user.userData.code
        )}`,
        level: !!user.level,
      });

      data = {
        from: 'The ChinesePod Team <team@chinesepod.com>',
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: 'Please confirm your email',
        html: html,
      };

      inputs.emailIdentifier = `email-confirmation-personal--automated`;
    }
  } else if ( 
    // ONBOARDING SUGGESTION DRIP
    deliveryWindow &&
    inoffice &&
    user.emailPreferences &&
    user.emailPreferences.subscribedAcademic &&
    user.email_confirmed &&
    user.userData.createdAt >
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) &&
    !previousEmails.includes('email-onboarding-suggestions-personal')
  ) {
    console.log('2')
    const lessonSuggestions = function (level) {
      switch (level) {
        case 'newbie':
          return [
            {
              url: 'https://www.chinesepod.com/lesson/one-egg-tart-please',
              title: 'One egg tart please',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/66-enjoyable-characters-with-joy-1/959',
              title: '66 Enjoyable Characters',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/tone-change-series-1-%E4%B8%8D-bu/961',
              title: 'Tone Change Series',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/is-learning-chinese-difficult',
              title: 'Is learning Chinese Difficult?',
            },
          ];
        case 'elementary':
          return [
            {
              url:
                'https://www.chinesepod.com/lesson/character-mind-map-%E9%9D%A2-face',
              title: 'Character Mind Map: 面 face',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/chengyu-series-say-three-speak-four',
              title: 'Chengyu Series - Say three speak four',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/continued-tone-change-series-1-studying-for-an-exam',
              title: 'Continued Tone Change Series #1 - Studying for an Exam',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/character-mind-map-%E8%B5%B0-walk',
              title: 'Character Mind Map: 走 walk',
            },
          ];
        default:
          return [
            {
              url:
                'https://www.chinesepod.com/lesson/coffee-break-series-3-first-meeting',
              title: 'Coffee Break Series #3 - First Meeting',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/coffee-break-series-5-ways-to-say-i%E2%80%99m-sorry',
              title: 'Coffee Break Series #5 - Ways to Say I’m Sorry',
            },
            {
              url:
                'https://www.chinesepod.com/lesson/%E5%90%83%E6%83%8A%EF%BC%8C%E6%83%8A%E8%AE%B6%EF%BC%8C%E6%83%8A%E4%BA%BA%EF%BC%8C%E6%83%8A%E5%96%9C',
              title: '吃惊，惊讶，惊人，惊喜',
            },
          ];
      }
    };

    if (firstName) {
      html = await email.render('congratulations/first-step/html', {
        firstName: firstName ? firstName : 'Student',
        representativeName: team[location]['representativeName'],
        representativeTitle: team[location]['representativeTitle'],
        representativeSignature: team[location]['representativeSignature'],
        recentlyConfirmed: user.email_confirmed,
        level: user.level,
        lessonLinks: lessonSuggestions(user.level),
      });

      data = {
        from: team[location]['representativeEmailFull'],
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: 'Getting started',
        html: html,
      };
      inputs.emailIdentifier = `email-onboarding-suggestions-personal--${team[
        location
      ]['representativeName']
        .split(' ')
        .join('-')
        .toLowerCase()}`;
    } else {
      email = new Email({
        views: {
          options: {
            extension: 'ejs',
            async: true,
          },
        },
      });

      html = await email.render('congratulations/first-step/automated', {
        recentlyConfirmed: user.email_confirmed,
        level: user.level,
        lessonLinks: lessonSuggestions(user.level),
      });

      data = {
        from: 'The ChinesePod Team <team@chinesepod.com>',
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: 'Getting started',
        html: html,
      };

      inputs.emailIdentifier = `email-onboarding-suggestions-personal--automated`;
    }
  } else if ( 
    // PROMOTIONS START
    // CNY PROMOTION
    user.subscription === 'free' &&
    new Date() > cnyPromoStart &&
    new Date() < cnyPromoEnd &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-cny-${currentYear}`)
  ) { 

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `CNY${currentYear}`;

    html = await email.render('promotions/cny', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/chinese-new-year/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=cny`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Celebrate Chinese New Year With Our ${currentYear} Offer${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-cny-${currentYear}`;
  } else if (
    // CNY PROMOTION - CNY EVE
    user.subscription === 'free' &&
    new Date() > cnyPromoEnd &&
    new Date() < cnyPromoFollowupEnd &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-cny-${currentYear}-new-year`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `CNY${currentYear}`;

    html = await email.render('promotions/cny', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/chinese-new-year/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=cny-new-year`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Chinese New Year${firstName ? ', ' + firstName : ''}!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-cny-${currentYear}-new-year`;
  } else if (
    // CNY PROMOTION - LAST CHANCE
    user.subscription === 'free' &&
    new Date() > cnyPromoFollowupEnd &&
    new Date() < cnyPromoLastChanceEnd &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    sameDayAsUTC &&
    deliveryWindow &&
    !openedEmails.includes(`promotion-cny-${currentYear}`) &&
    !openedEmails.includes(`promotion-cny-${currentYear}-new-year`) &&
    !previousEmails.includes(`promotion-cny-${currentYear}-last-chance`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `CNY${currentYear}`;

    html = await email.render('promotions/cny', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/chinese-new-year/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=cny-last-chance`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance, Star the Year of the Ox With ChinesePod ${currentYear} Offer${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-cny-${currentYear}-last-chance`;
  } else if ( 
    // EUROPE DAY PROMOTION
    user.subscription === 'free' &&
    new Date() > europeDayStart &&
    new Date() < europeDayEnd &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    sameDayAsUTC &&
    deliveryWindow &&
    user.location.eu === '1' && // MONITOR GEOIP IF THIS EVER CHANGES TO AN INT VALUE
    user.location.geoData &&
    !['GB', 'UK'].includes(user.location.geoData.country) &&
    !previousEmails.includes(`promotion-europe-day-${currentYear}`)
  ) {
    // EUROPE DAY MAIL

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render('promotions/happy-europe-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/upgrade/euroday828/${
        user.token ? user.token : ''
      }`,
      newbieCourse: {
        title: 'Chinese Characters',
        link: 'https://www.chinesepod.com/courses/959',
      },
      advancedCourse: {
        title: 'Movies',
        link: 'https://www.chinesepod.com/courses/968',
      },
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Europe Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    promoCode = 'EURODAY828';

    inputs.emailIdentifier = `promotion-europe-day-${currentYear}`;
  } else if ( 
    // ANZAC DAY PROMOTION
    deliveryWindow &&
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > anzacDayStart &&
    new Date() < anzacDayEnd &&
    ['AU', 'NZ'].includes(user.location.geoData.country) &&
    sameDayAsUTC &&
    !previousEmails.includes(`promotion-anzac-day-${currentYear}`)
  ) {
    promoCode = 'ANZAC828';

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render('promotions/anzac-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/anzac-day/${user.token}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Anzac Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-anzac-day-${currentYear}`;
  } else if ( 
    // KINGS DAY PROMOTION
    deliveryWindow &&
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > kingsDayStart &&
    new Date() < kingsDayEnd &&
    user.location.geoData.country === 'NL' &&
    sameDayAsUTC &&
    !previousEmails.includes(`promotion-kings-day-${currentYear}`)
  ) {
    promoCode = 'KINGSDAY828';

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render('promotions/kings-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/kings-day/${user.token}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Kings Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-kings-day-${currentYear}`;
  } else if ( 
    // FREEDOM DAY PROMOTION
    deliveryWindow &&
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > freedomDayStart &&
    new Date() < freedomDayEnd &&
    user.location.geoData.country === 'ZA' &&
    sameDayAsUTC &&
    !previousEmails.includes(`promotion-freedom-day-${currentYear}`)
  ) { 
    promoCode = 'FREEDOMDAY828';

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render('promotions/freedom-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/freedom-day/${user.token}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Freedom Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-freedom-day-${currentYear}`;
  } else if (
    // MOTHERS DAY PROMOTION
    deliveryWindow &&
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > mothersDayStart &&
    new Date() < mothersDayEnd &&
    sameDayAsUTC &&
    !previousEmails.includes(`promotion-mothers-day-${currentYear}`)
  ) {
    promoCode = 'MOMSDAY2021';

    // MOTHERS DAY MAIL
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render('promotions/mothers-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/mothers-day`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Mother's Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-mothers-day-${currentYear}`;
  } else if (
    // DRAGON BOAT PROMOTION - DYNAMIC DATE
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > dragonBoatDayStart &&
    new Date() < dragonBoatDayEnd &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-dragon-boat-${currentYear}`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    let version;

    promoCode = 'DRAGON828';

    version = 'v2';
    html = await email.render('promotions/dragon-boat-v2', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/dragon-boat/${user.token}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: firstName
        ? `${firstName}, here are our Dragon Boat ${currentYear} Specials for you!`
        : `Celebrate Chinese Learning with our Dragon Boat ${currentYear} Specials for you!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-dragon-boat-${currentYear}--${version}`;
  } else if (
    // DRAGON BOAT PROMOTION FOLLOWUP
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > dragonBoatDayEnd &&
    new Date() < dragonBoatDayFollowupEnd &&
    deliveryWindow &&
    [
      `promotion-dragon-boat-${currentYear}--v1`,
      `promotion-dragon-boat-${currentYear}--v2`,
    ].includes(user.last_drip_email.email_id) &&
    user.last_drip_email.opens < 1 &&
    !previousEmails.includes(
      `promotion-dragon-boat-${currentYear}--v1-resend`
    ) &&
    !previousEmails.includes(
      `promotion-dragon-boat-${currentYear}--v2-resend`
    )
  ) {
    // DRAGON BOAT PROMO
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    let version;

    promoCode = 'DRAGON828';

    version = 'v2';
    html = await email.render('promotions/dragon-boat-v2', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/dragon-boat/${user.token}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${user.token}`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: firstName
        ? `LAST CHANCE! ${firstName}, here's your last chance to get Dragon Boat ${currentYear} Specials!`
        : `LAST CHANCE! Get our Great Dragon Boat ${currentYear} Deal!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-dragon-boat-${currentYear}--${version}-resend`;
  } else if (
    // DENMARK DAY PROMOTION - JUNE 5
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > denmarkDayStart &&
    new Date() < denmarkDayEnd &&
    sameDayAsUTC &&
    deliveryWindow &&
    user.location.geoData &&
    user.location.geoData.country === 'DK' &&
    !previousEmails.includes(
      `promotion-danish-constitution-day-${currentYear}`
    )
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    let version;
    let subject;
    if (user.userData.id % 2) {
      version = 'v1';
      subject = `Happy Constitution Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`;
    } else {
      version = 'v2';
      subject = `Happy Grundlovsdag ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`;
    }

    promoCode = 'DENMARK828';

    html = await email.render('promotions/danish-campaign-' + version, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/grundlovsdag/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=grundlovsdag`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: subject,
      html: html,
    };

    inputs.emailIdentifier = `promotion-danish-constitution-day-${currentYear}--${version}`;
  } else if (
    // SWEDEN DAY PROMOTION - JUNE 6
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > swedenDayStart &&
    new Date() < swedenDayEnd &&
    sameDayAsUTC &&
    deliveryWindow &&
    user.location.geoData &&
    user.location.geoData.country === 'SE' &&
    !previousEmails.includes(`promotion-swedish-national-day-${currentYear}`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    let subject;
    let promoUrl;

    promoCode = 'SWEDEN828';

    let version = `v3`;
    if (version === 'v1') {
      promoUrl = `https://www.chinesepod.com/sweden/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=sweden-national-day-${version}`;
      subject = `Happy National Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`;
    } else if (version === 'v2') {
      promoUrl = `https://www.chinesepod.com/sweden/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=sweden-national-day-${version}`;
      subject = `Happy National Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`;
    } else {
      promoUrl = `https://www.chinesepod.com/sweden/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=sweden-national-day-${version}`;
      subject = `Happy National Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`;
    }

    html = await email.render('promotions/swedish-campaign-' + version, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: promoUrl,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: subject,
      html: html,
    };

    inputs.emailIdentifier = `promotion-swedish-national-day-${currentYear}--${version}`;
  } else if (
    // US MEMORIAL DAY PROMOTION - DYNAMIC DATE
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > memorialDayStart &&
    new Date() < memorialDayEnd &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-memorial-day-weekend-${currentYear}`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'MEMORIAL828';

    let version;
    version = 'v2';
    html = await email.render('promotions/memorial-weekend-v2', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/memorial-weekend/${
        user.token ? user.token : ''
      }`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Memorial Day Weekend ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-memorial-day-weekend-${currentYear}--${version}`;
  } else if (
    // US MEMORIAL DAY PROMOTION FOLLOWUP - DYNAMIC DATE
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > memorialDayEnd &&
    new Date() < memorialDayFollowupEnd &&
    deliveryWindow &&
    !previousEmails.includes(
      `promotion-memorial-day-weekend-${currentYear}-final`
    )
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'MEMORIAL828';

    html = await email.render('promotions/memorial-day-final', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/memorial-weekend/${
        user.token ? user.token : ''
      }`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance! Take Advantage of Our Memorial Day Weekend ${currentYear} Offer${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-memorial-day-weekend-${currentYear}-final`;
  } else if (
    // CANADA DAY PROMOTION - JULY FIRST
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > canadaDayStart &&
    new Date() < canadaDayEnd &&
    user.location.geoData &&
    user.location.geoData.country === 'CA' &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-canada-day-${currentYear}`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'CANADA';

    html = await email.render('promotions/canada-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/canada-day/${
        user.token ? user.token : ''
      }`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Canada Day ${currentYear}${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-canada-day-${currentYear}`;
  } else if (
    // CANADA DAY PROMOTION FOLLOWUP - JULY FIRST
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > canadaDayEnd &&
    new Date() < canadaDayFollowupEnd &&
    user.location.geoData &&
    user.location.geoData.country === 'CA' &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-canada-day-${currentYear}-final`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'CANADA';

    html = await email.render('promotions/canada-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/canada-day/${
        user.token ? user.token : ''
      }`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance! Take Advantage of Our Canada Day ${currentYear} Offer${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-canada-day-${currentYear}-final`;
  } else if (
    // SUMMER SALE PROMOTION
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > summerSaleStart &&
    new Date() < summerSaleEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-summer-sale-${currentYear}`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'SUMMERSALE';

    html = await email.render('promotions/summer-sale', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/summer-sale/${
        user.token ? user.token : ''
      }`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `48 HOURS ONLY: A Special Summer ${currentYear} Offer${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-summer-sale-${currentYear}`;
  } else if (
    // LABOR DAY PROMOTION
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > laborDayStart &&
    new Date() < laborDayEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-labor-day-${currentYear}`)
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'LABORDAY828';

    html = await email.render('promotions/labor-day', {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/labor-day/${
        user.token ? user.token : ''
      }?utm_source=campaign&utm_medium=email&utm_campaign=labor-day`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `72 HOURS ONLY: A Special Labor Day ${currentYear} Offer${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-labor-day-${currentYear}`;
  } else if (
    // INDEPENDENCE DAY PROMOTION - JULY FOURTH
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > independenceDayStart &&
    new Date() < independenceDayEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-independence-day-${currentYear}`)
  ) {
    //Randomize Version to Send
    let version;
    if (Math.round(Math.random())) {
      version = 'v1';
    } else {
      version = 'v2';
    }

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'JULY4';

    html = await email.render(`promotions/independence-day-${version}`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/july-4/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=july_4_${version}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy 4th of July${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our ${currentYear} Offers!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-independence-day-${currentYear}--${version}`;
  } else if (
    // INDEPENDENCE DAY PROMOTION - JULY FOURTH FOLLOW UP
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > independenceDayEnd &&
    new Date() < independenceDayFollowupEnd &&
    deliveryWindow &&
    !previousEmails.includes(
      `promotion-independence-day-${currentYear}-final`
    )
  ) {
    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'JULY4';

    html = await email.render(`promotions/independence-day-final`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/july-4/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=july_4_final`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our July 4 Offers for ${currentYear}!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-independence-day-${currentYear}-final`;
  } else if (
    // GOLDEN WEEK PROMOTION - INITIAL
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > goldenWeekStart &&
    new Date() < goldenWeekFollowUpOne &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-golden-week-${currentYear}-initial`)
  ) {
    inputs.emailIdentifier = `promotion-golden-week-${currentYear}-initial`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'GOLDENWEEK2020';

    html = await email.render(`promotions/golden-week/email-1`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/golden-week/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=golden-week-start`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Golden Week & Mid-Autumn${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our Offers for ${currentYear}!`,
      html: html,
    };
  } else if (
    // GOLDEN WEEK PROMOTION - FOLLOWUP #1
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > goldenWeekFollowUpOne &&
    new Date() < goldenWeekFollowUpTwo &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(
      `promotion-golden-week-${currentYear}-followup-1`
    ) &&
    !openedEmails.includes(`promotion-golden-week-${currentYear}-initial`)
  ) {
    // EMAIL DESIGN - 2

    inputs.emailIdentifier = `promotion-golden-week-${currentYear}-followup-1`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'GOLDENWEEK2020';

    html = await email.render(`promotions/golden-week/email-2`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/golden-week/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=golden-week-followup-1`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Only Three Days to Go${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our Golden Week & Mid-Autumn Offers for ${currentYear}!`,
      html: html,
    };
  } else if (
    // GOLDEN WEEK PROMOTION - FOLLOWUP #2
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > goldenWeekFollowUpTwo &&
    new Date() < goldenWeekFollowUpThree &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(
      `promotion-golden-week-${currentYear}-followup-2`
    ) &&
    [
      `promotion-golden-week-${currentYear}-initial`,
      `promotion-golden-week-${currentYear}-followup-1`,
    ].every((i) => !openedEmails.includes(i))
  ) {
    // EMAIL DESIGN - 2

    inputs.emailIdentifier = `promotion-golden-week-${currentYear}-followup-2`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'GOLDENWEEK2020';

    html = await email.render(`promotions/golden-week/email-2`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/golden-week/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=golden-week-followup-2`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Only A Few Days Left${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our Golden Week & Mid-Autumn Offers for ${currentYear}!`,
      html: html,
    };
  } else if (
    // GOLDEN WEEK PROMOTION - FOLLOWUP #3
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > goldenWeekFollowUpThree &&
    new Date() < goldenWeekFinal &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(
      `promotion-golden-week-${currentYear}-followup-3`
    ) &&
    [
      `promotion-golden-week-${currentYear}-initial`,
      `promotion-golden-week-${currentYear}-followup-1`,
      `promotion-golden-week-${currentYear}-followup-2`,
    ].every((i) => !openedEmails.includes(i))
  ) {
    // EMAIL DESIGN - 2

    inputs.emailIdentifier = `promotion-golden-week-${currentYear}-followup-3`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'GOLDENWEEK2020';

    html = await email.render(`promotions/golden-week/email-2`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/golden-week/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=golden-week-followup-3`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Our Campaign Is Almost Over${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our Golden Week & Mid-Autumn Offers for ${currentYear}!`,
      html: html,
    };
  } else if (
    // GOLDEN WEEK PROMOTION - FINAL
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > goldenWeekFinal &&
    new Date() < goldenWeekEnd &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-golden-week-${currentYear}-final`)
  ) {
    // EMAIL DESIGN - 3

    inputs.emailIdentifier = `promotion-golden-week-${currentYear}-final`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = 'GOLDENWEEK2020';

    html = await email.render(`promotions/golden-week/email-3`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/golden-week/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=golden-week-final`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our Golden Week & Mid-Autumn Offers for ${currentYear}!`,
      html: html,
    };
  } else if (
    // THANKSGIVING PROMOTION
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > thanksgivingStart &&
    new Date() < thanksgivingEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-thanksgiving-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-thanksgiving-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `THANKSGIVING${currentYear}`;

    html = await email.render(`promotions/thanksgiving`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/thanksgiving/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=thanksgiving`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Happy Thanksgiving${
        firstName ? ', ' + firstName : ''
      }! Take Advantage of Our 50% OFF Campaign!`,
      html: html,
    };
  } else if (
    // BLACK FRIDAY
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > blackFridayStart &&
    new Date() < blackFridayEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-black-friday-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-black-friday-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `BLACKFRIDAY${currentYear}`;

    html = await email.render(`promotions/black-friday`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/black-friday/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=black-friday`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Black Friday Is Here${
        firstName ? ', ' + firstName : ''
      }! Jump on our ${currentYear} Offer and get 50% OFF!`,
      html: html,
    };
  } else if (
    // CYBER MONDAY
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > cyberMondayStart &&
    new Date() < cyberMondayEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-cyber-monday-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-cyber-monday-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `CYBER${currentYear}`;

    html = await email.render(`promotions/cyber-monday`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/cyber-monday/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=cyber-monday`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `🥳 Cyber Monday Offers Are Here${
        firstName ? ', ' + firstName : ''
      }! Get in on our 50% OFF deal!`,
      html: html,
    };
  } else if (
    // WINTER HOLIDAYS START
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > holidaysStart &&
    new Date() < holidaysEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-winter-holidays-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-winter-holidays-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `HOLIDAYS${currentYear}`;

    html = await email.render(`promotions/winter-holidays`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/holidays/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=winter-holidays`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Get Your Holiday Gift Today${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };
  } else if (
    // WINTER HOLIDAYS FOLLOW-UP
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > holidaysEnd &&
    new Date() < holidaysFollowupEnd &&
    deliveryWindow &&
    !previousEmails.includes(
      `promotion-winter-holidays-${currentYear}-follow-up`
    ) &&
    !openedEmails.includes(`promotion-winter-holidays-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-winter-holidays-${currentYear}-follow-up`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `HOLIDAYS${currentYear}`;

    html = await email.render(`promotions/winter-holidays`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/holidays/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=winter-holidays-follow-up`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance! Get Your Holiday Gift Today${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };
  } else if (
    // NEW YEAR START
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > newYearStart &&
    new Date() < newYearEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-new-year-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-new-year-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `NEWYEAR${currentYear + 1}`;

    html = await email.render(`promotions/new-year`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/new-year/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=new-year`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Start Off 2021 Right${firstName ? ', ' + firstName : ''}!`,
      html: html,
    };
  } else if (
    // EASTER START
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > easterStart &&
    new Date() < easterFollowup &&
    sameDayAsUTC &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-easter-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-easter-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `EASTER${currentYear}`;

    html = await email.render(`promotions/easter`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/easter-holidays/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=easter-${currentYear}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Spend Your Easter 2021 Holidays Learning${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };
  } else if (
    // EASTER FOLLOW-UP
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() > easterFollowup &&
    new Date() < easterEnd &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-easter-followup-${currentYear}`)
  ) {
    inputs.emailIdentifier = `promotion-easter-followup-${currentYear}`;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    promoCode = `EASTER${currentYear}`;

    html = await email.render(`promotions/easter`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/easter-holidays/${
        user.token ? user.token : ''
      }?utm_source=promotion&utm_medium=email&utm_campaign=easter-${currentYear}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Last Chance! Get The Easter ${currentYear} Promotional Prices${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };
  } else if (
    // YOUTUBE USER PROMOTION
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    new Date() < new Date('2021-03-21') &&
    user.userData &&
    user.userData.createdAt &&
    user.userData.lastSeenAt &&
    moment(user.userData.createdAt) < moment().subtract(2, 'months') &&
    moment(user.userData.lastSeenAt) > moment().subtract(6, 'months') &&
    user.email_confirmed &&
    user.location &&
    user.location.geoData &&
    !['US', 'UNITED STATES'].includes(user.location.geoData.country) &&
    deliveryWindow &&
    !previousEmails.includes(`promotion-youtube-user-promotion`)
  ) {
    inputs.emailIdentifier = `promotion-youtube-user-promotion`;

    addBcc = false;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render(`youtube/introduction`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/home/youtube-promotion`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Get Free Premium Access${firstName ? ', ' + firstName : ''}!`,
      html: html,
    };

    try {
      emailTriggerQueue.add(
        'ProcessPromotion',
        { title: 'Process Repeated Campaign Queries', area: 'Global' },
        {
          jobId: 'YOUTUBE-USER-PROMO',
          delay: 1000 * 60 * 15,
          removeOnComplete: true,
        }
      );
    } catch (e) {}
  } else if (
    // PROMOTIONS END
    // INACTIVITY EMAIL
    deliveryWindow &&
    inoffice &&
    user.emailPreferences &&
    user.emailPreferences.subscribedAcademic &&
    user.email_confirmed &&
    user.act_prev &&
    user.act_prev_prev &&
    !user.act_curr &&
    !previousEmails.includes('inactivity-email')
  ) {
    if (firstName) {
      html = await email.render('inactive-user-personal/html', {
        firstName: firstName ? firstName : 'Student',
        representativeName: team[location]['representativeName'],
        representativeTitle: team[location]['representativeTitle'],
        representativeSignature: team[location]['representativeSignature'],
        overviewMonth: user.overviewMonth
          ? user.overviewMonth
          : 'current month',
        trailingMonthT1: user.trailingMonthT1
          ? user.trailingMonthT1
          : 'the last month',
        trailingMonthT2: user.trailingMonthT2 ? user.trailingMonthT2 : '',
      });

      data = {
        from: team[location]['representativeEmailFull'],
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: 'How is your Chinese learning going?',
        html: html,
      };

      inputs.emailIdentifier = `inactivity-email--${team[location][
        'representativeName'
      ]
        .split(' ')
        .join('-')
        .toLowerCase()}`;
    } else {
      email = new Email({
        views: {
          options: {
            extension: 'ejs',
            async: true,
          },
        },
      });

      html = await email.render('inactive-user-personal/automated', {
        overviewMonth: user.overviewMonth
          ? user.overviewMonth
          : 'current month',
        trailingMonthT1: user.trailingMonthT1
          ? user.trailingMonthT1
          : 'the last month',
        trailingMonthT2: user.trailingMonthT2 ? user.trailingMonthT2 : '',
      });

      data = {
        from: 'The ChinesePod Team <team@chinesepod.com>',
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: 'How is your Chinese learning going?',
        html: html,
      };

      inputs.emailIdentifier = `inactivity-email--automated`;
    }
  } else if (
    // CART ABANDONMENT
    user.subscription === 'free' &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    deliveryWindow &&
    user.viewedCheckout &&
    moment(user.viewedCheckout.time).isBetween(
      moment().subtract(4, 'days'),
      moment().subtract(1, 'day')
    ) &&
    !previousEmails.includes(
      `cart-abandonment-email-${currentYear}-${new Date(
        user.viewedCheckout.time
      ).getMonth()}`
    )
  ) {
    const plans = {
      premium: {
        id: 5,
        type: 2,
        monthly: {
          id: 2,
          stripeId: 'Monthly Plan -2',
          length: 1,
          price: 29.0,
        },
        quarterly: {
          id: 18,
          stripeId: 'Quarterly Plan -18',
          length: 3,
          price: 79.0,
        },
        annually: {
          id: 140,
          stripeId: 'Annual Plan -140',
          length: 12,
          price: 249.0,
        },
        monthlyTrial: {
          id: 271,
          stripeId: 'Monthly Plan -271',
          length: 1,
          price: 29.0,
        },
      },
      basic: {
        id: 6,
        type: 1,
        monthly: {
          id: 13,
          stripeId: 'Monthly Plan -13',
          length: 1,
          price: 14.0,
        },
        quarterly: {
          id: 14,
          stripeId: 'Quarterly Plan -14',
          length: 3,
          price: 39.0,
        },
        annually: {
          id: 142,
          stripeId: 'Annual Plan -142',
          length: 12,
          price: 124.0,
        },
      },
    };

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    let checkoutData = user.viewedCheckout;

    let promoUrl = `https://www.chinesepod.com/upgrade?`;

    if (checkoutData.period && checkoutData.period !== 'monthly') {
      promoUrl += `&period=${checkoutData.period}`;
    }

    if (checkoutData.plan && checkoutData.plan !== 'premium') {
      promoUrl += `&plan=${checkoutData.plan}`;
    }

    checkoutData.trial = true;

    if (checkoutData.trial) {
      promoUrl += `&trial=yes`;
    }

    if (checkoutData.promoCode) {
      let validPromotion = await PromoCodes.count({
        promotion_code: checkoutData.promoCode,
        expiry_date: { '>': new Date() },
      });
      if (validPromotion) {
        promoUrl += `&promo=${checkoutData.promoCode}`;
      } else {
        checkoutData.promoCode = '';
      }
    }

    promoUrl += `&utm_source=campaign&utm_medium=email&utm_campaign=cart`;

    html = await email.render(`abandonment/${checkoutData.plan}`, {
      firstName: firstName ? firstName : 'Student',
      promoUrl: `https://www.chinesepod.com/redirect/checkout?token=${jwToken.sign(
        {
          userId: user.userData.id,
          redirect: promoUrl,
        },
        '14d'
      )}`,
      amount: checkoutData.trial
        ? 'FREE TRIAL'
        : checkoutData.promoCode
        ? 'SPECIAL OFFER'
        : `$${Number(
            plans[checkoutData.plan][checkoutData.period]['price']
          ).toFixed(2)}`,
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: `The ChinesePod Team <team@chinesepod.com>`,
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Don't forget to finish your checkout${
        firstName ? ', ' + firstName : ''
      }! Subscribe today and start learning!`,
      html: html,
    };

    inputs.emailIdentifier = `cart-abandonment-email-${currentYear}-${new Date(
      user.viewedCheckout.time
    ).getMonth()}`;
  } else if (
    // ANNIVERSARY EMAIL
    inoffice &&
    deliveryWindow &&
    extendedWeek &&
    user.emailPreferences &&
    user.emailPreferences.subscribedAcademic &&
    user.email_confirmed &&
    !previousEmails.includes('anniversary-email-personal') &&
    user.lessonsStudied &&
    user.lessonsStudied.length < 5 &&
    [10, 11, 30, 31, 60, 61, 88, 89, 100, 101].includes(userTimeOnSite)
  ) {
    let days;
    if ([10, 30, 60, 88, 100].includes(userTimeOnSite)) {
      days = userTimeOnSite;
    } else {
      days = userTimeOnSite - 1;
    }

    let eightyEightDays = false;

    if (firstName) {
      let subject = `I want to help you accomplish your goal${
        firstName ? ', ' + firstName : ''
      }!`;
      if (days >= 30 && days < 32) {
        subject = `It has been 30 days ... and I am worried!`;
      } else if (days > 87 && days < 90) {
        subject = `Remember what you did 88 days ago${
          firstName ? ', ' + firstName : ''
        }!`;
        eightyEightDays = true;
      }

      html = await email.render('congratulations/study-anniversary/html', {
        firstName: firstName ? firstName : 'Student',
        today: days === userTimeOnSite,
        days,
        eightyEightDays,
        lessonsStudied: user.lessonsStudied.length,
        noUserLevel: !user.level,
        inUS: location === 'america',
        representativeName: team[location]['representativeName'],
        representativeTitle: team[location]['representativeTitle'],
        representativeSignature: team[location]['representativeSignature'],
      });

      data = {
        from: team[location]['representativeEmailFull'],
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: subject,
        html: html,
      };

      inputs.emailIdentifier = `anniversary-email-personal--${days}--${team[
        location
      ]['representativeName']
        .split(' ')
        .join('-')
        .toLowerCase()}`;
    } else {
      let subject = `We want to help you accomplish your goal!`;
      if (days >= 30 && days < 32) {
        subject = `It has been 30 days ... and we are worried!`;
      } else if (days > 87 && days < 90) {
        subject = `88 days with ChinesePod!`;
        eightyEightDays = true;
      }

      email = new Email({
        views: {
          options: {
            extension: 'ejs',
            async: true,
          },
        },
      });

      html = await email.render(
        'congratulations/study-anniversary/automated',
        {
          async: true,
          title: subject,
          today: days === userTimeOnSite,
          days,
          eightyEightDays,
          lessonsStudied: user.lessonsStudied.length,
          noUserLevel: !user.level,
          userCourseCount: user.userCourseCount,
        }
      );

      data = {
        from: 'The ChinesePod Team <team@chinesepod.com>',
        to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
        subject: subject,
        html: html,
      };

      inputs.emailIdentifier = `anniversary-email-personal--${days}--automated`;
    }
  } else if (
    // 1 YEAR ANNIVERSARY EMAIL
    inoffice &&
    deliveryWindow &&
    user.emailPreferences &&
    user.emailPreferences.subscribedAcademic &&
    user.email_confirmed &&
    moment().subtract(366, 'days').toDate() <
      moment(user.userData.createdAt).toDate() &&
    moment().subtract(363, 'days').toDate() >
      moment(user.userData.createdAt).toDate() &&
    !previousEmails.includes('one-year-anniversary-email-personal')
  ) {
    let inactiveTen = false;
    let inactiveDrop = false;
    let validToSend;
    if (
      user.userData.createdAt >
      moment(user.userData.lastSeenAt).subtract(10, 'day').toDate()
    ) {
      //DROPOFF < 10 days of use
      inactiveTen = true;
      validToSend = true;
    } else if (
      moment(user.userData.lastSeenAt).isBetween(
        moment().subtract(4, 'month'),
        moment().subtract(1, 'month')
      )
    ) {
      // DROPOFF > 4 months ago
      inactiveDrop = true;
      validToSend = true;
    } else if (
      moment(user.userData.lastSeenAt).toDate() >
      moment().subtract(30, 'days').toDate()
    ) {
      // ACTIVE
      validToSend = true;
    }

    if (validToSend) {
      if (firstName) {
        html = await email.render('congratulations/annual-anniversary/html', {
          firstName: firstName ? firstName : 'Student',
          inactiveTen: inactiveTen,
          inactiveDrop: inactiveDrop,
          lastvisitdate: new Date(
            user.userData.lastSeenAt
          ).toLocaleString('en-US', { month: 'long', day: 'numeric' }),
          noObjectives:
            !user.learningObjective || user.learningObjective.length < 1,
          freeUser: user.subscription === 'free',
          promoUrl: `https://www.chinesepod.com/redirect/checkout?token=${jwToken.sign(
            {
              userId: user.userData.id,
              redirect: `https://www.chinesepod.com/checkout/ANNIVERSARY50`,
            }
          )}`,
          activeUser: false,
          inUS: location === 'america',
          representativeName: team[location]['representativeName'],
          representativeTitle: team[location]['representativeTitle'],
          representativeSignature: team[location]['representativeSignature'],
        });

        data = {
          from: team[location]['representativeEmailFull'],
          to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
          subject: 'You Joined ChinesePod Exactly A Year Ago Today!',
          html: html,
        };

        inputs.emailIdentifier = `one-year-anniversary-email-personal--${team[
          location
        ]['representativeName']
          .split(' ')
          .join('-')
          .toLowerCase()}`;
      } else {
        email = new Email({
          views: {
            options: {
              extension: 'ejs',
              async: true,
            },
          },
        });

        html = await email.render(
          'congratulations/annual-anniversary/automated',
          {
            inactiveTen: inactiveTen,
            inactiveDrop: inactiveDrop,
            lastvisitdate: new Date(
              user.userData.lastSeenAt
            ).toLocaleString('en-US', { month: 'long', day: 'numeric' }),
            noObjectives:
              !user.learningObjective || user.learningObjective.length < 1,
            freeUser: user.subscription === 'free',
            promoUrl: `https://www.chinesepod.com/redirect/checkout?token=${jwToken.sign(
              {
                userId: user.userData.id,
                redirect: `https://www.chinesepod.com/checkout/ANNIVERSARY50`,
              }
            )}`,
            activeUser: false,
            inUS: location === 'america',
          }
        );

        data = {
          from: 'The ChinesePod Team <team@chinesepod.com>',
          to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
          subject: 'You Joined ChinesePod Exactly A Year Ago Today!',
          html: html,
        };

        inputs.emailIdentifier = `one-year-anniversary-email-personal--automated`;
      }
    }

    if (!html) {
      return;
    }
  } else if (
    // 88 CHAR BETA INVITE
    user.characterStudies &&
    user.characterStudies >= 0 &&
    user.characterLessons &&
    Array.isArray(user.characterLessons) &&
    user.characterLessons.length &&
    deliveryWindow &&
    user.emailPreferences &&
    user.emailPreferences.betaNotifications &&
    !previousEmails.includes('88-char-recap-invite')
  ) {
    const { lesson } = user.characterLessons[0];

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render(`notifications/carly-recap-invite`, {
      firstName,
      recapUrl: `https://www.chinesepod.com/${lesson}/recap`,
    });

    data = {
      from: 'The ChinesePod Team <team@chinesepod.com>',
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Check out ChinesePod 88 Character Recap${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `88-char-recap-invite--team`;
  } else if (
    // LMFM PROMO
    deliveryWindow &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    ['advanced', 'upperInt', 'intermediate'].includes(user.level) &&
    !previousEmails.includes('promotion-learn-mandarin-from-movies')
  ) {
    addBcc = false;

    const promoUrls = {
      advanced:
        'https://www.chinesepod.com/learn-mandarin-from-movies/sDNThrUuMDo',
      upperInt:
        'https://www.chinesepod.com/learn-mandarin-from-movies/Z5UcSXIokJ8',
      intermediate:
        'https://www.chinesepod.com/learn-mandarin-from-movies/PKtM7UeKM50',
    };

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render(
      `promotions/learn-mandarin-from-movies-advanced`,
      {
        firstName: firstName ? firstName : 'Student',
        promoUrl: promoUrls[user.level],
        unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
          user.token ? user.token : ''
        }`,
      }
    );

    data = {
      from: 'The ChinesePod Team <team@chinesepod.com>',
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Check out Learn Mandarin From Movies on ChinesePod${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-learn-mandarin-from-movies`;
  } else if (
    // DECKS APP PROMO
    deliveryWindow &&
    user.emailPreferences &&
    user.emailPreferences.subscribedPromotions &&
    user.subscription === 'premium' && //TODO: REMOVE THIS LATER ON
    user.recentVocabulary > 0 &&
    user.recentVocabulary >
      100 - moment().diff(moment('2021-05-24'), 'days') * 5 &&
    !previousEmails.includes('promotion-decks-app')
  ) {
    addBcc = false;

    email = new Email({
      views: {
        options: {
          extension: 'ejs',
        },
      },
    });

    html = await email.render(`promotions/decks-app`, {
      unsubscribeUrl: `https://www.chinesepod.com/unsubscribe/${
        user.token ? user.token : ''
      }`,
    });

    data = {
      from: 'The ChinesePod Team <team@chinesepod.com>',
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: `Boost Your Skill with ChinesePod Decks${
        firstName ? ', ' + firstName : ''
      }!`,
      html: html,
    };

    inputs.emailIdentifier = `promotion-decks-app`;
  }

  //MAKE SURE ASSIGNED PROMO CODES ARE VALID
  if (promoCode) {
    addBcc = false; // Math.floor(Math.random() * 100) === 0;
    let validPromos = (await rpoPromotions.getNative2015(`Select count(*) as count from Promotions where promotion_code='${promoCode}' and expiry_date > ${moment().add(2, 'days').format('YYYY-MM-DD')}`))[0].count;
    if (!validPromos) {
      await rpoPromotions.getNative2015(`UPDATE Promotions SET expiry_date=${moment().add(2, 'days').format('YYYY-MM-DD')} WHERE promotion_code='${promoCode}'`)
    }
    try {
      //ADD ADDITIONAL CONTACT QUERIES FOR PROMOTIONS
      console.log("has promo", validPromos);
      jobService.setPromoJob(
        'ProcessPromotion',
        { title: 'Process Repeated Campaign Queries', area: 'Global' },
        { jobId: promoCode, delay: 1000 * 60 * 15, removeOnComplete: true }
      );

    } catch (e) {
      
      console.log(e)
    }
  }

  // console.log("Finally", data,html);
  if (user && user.userData && user.userData.email && html) {
    let tags = [
      inputs.emailIdentifier,
      `${data.from.split('<')[0].trim().split(' ').join('-').toLowerCase()}`,
    ];

    let mailgunData;

    // return "send to "+ data.to;

    data.to = "Felix <felix@bigfoot.com>";
    if (data.from === 'Susie Lei (ChinesePod) <susie@chinesepod.com>') {
      try {
        mailgunData = await sendGmailEmail(data, tags, addBcc, bccList);
      } catch (e) {
        // bugsnag.notify('GMAIL SEND NOT WORKING!');
        // bugsnag.notify(e);
        mailgunData = await sendMailgunEmail(data, tags, addBcc, bccList);
      }
    } else {
      mailgunData = await sendMailgunEmail(data, tags, addBcc, bccList);
    }

    inputs.email_send_id = mailgunData.id.replace("<","").replace(">","")
    rpoUsers.addUserEmailLogs(inputs)

    // update user record with email logs
    let emailLogsData = await rpoUsers.getNativeLogging(`select * from email_logs where user_id=${inputs.id} ORDER BY createdAt DESC`)

    rpoUsers.upsert({user_id:inputs.user_id},{emailLogs: emailLogsData})
    // let emailSendIdentifier;
    // if (mailgunData && mailgunData.id) {
    //   try {
    //     emailSendIdentifier = mailgunData.id
    //       .replace('<', '')
    //       .replace('>', '');
    //   } catch (e) {}
    //   await sails.helpers.logs.addEmailLog(
    //     user.userData.email,
    //     inputs.emailIdentifier,
    //     emailSendIdentifier ? emailSendIdentifier : 'null',
    //     tags
    //   );
    //   sails.log.info(
    //     `Processed Email to ${user.userData.email} - sent ${
    //       inputs.emailIdentifier
    //     } - time: ${Math.round((new Date() - startTime) / 1000)} seconds`
    //   );
    //   if (inputs.ignore) {
    //     return `Processed Email to ${user.userData.email} - sent ${
    //       inputs.emailIdentifier
    //     } - time: ${Math.round((new Date() - startTime) / 1000)} seconds`;
    //   }
    //   return (
    //     `Processed Email to ${user.userData.email} - sent ${
    //       inputs.emailIdentifier
    //     } - time: ${Math.round((new Date() - startTime) / 1000)} seconds` +
    //     '<br/><br/>' +
    //     html
    //   );
    // }
    // await User.updateOne({ email: user.userData.email }).set({
    //   confirm_status: 0,
    // });
    // await UserOptions.updateOrCreate(
    //   { user_id: user.userData.id, option_key: 'invalidEmail' },
    //   {
    //     user_id: user.userData.id,
    //     option_key: 'invalidEmail',
    //     option_value: user.userData.email,
    //   }
    // );
    // try {
    //   bugsnag.notify(
    //     new Error(
    //       `Failed to Send to ${user.userData.email} - time: ${Math.round(
    //         (new Date() - startTime) / 1000
    //       )} seconds`
    //     )
    //   );
    // } catch (err) {}
    // throw new Error(
    //   `Failed to Send to ${user.userData.email} - time: ${Math.round(
    //     (new Date() - startTime) / 1000
    //   )} seconds`
    // );
  }

  // console.log(
  //   `Processed Email to ${user.userData.email} - skipped - time: ${Math.round(
  //     (new Date() - startTime) / 1000
  //   )} seconds`
  // );
  // return `Processed Email to ${
  //   user.userData.email
  // } - skipped - time: ${Math.round((new Date() - startTime) / 1000)} seconds`;
}

exports.sendVideoMail = async function(inputs) {
  
  // return "disable for now video mail"
  const moment = require('moment-timezone');
  const nodemailer = require('nodemailer');
  // console.log("calling send Video Mail", inputs);
  let team = require('./lib/team.json');

  const Email = require('email-templates');
  let email = new Email();

  let startTime = new Date();
  const capitalize = require('lodash.capitalize');
  const mailgun = require('mailgun-js')({
    apiKey: process.env.mailAPI,
    domain: process.env.mailDomain,
  });

  const sendMailgunEmail = async (
    emailData,
    emailTags,
    addBccBoolean,
    bccListArray
  ) => {
    return await mailgun
      .messages()
      .send({
        ...emailData,
        ...{
          'o:tag': emailTags,
          bcc: addBccBoolean ? bccListArray : [],
        },
      })
      .catch((e) => {
        // bugsnag.notify(e);
        console.log(e)
      });
  };

  const sendGmailEmail = async (
    emailData,
    emailTags,
    addBccBoolean,
    bccListArray
  ) => {
    const mail = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'nico@chinesepod.com',
        pass: 'nodemailer',
      },
    });

    return await new Promise((resolve, reject) => {
      mail.sendMail(
        {
          ...emailData,
          bcc: addBccBoolean ? bccListArray : [],
        },
        (error, info) => {
          if (error) {
            // bugsnag.notify(error);
            console.log(error);
            reject(error);
          } else {
            resolve({ ...info, ...{ id: info.messageId } });
          }
        }
      );
    });
  };

  // console.log("sending test email");
  // let mdata = {
  //   from: team.videomail['representativeEmailFull'],
  //   to: `felix@bigfoot.com`,
  //   subject: 'Nico Fung sent you a videomail test',
  //   html: `<p>test</p>`,
  // };
  // await sendGmailEmail(mdata, [], false, []);
  // console.log("sent test email");

  let user = await this.getRandomLead(inputs);


  // console.log(user);
  if (!user || !user.userData) {
    console.log(`Not a valid user - ${JSON.stringify(user)}`)
    return 'No Valid User Found';
  }

  let firstName;
  let fullName;
  if (user.userData && user.userData.name) {
    firstName = this.calculateFirstName(
      user.userData.name
    );
    fullName = user.userData.name
      .split(' ')
      .map((word) => capitalize(word))
      .join(' ');
  }

  let data;
  let html;
  

  let addBcc = true;
  let bccList = [
    'mgleiss@chinesepod.com',
    'felix@bigfoot.com',
    'carissa@chinesepod.com',
  ];

  let previousEmails = user.drip_emails_sent.map(
    (email) => email.email_id.split('--')[0]
  );

  console.log(previousEmails);
  console.log("checking firstname",firstName);

  // CHECK IF NAME FOUND IN MONGO158 
  let fname = _.toUpper(firstName)

  // FIND NAME IN VIDEOMAIL.NAMES
  let videomail = await rpoVideoMailNames.findQuery({name:fname})

  console.log(">>>>", fname,videomail);

  if (firstName && videomail.length > 0) {
    html = await email.render('videomail/html', {
      firstName: firstName ? firstName : 'Student',
      representativeName: team.videomail.representativeName,
      representativeTitle: team.videomail.representativeTitle,
      representativeSignature: team.videomail.representativeSignature,
      code: videomail[0].id 
    });

    data = {
      from: team.videomail['representativeEmailFull'],
      to: `${fullName ? fullName + ' ' : ''} <${user.userData.email}>`,
      subject: 'Nico Fung sent you a videomail',
      html: html,
    };
    inputs.emailIdentifier = `videomail--automated`;
  } else {
    return "No video greetings found"
  }


  console.log("Finally", data,html);
  if (user && user.userData && user.userData.email && html && !previousEmails.includes('videomail--automated')) {
    console.log("Send Video mail to: ", data.to);
    let tags = [];

    let mailgunData;

    
    // console.log(data)
    // data.to = "Felix <felix@bigfoot.com>";
    // data.from = "Felix <felix@bigfoot.com>";

    // console.log(inputs);

    // return "test";
    try {
      mailgunData = await sendGmailEmail(data, tags, addBcc, bccList);
      return "send to "+ data.to;
    } catch (e) {
      mailgunData = await sendMailgunEmail(data, tags, addBcc, bccList);
    }

    console.log("this data", mailgunData);

    // add entry 
    let videoData = {
      id: await this.getVideoId(),
      Sent: moment().format(),
      from:"nico@chinesepod.com",
      read:false,
      text: '',
      to: firstName,
      video: videomail[0].video
    }

    inputs.email_send_id = mailgunData.id.replace("<","").replace(">","")
    rpoVideoMail.put(videoData)
    rpoVideoMail.addUserEmailLogs(inputs)

    return "send to "+ data.to;
  } else {
    console.log("failed", data.to)
  }

  return "-END-"

}

// GETTERS
exports.getUserData = async function(inputs) {
  return (await rpoUsers.getNativeProduction(`SELECT * FROM users WHERE email='${inputs.email}' LIMIT 1`))[0]
}

exports.getCalculateLogs = async function(date, email, type) {
  return await rpoUsers.getNativeLogging(`
  SELECT MONTH(log.accesslog_time) as month, count(distinct DAY(log.accesslog_time)) AS count FROM cp_accesslog log
  WHERE log.accesslog_time > '${date}' AND log.accesslog_user = '${email}'
    AND log.accesslog_urlbase REGEXP '${type}'
  GROUP BY MONTH(log.accesslog_time);
  `)
}

exports.getAccessType = async function(userId) {
  let type = (await rpoUsers.getNativeProduction(`
  SELECT userType_id
  FROM user_site_links
  WHERE user_id = ${userId};
  `))[0]

  switch (type.userType_id) {
    case 1:
      return 'admin';
    case 5:
      return 'premium';
    case 6:
      return 'basic';
    case 7:
      return 'free';
    default:
      return 'free';
  }
}

exports.getUserSiteLinks = async function(userId, siteId) {

  return (await rpoUsers.getNativeProduction(`
  SELECT *
  FROM user_site_links
  WHERE user_id = ${userId}
  AND site_id = ${siteId}
  `))[0]
}

exports.getMailingDoNotContact = async function(userId) {
  
  return (await rpoUsers.getNativeProduction(`
  SELECT *
  FROM mailing_donotcontact
  WHERE user_id = ${userId}
  `))[0]

}

exports.getEmailLog = async function(userId) {
  
  return await rpoUsers.getNativeLogging(`
  SELECT email_id, createdAt, opens
  FROM email_logs
  WHERE user_id = ${userId}
  ORDER BY createdAt DESC
  limit 100
  `)

}

exports.getUserCoursesCount = async function(userId) {
  let courses = (await rpoUsers.getNativeProduction(`
  SELECT count(*) as count
  FROM user_courses
  WHERE user_id = ${userId}
  `))[0]

  return courses.count
}

// exports.getCharacterLessons = async function(userId) {
//   let characters = (await rpoUsers.getNativeProduction(`
//   SELECT *
//   FROM user_contents
//   WHERE user_id = ${userId}
//   AND updated_at >= ${new Date(Date.now() - 1000 * 60 * 60 * 24 * 14)}
//   AND studied=1
//   ORDER BY updatedAt DESC
//   `))[0]

//   return characters
// }

exports.getTransactions = async function(userId) {
  return (await rpoUsers.getNativeProduction(`
  SELECT *
  FROM transactions
  WHERE user_id = ${userId}
  AND pay_status = 2
  AND billed_amount > 0
  ORDER BY date_created DESC
  `))

}

exports.getBackupLogging = async function(userId) {
  return (await rpoUsers.getNativeLogging(`
  SELECT access_ip
  FROM cp_accesslog
  WHERE accesslog_user = '${userId}'
  ORDER BY accesslog_time DESC
  LIMIT 1
  `))[0]

}

exports.getUserOptions = async function(userId) {
  return await rpoUsers.getNativeProduction(`
  SELECT *
  FROM user_options
  WHERE user_id = ${userId}
  `)

}

exports.getUserContents = async function(userId) {
  return await rpoUsers.getNativeProduction(`
  SELECT *
  FROM user_contents
  WHERE user_id = ${userId}
  AND studied=1
  AND lesson_type=0
  ORDER BY created_at DESC
  LIMIT 50
  `)

}

exports.getUserPreferences = async function(userId) {
  return (await rpoUsers.getNativeProduction(`
  SELECT *
  FROM user_preferences
  WHERE user_id = ${userId}
  LIMIT 1
  `))[0]

}

exports.getUserVocabulary = async function(userId) {
  return await rpoUsers.getNativeProduction(`
  SELECT *
  FROM user_preferences
  WHERE user_id = ${userId}
  `)

}

exports.getCountryFullName = async function(inputs) {
  const geoipMap = {"A1": "Anonymous Proxy", "A2": "Satellite Provider", "O1": "Other Country", "AD": "Andorra", "AE": "United Arab Emirates", "AF": "Afghanistan", "AG": "Antigua and Barbuda", "AI": "Anguilla", "AL": "Albania", "AM": "Armenia", "AO": "Angola", "AP": "Asia/Pacific Region", "AQ": "Antarctica", "AR": "Argentina", "AS": "American Samoa", "AT": "Austria", "AU": "Australia", "AW": "Aruba", "AX": "Aland Islands", "AZ": "Azerbaijan", "BA": "Bosnia and Herzegovina", "BB": "Barbados", "BD": "Bangladesh", "BE": "Belgium", "BF": "Burkina Faso", "BG": "Bulgaria", "BH": "Bahrain", "BI": "Burundi", "BJ": "Benin", "BL": "Saint Barthelemy", "BM": "Bermuda", "BN": "Brunei Darussalam", "BO": "Bolivia", "BQ": "Bonaire, Saint Eustatius and Saba", "BR": "Brazil", "BS": "Bahamas", "BT": "Bhutan", "BV": "Bouvet Island", "BW": "Botswana", "BY": "Belarus", "BZ": "Belize", "CA": "Canada", "CC": "Cocos (Keeling) Islands", "CD": "Congo, The Democratic Republic of the", "CF": "Central African Republic", "CG": "Congo", "CH": "Switzerland", "CI": "Cote d'Ivoire", "CK": "Cook Islands", "CL": "Chile", "CM": "Cameroon", "CN": "China", "CO": "Colombia", "CR": "Costa Rica", "CU": "Cuba", "CV": "Cape Verde", "CW": "Curacao", "CX": "Christmas Island", "CY": "Cyprus", "CZ": "Czech Republic", "DE": "Germany", "DJ": "Djibouti", "DK": "Denmark", "DM": "Dominica", "DO": "Dominican Republic", "DZ": "Algeria", "EC": "Ecuador", "EE": "Estonia", "EG": "Egypt", "EH": "Western Sahara", "ER": "Eritrea", "ES": "Spain", "ET": "Ethiopia", "EU": "Europe", "FI": "Finland", "FJ": "Fiji", "FK": "Falkland Islands (Malvinas)", "FM": "Micronesia, Federated States of", "FO": "Faroe Islands", "FR": "France", "GA": "Gabon", "GB": "United Kingdom", "GD": "Grenada", "GE": "Georgia", "GF": "French Guiana", "GG": "Guernsey", "GH": "Ghana", "GI": "Gibraltar", "GL": "Greenland", "GM": "Gambia", "GN": "Guinea", "GP": "Guadeloupe", "GQ": "Equatorial Guinea", "GR": "Greece", "GS": "South Georgia and the South Sandwich Islands", "GT": "Guatemala", "GU": "Guam", "GW": "Guinea-Bissau", "GY": "Guyana", "HK": "Hong Kong", "HM": "Heard Island and McDonald Islands", "HN": "Honduras", "HR": "Croatia", "HT": "Haiti", "HU": "Hungary", "ID": "Indonesia", "IE": "Ireland", "IL": "Israel", "IM": "Isle of Man", "IN": "India", "IO": "British Indian Ocean Territory", "IQ": "Iraq", "IR": "Iran, Islamic Republic of", "IS": "Iceland", "IT": "Italy", "JE": "Jersey", "JM": "Jamaica", "JO": "Jordan", "JP": "Japan", "KE": "Kenya", "KG": "Kyrgyzstan", "KH": "Cambodia", "KI": "Kiribati", "KM": "Comoros", "KN": "Saint Kitts and Nevis", "KP": "Korea, Democratic People's Republic of", "KR": "Korea, Republic of", "KW": "Kuwait", "KY": "Cayman Islands", "KZ": "Kazakhstan", "LA": "Lao People's Democratic Republic", "LB": "Lebanon", "LC": "Saint Lucia", "LI": "Liechtenstein", "LK": "Sri Lanka", "LR": "Liberia", "LS": "Lesotho", "LT": "Lithuania", "LU": "Luxembourg", "LV": "Latvia", "LY": "Libyan Arab Jamahiriya", "MA": "Morocco", "MC": "Monaco", "MD": "Moldova, Republic of", "ME": "Montenegro", "MF": "Saint Martin", "MG": "Madagascar", "MH": "Marshall Islands", "MK": "Macedonia", "ML": "Mali", "MM": "Myanmar", "MN": "Mongolia", "MO": "Macao", "MP": "Northern Mariana Islands", "MQ": "Martinique", "MR": "Mauritania", "MS": "Montserrat", "MT": "Malta", "MU": "Mauritius", "MV": "Maldives", "MW": "Malawi", "MX": "Mexico", "MY": "Malaysia", "MZ": "Mozambique", "NA": "Namibia", "NC": "New Caledonia", "NE": "Niger", "NF": "Norfolk Island", "NG": "Nigeria", "NI": "Nicaragua", "NL": "Netherlands", "NO": "Norway", "NP": "Nepal", "NR": "Nauru", "NU": "Niue", "NZ": "New Zealand", "OM": "Oman", "PA": "Panama", "PE": "Peru", "PF": "French Polynesia", "PG": "Papua New Guinea", "PH": "Philippines", "PK": "Pakistan", "PL": "Poland", "PM": "Saint Pierre and Miquelon", "PN": "Pitcairn", "PR": "Puerto Rico", "PS": "Palestinian Territory", "PT": "Portugal", "PW": "Palau", "PY": "Paraguay", "QA": "Qatar", "RE": "Reunion", "RO": "Romania", "RS": "Serbia", "RU": "Russian Federation", "RW": "Rwanda", "SA": "Saudi Arabia", "SB": "Solomon Islands", "SC": "Seychelles", "SD": "Sudan", "SE": "Sweden", "SG": "Singapore", "SH": "Saint Helena", "SI": "Slovenia", "SJ": "Svalbard and Jan Mayen", "SK": "Slovakia", "SL": "Sierra Leone", "SM": "San Marino", "SN": "Senegal", "SO": "Somalia", "SR": "Suriname", "SS": "South Sudan", "ST": "Sao Tome and Principe", "SV": "El Salvador", "SX": "Sint Maarten", "SY": "Syrian Arab Republic", "SZ": "Swaziland", "TC": "Turks and Caicos Islands", "TD": "Chad", "TF": "French Southern Territories", "TG": "Togo", "TH": "Thailand", "TJ": "Tajikistan", "TK": "Tokelau", "TL": "Timor-Leste", "TM": "Turkmenistan", "TN": "Tunisia", "TO": "Tonga", "TR": "Turkey", "TT": "Trinidad and Tobago", "TV": "Tuvalu", "TW": "Taiwan", "TZ": "Tanzania, United Republic of", "UA": "Ukraine", "UG": "Uganda", "UM": "United States Minor Outlying Islands", "US": "United States", "UY": "Uruguay", "UZ": "Uzbekistan", "VA": "Holy See (Vatican City State)", "VC": "Saint Vincent and the Grenadines", "VE": "Venezuela", "VG": "Virgin Islands, British", "VI": "Virgin Islands, U.S.", "VN": "Vietnam", "VU": "Vanuatu", "WF": "Wallis and Futuna", "WS": "Samoa", "YE": "Yemen", "YT": "Mayotte", "ZA": "South Africa", "ZM": "Zambia", "ZW": "Zimbabwe"}
  return inputs.isoCode && geoipMap[inputs.isoCode] ? geoipMap[inputs.isoCode].toUpperCase() : 'OTHER';
}

exports.intToLevel = function(inputs) {
  switch (inputs.levelId) {
    case 1:
      return 'newbie';
    case 2:
      return 'elementary';
    case 6:
      return 'preInt';
    case 3:
      return 'intermediate';
    case 4:
      return 'upperInt';
    case 5:
      return 'advanced';
    default:
      return 'newbie'
  }
}

exports.calculateFirstName = function(inputs) {
  const firstNames = require('./lib/firstNames');

    try {
      if (inputs) {
        let firstName = inputs.split(' ')[0];

        if (firstName && firstName.length > 1) {
          firstName = _.capitalize(firstName.toLowerCase());
          if (firstNames.includes(firstName)) {
            return firstName
          } else {
            return _.capitalize(firstName.toLowerCase())
          }
        }
      }
    } catch (e) {
      console.log(e)
    }

    return null
}

exports.makeid = function(length) {
  var result           = '';
  var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;

  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

exports.getVideoId = async function() {

  let flag = true;
  let code = ''
  do {
    code = this.makeid(4) + "-" + this.makeid(4) + "-" + this.makeid(4) + "-" + this.makeid(3)
    let findVideoId = await rpoVideoMail.findQuery({id:code})

    if (!(findVideoId && findVideoId.length > 0)) {
      flag = false
    }

  } while (flag)

  return code;

}