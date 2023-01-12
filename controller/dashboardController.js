let rpoTopics = require('../repositories/topics');
let rpoSubTopics = require('../repositories/subTopics');
let rpoComments = require('../repositories/comments');
let rpoUsers = require('../repositories/users');

let mailService = require('../services/mailService')
let activityService = require('../services/activityLogService')

var path = require('path')
const { toInteger } = require('lodash'); 

let helpers = require('../helpers');

let variables = require("../config/variables")

// FOR
let rpoContents = require('../repositories/mysql/_contents');
let rpoCourseContents = require('../repositories/mysql/_course_contents');
let rpoCourseDetail = require('../repositories/mysql/_course_detail');
// let rpoVocabulary = require('../repositories/mysql/_vocabulary');



exports.landing = async function(req, res, next) {

  activityService.logger(req, "Visited Beta Page");

  let topics = await rpoTopics.get();
  let selectedTopic = req.params.id

  let userData = await helpers.getLoginUser(req)


  for(let i=0; i < topics.length; i++) {
    let listSubTopics = await rpoSubTopics.findQuery({ parentName: topics[i].name })
    topics[i].sub = listSubTopics
    
    if (i == 0 && !selectedTopic) {
      selectedTopic = topics[i].sub[0]._id
    }

  }

  res.render('dashboard/', { 
    title: '',
    description: '',
    keywords: '',
    selectedTopic: selectedTopic,
    topics: topics,
    userData: userData
  });

}

exports.forum = async function(req, res, next) {

  activityService.logger(req, "Visited Forum Page");

  let topics;
  let subTopics;
  let userData;
  let isBetaTester;
  let latestComments;

  try{

  topics = await rpoTopics.get();
  subTopics = await rpoSubTopics.getLatestTopics();
  userData = await helpers.getLoginUser(req)
  isBetaTester = await helpers.isBetaTester(req)
  latestComments = await rpoComments.getLatestComments()

  } catch(err) {
    console.log(err)
  }

  console.log("=== topics", topics ? true : false)
  console.log("=== subTopics", subTopics ? true : false)
  console.log("=== userData", userData ? true : false)
  console.log("=== isBetaTester", isBetaTester ? true : false)
  console.log("=== latestComments", latestComments ? true : false)

  res.render('dashboard/forum', { 
    title: '',
    description: '',
    keywords: '',
    topics: topics,
    subTopics: subTopics,
    userData: userData,
    latestComments: latestComments,
    isBetaTester: isBetaTester
  });

}


exports.addSubTopicsClient = async function(req, res, next) {

  let userData = await helpers.getLoginUser(req)

  


  if (req.body && req.body.name) {
    let data = req.body

    activityService.logger(req, "Add Topics "+req.body.name);

    let findDuplicate = await rpoTopics.findQuery({name:req.body.name})

    if (findDuplicate && findDuplicate.length > 0) {
      data.topic_id = findDuplicate[0]._id
    }

    data.userData = userData

    // check if it has image attached
    let attachments = []
    console.log(req.files);
    if (req.files && req.files.topicImage) {
      for(let cnt=0; cnt < req.files.topicImage.length; cnt++) {
        var file = req.files.topicImage[cnt]
        var extName = path.extname(file.name)
        var filename = toInteger(req.app.locals.moment().format('YYMMDDHHMMSS')) + '-' + cnt + extName;
        filename = filename.toLowerCase()
        uploadPath = __dirname + '/../public/beta/uploads/comments/'+filename;
        file.mv(uploadPath, function(err) {
          console.log(err);
        });
        attachments.push({
          file: filename,
          ext: extName
        })
      }
      
    }

    data.attachments = attachments;
    // add date created
    data.created_at = req.app.locals.moment().format()
    console.log("add flash message");
    res.flash('success', 'Added successfully! Topic has been sent to admin for approval');
    await rpoSubTopics.put(data)

    let name = userData.name.trim().replace(","," ")
    let fname = name.split(" ")
    let firstName = fname.length > 0 ? fname[0] : userData.username;

    // send email notification
    let mailData = {
      subject: "New Topic Submission",
      to: userData.email,
      message: `
        <h3 style="margin-bottom:30px;">Hi ${firstName},</h3>

        <p>Thank you for submitting a topic, topic submitted has been sent to ChinesePod Beta Team for approval.</p>


        <br>
        <p>Sincerely,<br>ChinesePod Team</p>
      `
    }
    mailService.basicSend(mailData)

    let mailDataAdmin = {
      subject: mailData.subject + " From " + userData.username,
      to: "beta@chinesepod.com",
      message: `
        <h3 style="margin-bottom:30px;">Hi Admin,</h3>

        <p>A new topic has been submitted for approval</p>
        <p>Category: ${data.parentName}<br>
        Topic: ${data.name}<br>
        Author: ${userData.username}
        </p>

        <p>Admin Topic <a href="https://www.chinesepod.com/beta/admin-dashboard/topics/edit/${data._id}">link</a></p>


        <br>
        <p>Sincerely,<br>ChinesePod Team</p>
      `
    }

    mailService.defaultSend(mailDataAdmin)

  }

  res.redirect('/beta/forums')
     
}

