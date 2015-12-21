// https promise calls
var https = require('https');
var Promise = require("bluebird");

// interact with s3
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});

// interact with slack
var Slack = require('slack-node');
var slack = new Slack();
slack.setWebhook(process.env.SLACK_WEBHOOK_URL);


var enter        = 0,
    exit         = 0,
    success      = 0,
    errors       = 0,
    expire_soon  = 0,
    isVerbose    = true;
function displayStats(title, status, message) {
  var success_plus_errors = errors + success;
  var delta               = success_plus_errors - sites.length;
  var audit_status        = (enter == exit && delta == 0) ? "Pass" : "Fail"

  console.log (                                    "          >> " + title);
  console.log (                                    "      enter: " + enter);
  console.log (                                    "       exit: " + exit);
  console.log ((status == "success" ? "*" : " ") +  "   success: " + success);
  console.log ((status == "errors"  ? "*" : " ") +  "    errors: " + errors);
  console.log (                                    "        s+e: " + success_plus_errors);
  console.log (                                    "      total: " + sites.length);
  console.log (                                    "      delta: " + delta);
  console.log (                                    "    message: " + message)
  console.log (                                    "expire soon: " + expire_soon)
  console.log (                                    "      audit: " + audit_status);
  console.log (                                    "---");
}

//exports.handler = function(event, context) {
/*
  var bucket = 'telusdigital-lambda';
  var key = 'ssl-check/event.json';

  s3.getObject({Bucket: bucket, Key: key}, function(err, data) {
    if (err) {
      console.log("Error getting object " + key + " from bucket " + bucket +
          ". Make sure they exist and your bucket is in the same region as this function.");
      context.fail ("Error getting file: " + err)
    } else {

      var sites = JSON.parse(data.Body.toString());
*/
      var fs = require('fs');
      var input = JSON.parse(fs.readFileSync('event.json', 'utf8'));
      var sites = input.sites;
      var expire_in = input.expire_in;
      var results_array = [];

      for (link in sites){
        var promise = new Promise(function(resolve, reject) {
          var url = sites[link];

          https_options = {
            host: url,
            port: 443,
            method: "GET"
          };

          https.request(https_options, function(res) {
            enter++;

            var cert      = res.connection.getPeerCertificate().valid_to;
            var cert_date = new Date(cert);
            var date_now  = new Date();
            var days      = days_between(cert_date, date_now);
            var result    = "";

            if (days <= expire_in) {
              result = url + " expires in " + days + "\n";

              expire_soon++;
            }

            success++;
            if (isVerbose) displayStats(url, "success", result);

            resolve(result);
          }).on('error', function (error) {
            var message = "error: " + url + ": " + error + "\n";

            errors++;
            if (isVerbose) displayStats(url, "error", error);

            resolve (message);
          }).end(function () {
            exit++;
          });
        });

        results_array.push(promise);
      }


      Promise.all(results_array).then(function(results) {
        console.log (results.join(""));
        displayStats("Status", null, null);

        slack.webhook({
          channel: process.env.SLACK_CHANNEL,
          username: 'SSL Watch',
          text: results.join(""),

        }, function(err, response) {
          if(err) console.log(err);
          if(response.statusCode == "200"){
            context.succeed("done")
          }
        });
      });
//    }
//  });
//};

function days_between(date1, date2) {
  // The number of milliseconds in one day
  var ONE_DAY = 1000 * 60 * 60 * 24;

  // Convert both dates to milliseconds
  var date1_ms = date1.getTime();
  var date2_ms = date2.getTime();

  // Calculate the difference in milliseconds
  var difference_ms = Math.abs(date1_ms - date2_ms);

  // Convert back to days and return
  return Math.round(difference_ms/ONE_DAY);
}
