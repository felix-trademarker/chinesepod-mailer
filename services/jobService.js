
let rpoUsers = require('../repositories/users')
let helpers = require('../helpers')

let Queue = require('bull');

let cleanupQueue = new Queue('CleanupQueue', process.env.url);
let userEmailQueue = new Queue('UserEmailQueue', process.env.url);
let emailTriggerQueue = new Queue('EmailTriggerQueue',process.env.url);

// temp function to be remove later
exports.jobs = async function() {

    
    // Queue.clean()
    //               //
    // LOGGING QUEUE //
    //               //
    
    //TODO: REMOVE THIS TMP CHANGE
    // userEmailQueue.clean(1000, 'delayed');
    // userEmailQueue.clean(1000);
    // userEmailQueue.clean(1000, 'delayed');
    // userEmailQueue.clean(1000, 'failed');

    // cleanupQueue.process(async (job) => { 
    //     console.log("CLEAN UP", job.id)
    //     const userEmailJob = await userEmailQueue.getJob(job.id);
    //     if (!userEmailJob) {
    //     return;
    //     }
    //     userEmailJob.remove();
    // });

    // userEmailQueue.on('completed', (job, result) => {
    //     cleanupQueue.add(job, {
    //     jobId: job.id,
    //     // delete job after 23 hours
    //     delay: 1000 * 60 * 60 * 23,
    //     removeOnComplete: true,
    //     });

    //     console.log("complete",result);
    // });

    // userEmailQueue.on('failed', (job, result) => { console.log(3)
    //     cleanupQueue.add(job, {
    //     jobId: job.id,
    //     // delete job after 3 hours
    //     delay: 1000 * 60 * 60 * 23,
    //     removeOnComplete: true,
    //     });

    //     console.log("failed",result);
    // });

    // userEmailQueue.process(
    //     'SendEmailToSelectedLead',
    //     1,
    //     async function (job) { console.log(4)
    //     return await helpers.sendEmailToSelectedLead(
    //         job.data.email
    //     );
    //     }
    // );

    // userEmailQueue.process(
    //     'SendEmailToRandomLead',
    //     1,
    //     async function (job) { console.log(5)
    //     return await helpers.sendEmailRandomLeads(
    //         job.data.email,
    //         true
    //     );
    //     }
    // );

    // global.userEmailQueue = userEmailQueue;

    
    emailTriggerQueue.clean(50000);
    // emailTriggerQueue.clean(1000, 'delayed');
    // emailTriggerQueue.clean(1000, 'failed');

    emailTriggerQueue.on('failed', (job, result) => {
        cleanupQueue.add(job, {
        jobId: job.id,
        // delete job after 3 hours
        delay: 1000 * 60 * 60 * 23,
        removeOnComplete: true,
        });

        console.log("failed",result);
    });

    emailTriggerQueue.on('completed', (job, result) => {
        cleanupQueue.add(job, {
        jobId: job.id,
        // delete job after 23 hours
        delay: 1000 * 60 * 60 * 23,
        removeOnComplete: true,
        });

        console.log("complete video mail: ",result);
    });

    // CALLED ADD IN HELPERS LINE 3092
    // emailTriggerQueue.process('ProcessPromotion', 1, async function (job) {
    //     console.log('ProcessPromotion');
    //     const pickTime = () => {
    //     let now = new Date();
    //     let hour = now.getHours();
    //     return [60 * 9 - 60 * hour, 60 * 18 - 60 * hour];
    //     };

    //     let targetTime = pickTime();
    //     if (!targetTime) {
    //     return await new Promise((resolve) => {
    //         setTimeout(() => {
    //         resolve();
    //         }, 1000);
    //     });
    //     }

    //     // console.log(targetTime)
    //     let targetUsers =
    //     await rpoUsers.getNativeProduction(`
    //     SELECT id, email FROM users
    //     WHERE (created_at > '2014-05-01' or updated_at > '2014-05-01')
    //     AND created_at < '${new Date(
    //         Date.now() - 1000 * 60 * 60
    //     ).toISOString()}'
    //     AND email NOT LIKE '%@chinesepod.com'
    //     AND email NOT LIKE '%@sexymandarin.com'
    //     AND id NOT IN (SELECT user_id FROM sz_org_staff)
    //     AND id NOT IN (SELECT user_id FROM sz_students)
    //     AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
    //         Date.now() - 24 * 60 * 60 * 1000
    //     ).toISOString()}')
    //     AND id NOT IN (SELECT user_id FROM user_site_links WHERE usertype_id in (5, 6) and site_id = 2)
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key in ('invalidEmail', 'sign_up_website'))
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value < ${
    //         targetTime[0]
    //     })
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value > ${
    //         targetTime[1]
    //     })
    //     AND id NOT IN (select user_id from mailing_donotcontact)
    //     ORDER BY RAND()
    //     LIMIT 30000
    //     `);

    //     // console.log(targetUsers)
    //     targetUsers.forEach((user) => {
    //     try {
    //         userEmailQueue.add(
    //         'SendEmailToRandomLead',
    //         { email: user, ignore: true },
    //         {
    //             jobId: `UserEmailQueue-${user.email}`,
    //             timeout: 120000,
    //         }
    //         );
    //     } catch (e) {
    //         // sails.log.error(e);
    //     }
    //     });
    // });

    // emailTriggerQueue.process('ProcessOneOffPromotion', 1, async function (job) {
    //         console.log("processOneOffPromotion");
    //     let targetUsers = 
    //         await rpoUsers.getNativeProduction(`
    //     SELECT id, email FROM users
    //     WHERE (created_at > '2014-05-01' or updated_at > '2014-05-01')
    //     AND updated_at < '2017-01-01'
    //     AND email NOT LIKE '%@chinesepod.com'
    //     AND email NOT LIKE '%@sexymandarin.com'
    //     AND id NOT IN (SELECT user_id FROM sz_org_staff)
    //     AND id NOT IN (SELECT user_id FROM sz_students)
    //     AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
    //         Date.now() - 24 * 60 * 60 * 1000
    //     ).toISOString()}')
    //     AND id NOT IN (SELECT user_id FROM user_site_links WHERE usertype_id in (5, 6) and site_id = 2)
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key in ('invalidEmail', 'sign_up_website'))
    //     AND id NOT IN (select user_id from mailing_donotcontact)
    //     ORDER BY RAND()
    //     LIMIT 50000
    //     `);

    //     // targetUsers.forEach((user) => {
    //     //     try {
    //     //     userEmailQueue.add(
    //     //         'SendEmailToRandomLead',
    //     //         { email: user.email, ignore: true },
    //     //         {
    //     //         jobId: `UserEmailQueue-${user.email}`,
    //     //         timeout: 120000,
    //     //         }
    //     //     );
    //     //     } catch (e) {
    //     //         console.log(e)
    //     //     }
    //     // });
    //     }
    // );

    // emailTriggerQueue.process('ProcessPromotionHasPaid', 1, async function (job) { console.log("ProcessPromotionHasPaid");
    //     const pickTime = () => {
    //         let now = new Date();
    //         let hour = now.getHours();
    //         return [60 * 9 - 60 * hour, 60 * 18 - 60 * hour];
    //     };

    //     let targetTime = pickTime();
    //     if (!targetTime) {
    //         return await new Promise((resolve) => {
    //         setTimeout(() => {
    //             resolve();
    //         }, 1000);
    //         });
    //     }
    //     let targetUsers = 
    //         await rpoUsers.getNativeProduction(`
    //     SELECT id, email FROM users
    //     WHERE id IN (SELECT distinct user_id from transactions where date_created > '2010-01-01' and pay_status = 2)
    //     AND confirm_status = 1
    //     AND created_at < '${new Date(
    //         Date.now() - 1000 * 60 * 60
    //     ).toISOString()}'
    //     AND email NOT LIKE '%@chinesepod.com'
    //     AND email NOT LIKE '%@sexymandarin.com'
    //     AND id NOT IN (SELECT user_id FROM sz_org_staff)
    //     AND id NOT IN (SELECT user_id FROM sz_students)
    //     AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
    //         Date.now() - 72 * 60 * 60 * 1000
    //     ).toISOString()}')
    //     AND id NOT IN (SELECT user_id FROM user_site_links WHERE usertype_id in (5, 6) and site_id = 2)
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key in ('invalidEmail', 'sign_up_website'))
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value < ${
    //         targetTime[0]
    //     })
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value > ${
    //         targetTime[1]
    //     })
    //     AND id NOT IN (select user_id from mailing_donotcontact)
    //     ORDER BY RAND()
    //     LIMIT 5000
    //     `);

    //     // targetUsers.forEach((user) => {
    //     //     try {
    //     //     userEmailQueue.add(
    //     //         'SendEmailToRandomLead',
    //     //         { email: user.email, ignore: true },
    //     //         {
    //     //         jobId: `UserEmailQueue-${user.email}`,
    //     //         timeout: 120000,
    //     //         }
    //     //     );
    //     //     } catch (e) {
    //     //     console.log(e)
    //     //     }
    //     // });
    //     }
    // );

    // CONVERTED - FELIX
    // emailTriggerQueue.process( 'ProcessRandomContact', 1, async function (job) {

    //     console.log("ProcessRandomContact");
    //     const pickTime = () => {
    //         let now = new Date();
    //         let hour = now.getHours();
    //         return [60 * 9 - 60 * hour, 60 * 18 - 60 * hour];
    //     };

    //     // console.log(pickTime)

    //     let targetTime = pickTime();
    //     if (!targetTime) {
    //         return;
    //     }
    //     // console.log(targetTime);
    //     let targetUsers =
    //         await rpoUsers.getNativeProduction(`
    //     SELECT id, email FROM users
    //     WHERE email NOT LIKE '%@chinesepod.com'
    //     AND email NOT LIKE '%@sexymandarin.com'
    //     AND updated_at > '${new Date(
    //         Date.now() - 1000 * 60 * 60 * 24 * 540
    //     ).toISOString()}'
    //     AND created_at < '${new Date(
    //         Date.now() - 1000 * 60 * 60
    //     ).toISOString()}'
    //     AND id NOT IN (SELECT user_id FROM sz_org_staff)
    //     AND id NOT IN (SELECT user_id FROM sz_students)
    //     AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
    //         Date.now() - 3 * 24 * 60 * 60 * 1000
    //     ).toISOString()}')
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'emailReviewLogic' and last_update > '${new Date(
    //         Date.now() - 3 * 60 * 60 * 1000
    //     ).toISOString()}')
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value < ${
    //         targetTime[0]
    //     })
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key = 'tzOffset' and option_value > ${
    //         targetTime[1]
    //     })
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key in ('invalidEmail', 'sign_up_website'))
    //     AND id NOT IN (select user_id from mailing_donotcontact)
    //     ORDER BY RAND()
    //     LIMIT 5000
    //     `);

    //     targetUsers.forEach((user) => {
    //         try {
    //         userEmailQueue.add(
    //             'SendEmailToRandomLead',
    //             { email: user, ignore: true },
    //             {
    //             jobId: `UserEmailQueue-${user.email}`,
    //             timeout: 120000,
    //             }
    //         );
    //         } catch (e) {
    //             console.log(e)
    //         }
    //     });


    //     }
    // );

    // emailTriggerQueue.process('ProcessPromotionWithTargets', 1, async function (job) { 
        
    //     console.log("ProcessPromotionWithTargets");
    //     if (!job.data || !job.data.area) {
    //         throw new Error('Missing Area Data');
    //     }
    //     let targetUsers = 
    //         await rpoUsers.getNativeProduction(`
    //     SELECT id, email FROM users
    //     WHERE email NOT LIKE '%@chinesepod.com'
    //     AND email NOT LIKE '%@sexymandarin.com'
    //     AND id NOT IN (SELECT user_id FROM sz_org_staff)
    //     AND id NOT IN (SELECT user_id FROM sz_students)
    //     AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
    //         Date.now() - 24 * 60 * 60 * 1000
    //     ).toISOString()}')
    //     AND created_at < '${new Date(
    //         Date.now() - 1000 * 60 * 60
    //     ).toISOString()}'
    //     AND id IN (SELECT user_id FROM user_options WHERE option_key = 'timezone' AND option_value like '${
    //         job.data.area
    //     }%')
    //     AND id NOT IN (SELECT user_id FROM user_options WHERE option_key in ('invalidEmail', 'sign_up_website'))
    //     AND id NOT IN (select user_id from mailing_donotcontact)
    //     ORDER BY RAND()
    //     LIMIT 5000
    //     `);

    //     // targetUsers.forEach((user) => {
    //     //     try {
    //     //     userEmailQueue.add(
    //     //         'SendEmailToRandomLead',
    //     //         { email: user.email, ignore: true },
    //     //         {
    //     //         jobId: `UserEmailQueue-${user.email}`,
    //     //         timeout: 120000,
    //     //         }
    //     //     );
    //     //     } catch (e) {
    //     //     console.log(e)
    //     //     }
    //     // });
    //     }
    // );

    // NEW ADDED MAILER
    emailTriggerQueue.process( 'SendVideoMail', 1, async function (job) { 
        
        console.log("SendVideoMail");
        if (!job.data) {
            throw new Error('Missing Area Data');
        }
        let targetUsers = 
            (await rpoUsers.getNativeProduction(`
        SELECT id, email FROM users
        WHERE email NOT LIKE '%@chinesepod.com'
        AND email NOT LIKE '%@sexymandarin.com'
        AND created_at > '${new Date(
            Date.now() - (24 * 60 * 60 * 1000) * 10
        ).toISOString()}'
        AND id NOT IN (SELECT user_id FROM sz_org_staff)
        AND id NOT IN (SELECT user_id FROM sz_students)
        AND id NOT IN (select distinct user_id from chinesepod_logging.email_logs where createdAt > '${new Date(
            Date.now() - 24 * 60 * 60 * 1000
        ).toISOString()}')
        AND created_at < '${new Date(
            Date.now() - 1000 * 60 * 60
        ).toISOString()}'
        
        AND id NOT IN (SELECT user_id FROM user_options WHERE option_key in ('invalidEmail', 'sign_up_website'))
        AND id NOT IN (select user_id from mailing_donotcontact)
        ORDER BY RAND()
        LIMIT 1
        `))[0];

        // console.log(targetUsers);

        helpers.sendVideoMail(targetUsers)

        // targetUsers.forEach((user) => {
        //     try {
        //     userEmailQueue.add(
        //         'SendEmailToRandomLead',
        //         { email: user.email, ignore: true },
        //         {
        //         jobId: `UserEmailQueue-${user.email}`,
        //         timeout: 120000,
        //         }
        //     );
        //     } catch (e) {
        //     console.log(e)
        //     }
        // });
        }
    );

    // ACTIVE CRON JOB -- CALLED HELPERS !disabled main app still running
    // emailTriggerQueue.add(
    //     'ProcessRandomContact',
    //     { data: 'Check users every 15 min' },
    //     { repeat: { cron: '0,15,30,45 * * * *' } }
    // );

    emailTriggerQueue.add(
        'SendVideoMail',
        { data: 'Check users every 15 min' },
        { repeat: { cron: '* * * * *' } }
    );

    // // CAMPAIGN TRIGGERS
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Denmark', area: 'Europe/Copenhagen' },
    //     { repeat: { cron: '0 8 5 6 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Sweden', area: 'Europe/Stockholm' },
    //     { repeat: { cron: '0 8 6 6 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Canada', area: 'America/Toronto' },
    //     { repeat: { cron: '5 13 1 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Canada', area: 'America/Edmonton' },
    //     { repeat: { cron: '5 15 1 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Canada', area: 'America/Vancouver' },
    //     { repeat: { cron: '5 16 1 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Independence Day', area: 'America/' },
    //     { repeat: { cron: '5 15 3 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Independence Day', area: 'Australia/' },
    //     { repeat: { cron: '5 2 4 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Independence Day', area: 'Pacific/' },
    //     { repeat: { cron: '5 0 4 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Independence Day', area: 'Asia/' },
    //     { repeat: { cron: '5 4 4 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Independence Day', area: 'Europe/' },
    //     { repeat: { cron: '5 12 4 7 *' } }
    // );
    // emailTriggerQueue.add(
    //     'ProcessPromotionWithTargets',
    //     { title: 'Process Campaign - Independence Day', area: 'Africa/' },
    //     { repeat: { cron: '5 12 4 7 *' } }
    // );

    // global.emailTriggerQueue = emailTriggerQueue;

    // done();
}

exports.setPromoJob = async function(type,data,job) {
    emailTriggerQueue.add(type,data,job);
}