exports.deleteTopicClient = async function(req, res, next) {
  console.log(req.params.id)

  // let topic = await rpoSubTopics.remove(req.params.id)
  if (!req.params.id) {
    res.redirect('/beta/forums')
  }

  let data = {
    status: 'draft',
    deleted_at: req.app.locals.moment().format()
  }

  await rpoSubTopics.update(req.params.id, data)

  res.flash('success', 'Topic Deleted');
  res.redirect('/beta/forums')

}

exports.editTopicClient = async function(req, res, next) {
  console.log(req.params.id)

  // let topic = await rpoSubTopics.remove(req.params.id)
  if (!req.params.id) {
    res.redirect('/beta/forums')
  }

  let topicId = req.params.id
  let topics = await rpoSubTopics.find(topicId);

  if (!topics) res.redirect('/beta/forums') 

  if (req.body && req.body.name) {
    // update
    await rpoSubTopics.update(topicId,req.body);

    res.flash('success', 'Topic Updated');
    res.redirect('/beta/forums')
  }

  res.render('dashboard/edit-forum', { 
    title: '',
    description: '',
    keywords: '',
    topic: topics[0],
  });

}

exports.forumPage = async function(req, res, next) {

  let topics = await rpoTopics.get();
  let selectedTopic = req.params.id
  let selectedTopicName=""

  let userData = await helpers.getLoginUser(req)
  let isBetaTester = userData && userData.isBetaTester ? true : false;

  for(let i=0; i < topics.length; i++) {
    let listSubTopics = await rpoSubTopics.findQuery({ parentName: topics[i].name })
    topics[i].sub = listSubTopics
    
    if (i == 0 && !selectedTopic) {
      selectedTopic = topics[i].sub[0]._id
      selectedTopicName = topics[i].sub[0].name
    }

  }

  activityService.logger(req, "Visited Topic "+selectedTopicName);

  console.log("selected asd", selectedTopic, selectedTopic);
    
  res.render('dashboard/forum-page', { 
    title: '',
    description: '',
    keywords: '',
    selectedTopic: selectedTopic,
    topics: topics,
    userData: userData,
    isBetaTester: isBetaTester
  });

}


exports.downloadPage = async function(req, res, next) {
    
  let userData = await helpers.getLoginUser(req)
  let isBeta = await helpers.isBetaTester(req)
  // console.log(req.cookies.email);
  // console.log(userData);

  activityService.logger(req, "Visited Download Page ");

  res.render('pages/download', { 
    title: '',
    description: '',
    keywords: '',
    userData: userData,
  });

}

exports.downloadPageWeb = async function(req, res, next) {
    
  activityService.logger(req, "Download Web APP");
  res.redirect(variables.webAppURL)

}

exports.downloadPageMobile = async function(req, res, next) {
    
  activityService.logger(req, "Download Mobile APP");
  res.redirect(variables.mobileAppURL)

}

exports.participate = async function(req, res, next) {
    
  let userData = await helpers.getLoginUser(req)
  console.log("participate", userData, req.body);
  let userAgree = req.body.agreement

  if (userAgree) {
    // put 

    userData.dateJoined = req.app.locals.moment().format()
    // rpoBetaUsers.put(userData)
    let testerData = {
      testerJoinDate : req.app.locals.moment().format(),
      testerDevice : req.body.testerDevice,
      isBetaTester : true,
    }

    rpoUsers.update(userData._id, testerData)

    let name = userData.name.trim().replace(","," ")
    let fname = name.split(" ")
    let firstName = fname.length > 0 ? fname[0] : userData.username;

    // send welcome email
    let mailData = {
      subject: "Welcome to our Beta APP Program",
      to: userData.email,
      message: `
        <h3 style="margin-bottom:30px;">Hi <span style="">${firstName}</span>,</h3>

        <p>Thank you very much for enrolling in the ChinesePod Beta Program.</p>
        <p>Your participation is invaluable for us to help build the best app for YOU in your journey to learn Mandarin Chinese. </p>
        <p>You can start by downloading the beta version of the Chinese Express App for Android Phones through this link:
        https://www.chinesepod.com/beta/download</p>
        <p>Already have the ChinesePod Express App (Beta) installed? Make sure it’s updated with the latest version - Ver. 26</p>
        <p>Share your experiences and suggestions, or report any bugs and issues in our dedicated Forum Page.
        https://www.chinesepod.com/beta/forums</p>

        <p>Please let me know what we can do better and what are the key areas that you would like to see improved in the APP.</p>

        <br>
        <p>Sincerely,<br>Mia</p>
      `
    }
    mailService.welcomeBetaTester(mailData)

    res.flash('success', 'Thank you for participating with our Beta App.');
    res.redirect("/beta/download")
  } else {
    // redirect
    res.flash('error', 'You need to agree with the terms and conditions');
    res.redirect("/beta/download")
  }

  

}

