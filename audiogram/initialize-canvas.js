var fs = require("fs"),
    path = require("path"),
    Canvas = require("canvas"),
    async = require("async"),
    getRenderer = require("../renderer/");

function initializeCanvas(theme, cb) {
  // Fonts pre-registered in bin/worker
  var renderer = getRenderer(theme);
  var tasks = [];
  tasks.push(function(cb) {
    loadBackgroundImage(theme, renderer, cb);
  });
  tasks.push(function(cb) {
    loadWatermark(theme, renderer, cb);
  });
  async.parallel(tasks, function(err) {
    err ? cb(err) : cb(null, renderer);
  });
}

function loadBackgroundImage(theme, renderer, cb) {
  if (!(theme.backgroundImage || theme.customBackgroundImage)) {
    return cb(null, renderer);
  };
  var backgroundImagePath = theme.customBackgroundImage
    ? theme.customBackgroundImage
    : path.join(__dirname, "..", "settings", "backgrounds", theme.backgroundImage);

  // Load background image from file (done separately so renderer code can work in browser too)
  fs.readFile(backgroundImagePath, function(err, raw){
    if (err) {
      return cb(err);
    }

    var bg = new Canvas.Image;
    bg.src = raw;
    renderer.backgroundImage(bg);

    return cb(null, renderer);
  });
}

function loadWatermark(theme, renderer, cb) {
  if (!(theme.watermarkImage || theme.customwatermarkImage)) {
    return cb(null, renderer);
  };
  var watermarkImagePath = theme.customwatermarkImage
    ? theme.customwatermarkImage
    : path.join(__dirname, "..", "settings", "backgrounds", theme.watermarkImage);

  // Load watermark image from file (done separately so renderer code can work in browser too)
  fs.readFile(watermarkImagePath, function(err, raw){
    if (err) {
      return cb(err);
    }

    var bg = new Canvas.Image;
    bg.src = raw;
    renderer.watermarkImage(bg);

    return cb(null, renderer);

  });
}

module.exports = initializeCanvas;
