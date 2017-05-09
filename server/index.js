// Dependencies
var express = require("express"),
    compression = require("compression"),
    path = require("path"),
    multer = require("multer"),
    uuid = require("uuid"),
    mkdirp = require("mkdirp");

// Routes and middleware
var logger = require("../lib/logger/"),
    render = require("./render.js"),
    status = require("./status.js"),
    fonts = require("./fonts.js"),
    errorHandlers = require("./error.js"),
    cleanJobs = require('./cleanJobs.js');

// Settings
var serverSettings = require("../lib/settings/");

var app = express();

app.use(compression());
app.use(logger.morgan());

// Options for where to store uploaded audio and max size
var fileOptions = {
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      if(file.fieldname === "audio") {
        var dir = path.join(serverSettings.workingDirectory, uuid.v1());
        mkdirp(dir, function(err) {
          return cb(err, dir);
        });
      } else {
        cb(null, serverSettings.workingDirectory);
      }
    },
    filename: function(req, file, cb) {
      if(file.fieldname === "audio") {
        cb(null, "audio");
      } else {
        cb(null, uuid.v1());
      }
    }
  })
};

if (serverSettings.maxUploadSize) {
  fileOptions.limits = {
    fileSize: +serverSettings.maxUploadSize
  };
}

// On submission, check upload, validate input, and start generating a video
app.post("/submit/", [multer(fileOptions).fields([{name: "audio", maxCount: 1}, {name: "backgroundImage", maxCount: 1}, {name: "logoImage", maxCount: 1}], {}), render.validate, render.route]);

// If not using S3, serve videos locally
if (!serverSettings.s3Bucket) {
  app.use("/video/", express.static(path.join(serverSettings.storagePath, "video")));
}

// Serve custom fonts
app.get("/fonts/fonts.css", fonts.css);
app.get("/fonts/fonts.js", fonts.js);

if (serverSettings.fonts) {
  app.get("/fonts/:font", fonts.font);
}


// Check the status of a current video
 app.get("/cleanJobs/", cleanJobs);

// Check the status of a current video
app.get("/status/:id/", status);


// Serve background images and themes JSON statically
app.use("/settings/", function(req, res, next) {

  // Limit to themes.json and bg images
  if (req.url.match(/^\/?themes.json$/i) ||  req.url.match(/^\/?logos.json$/i) || req.url.match(/^\/?images\/[^/]+$/i)) {
    return next();
  }

  return res.status(404).send("Cannot GET " + path.join("/settings", req.url));

}, express.static(path.join(__dirname, "..", "settings")));

// Serve editor files statically
app.use(express.static(path.join(__dirname, "..", "editor")));

app.use('/node_modules' , express.static('node_modules'));

app.use(errorHandlers);

module.exports = app;