exports.weNeedYou = async function(req, res, next) {
    
  res.render('pages/weneedyou', { 
    title: '',
    description: '',
    keywords: '',
  });

}

exports.ourMission = async function(req, res, next) {

  
    
  res.render('pages/ourmission', { 
    title: '',
    description: '',
    keywords: '',
  });

}

exports.enroll = async function(req, res, next) {
    
  res.render('pages/enroll', { 
    title: '',
    description: '',
    keywords: '',
  });

}

exports.about = async function(req, res, next) {
    


  res.render('pages/about', { 
    title: '',
    description: '',
    keywords: '',
  });

}

exports.lesson = async function(req, res, next) {

  // fetch dialogues
  let slug = req.params.slug ? req.params.slug : "hello-and-goodbye";
  let course;
  let courseDetails={};
  // get contents using slug
  let content = await rpoContents.getContentSlug(slug)
  console.log("slug", slug);
  if (!content && content.length <= 0) {
    console.log("empty try searching using V3 ID", slug);
    content = await rpoContents.getContentV3(slug)

    slug = content.length > 0 ? content[0].slug : slug;

    // if (content) {
    //   res.redirect('/new/lesson/'+slug)
    // }
    
  }
  

  // if (!content) {
  //   res.redirect('/new/lesson')
  // }
  if (content && content.length > 0) 
    course = await rpoCourseContents.getCourse(content.length > 0 ? content[0].v3_id:'')

  if (course && course.length > 0) 
    courseDetails = await rpoCourseDetail.getCourse(course.length > 0 ? course[0].course_id:'')
  
  // let courseDetails = await rpoCourseDetail.getCourse(course.length > 0 ? course[0].course_id:'')
  
  let courseId = courseDetails && courseDetails.length > 0 ? courseDetails[0].course_id : null

  content = content && content.length > 0 ? content[0] : null
  // let courseId=
  console.log("render page");
  res.render('pages/lesson', {
    layout: 'layouts/lesson-layout', 
    title: (content ? content.title : 'ChinesePod Lesson Page'),
    description: '',
    keywords: 'Lesson',
    slug: slug,
    courseId: courseId,
    content: content,
    course: courseDetails ? courseDetails[0] : null
  });

}

exports.latestLesson = async function(req, res, next) {


  res.render('pages/latest-lesson', {
    layout: 'layouts/latest-lesson-layout', 
    title: 'ChinesePod Latest Lesson Page',
    description: '',
    keywords: 'Latest Lesson',

  });

}

exports.vocabulary = async function(req, res, next) {


  res.render('pages/vocabulary', {
    layout: 'layouts/saved-vocabulary-layout', 
    title: 'ChinesePod Vocabulary Page',
    description: '',
    keywords: 'Vocabulary',

  });

}

exports.lessonDirect = async function(req, res, next) {

  let v3Id = req.params.v3Id ? req.params.v3Id : "";
  let content = await rpoContents.getContentV3(v3Id)

  console.log("=== redirect");

  if (content && content.length > 0) {
    console.log("=== redirect slug =====", content[0].slug);
    res.redirect("/new/lesson/"+content[0].slug)
  } else {
    console.log("=== redirect default");
    res.redirect("/new/lesson")
  }
}

exports.vocabulary = async function(req, res, next) {


  res.render('pages/checkout-10classes', {
    layout: 'layouts/checkout-promo-layout', 
    title: 'Checkout Promo Page | ChinesePod',
    description: '',
    keywords: 'Promo 10 Classes',

  });

}

exports.userELogs = async function(req, res, next) {
    

  activityService.logger(req, "User Email Logs");

  res.render('pages/user-email-logs', { 
    layout: 'layouts/log-layout', 
    title: '',
    description: '',
    keywords: ''
  });

}


