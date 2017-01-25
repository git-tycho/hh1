var express = require("express");
var nodemailer = require("nodemailer");
var mailcomposer = require("mailcomposer");
var fs = require("fs");
// This is your API key that you retrieve from www.mailgun.com/cp (free up to 10K monthly emails)
var api_key = 'key-993bf87d0df0e92001aff97b1e6d148a';
// var domain = 'sandboxb8225572d5a6416c8ac11ccdffaa6882.mailgun.org';
var domain = 'jobs.pathwaysphx.com';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

//  var mandrillTransport = require('nodemailer-mandrill-transport');
//  var mg = require('nodemailer-mailgun-transport');
var path = require("path");
var bodyParser = require("body-parser");
var multer = require("multer");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;

// setup e-mail data with unicode symbols
// var mailOptions = {
//    from: '"Node Mailer" <dev@pathways.io>', // sender address
//    to: 'dev@pathways.io', // list of receivers
//    subject: 'Hello ✔', // Subject line
//    text: 'Hello world ?', // plaintext body
//    html: '<b>Hello world ?</b>' // html body
//};

var JOBS_COLLECTION = "jobs";
var FACILITIES_COLLECTION = "facilities";
var FACILITY = 5001; // Huntsville - Alabama
var PARENT = 5000;
var MLAB = 'mongodb://nanosite:NApathways2016NOAZ@ds031915.mlab.com:31915/nano';
// var FACILITIES = [1781,1792,1793,1794,2381,2391,2401,2411,2421,2431,2441,2451,2461,2471,2481,2491,2501,2511,2521,2531,2541,2551];

var app = express();
app.use(function(req, res, next) {               // allow cross origin requests
  res.header("Access-Control-Allow-Origin", "http://localhost:4200");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
var upload = multer();

app.post('/upload', upload.single('attachment'), function(req,res) {

  fs.readFile(path.join(__dirname, '/emailTemplate/thanks.html'), function (err, fetched) {
    htmlBody = ("" + fetched).replace('[FIRST_LAST]', req.body.contactName);
    var mail = mailcomposer({
      from: process.env.MAIL_FROM_ADDRESS,
      to: 'dev@pathways.io', // My address, for testing purpose
      subject: 'Thanks for your application ' + req.body.contactName + '!',
      text: 'HTML version only',
      html: htmlBody,
    });
    mail.build(function (mailBuildError, message) {
      var dataToSend = {
        to: req.body.contactEmail,
        message: message.toString('ascii'),
      };
      mailgun.messages().sendMime(dataToSend, function (sendError, body) {
        if (sendError) {
          console.log(sendError);
          return;
        }
      });
    });
  });

  fs.readFile(path.join(__dirname, '/emailTemplate/alert.html'), function (err, fetched) {
    htmlBody = ("" + fetched).replace('[FIRST_LAST]', req.body.contactName).replace('[JOB_ID]', req.body.id + ' : ' + req.body.name).replace('[MESSAGE_FROM_CANDIDATE]', req.body.contactMsg);
    var mail = mailcomposer({
      from: process.env.MAIL_FROM_ADDRESS,
      to: 'dev@pathways.io', // My address, for testing purpose
      subject: req.body.contactName + ' has applied for a job!',
      text: 'HTML version only',
      html: htmlBody,
      attachments: [
        {   // filename and content type is derived from path
            filename: req.file.originalname,
            content: req.file.buffer
        }
      ]
    });
    mail.build(function (mailBuildError, message) {
      var dataToSend = {
        to: 'dev@pathways.io',
        message: message.toString('ascii'),
      };
      mailgun.messages().sendMime(dataToSend, function (sendError, body) {
        if (sendError) {
            console.log(sendError);
            return;
        }
      });
    });
  });
});

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(MLAB, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready.");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 3000, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// var hero = db.collection(FACILITIES_COLLECTION).find({id: FACILITY}, {hero: 1});
/*function testFunction() {
  db.collection(FACILITIES_COLLECTION).find({id: FACILITY}, {hero: 1}).toArray(function(err, res) {
    if (err) {
      handleError(res, err.message, "Failed to get hero.");
    } else {
      console.log("Hero: ", res);
    }
  })
}
testFunction();
*/

// CONTACTS API ROUTES BELOW

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}

/*  "/jobs"
 *    GET: finds all contacts
 *    POST: creates a new contact
 */
app.get("/jobs", function(req, res) {

  req.query.facility = parseInt(req.query.facility);
  db.collection(FACILITIES_COLLECTION).aggregate([
    { $match : { "facility.id" : req.query.facility } },
    { $project : { _id: 0, "facility.id" : 1, name : 1, "hero.image" : 1, child : 1 } },
    { $unwind: { path: "$child", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "jobs", localField: "child", foreignField: "facility.id", as: "job" } },
    { $project : { "facility.id" : 1, name : 1, "hero.image" : 1, child : 1, "job._id" : 1, "job.id" : 1, "job.name" : 1, "job.description" : 1, "job.created_at" : 1, "job.profession" : 1, "job.contact" : 1 } },
    { $unwind: { path: "$job" } }
  ]).toArray(function(err, jobs) {
    if (err) {
      handleError(res, err.message, "Failed to get jobs.");
    } else {
      res.status(200).json(jobs);
      console.log("Facility:",req.query.facility);
      console.log("Aggregate: ", jobs);
    }
  });
});

/*  "/job/:id"
 *    GET: find contact by id
 *    PUT: update contact by id
 *    DELETE: deletes contact by id
 */

app.get("/job/:id", function(req, res) {
  var combined;
  db.collection(JOBS_COLLECTION).findOne({ _id: new ObjectID(req.params.id) }, function(err, job) {
    if (err) {
      handleError(res, err.message, "Failed to get job.");
    } else {
      combined = job;
      console.log("Individual Job: ", job);
      db.collection(JOBS_COLLECTION).find({"facility.parent_id": PARENT, "profession.id": job.profession.id},{"id": 1, "name": 1}).toArray(function(err, related) {
        if (err) {
          handleError(res, err.message, "Failed to get hero.");
        } else {
          console.log("Related: ", related);
          console.log("Profession: ", job.profession.id);
          combined = related.concat(job);
          res.status(200).json(combined);
        }
      });
    }
  });
});
