var d3 = require("d3"),
    audio = require("./audio.js"),
    video = require("./video.js"),
    minimap = require("./minimap.js"),
    sampleWave = require("./sample-wave.js"),
    getRenderer = require("../renderer/"),
    getWaveform = require("./waveform.js");

var context = d3.select("canvas").node().getContext("2d");

var theme,
    caption,
    file,
    logoImage,
    logoFile,
    backgroundFile,
    backgroundFileCanvasImage,
    logoFileCanvasImage,
    selection;

function _file(_) {
  return arguments.length ? (file = _) : file;
}

function _backgroundFile(_) {
  return arguments.length ? (backgroundFile = _) : backgroundFile;
}

function _logoFile(_) {
  return arguments.length ? ( logoFile = _, redraw()) : logoFile;
}

function _logoImage(_) {
  return arguments.length ? ( logoImage = _, redraw()) : logoImage;
}

function _theme(_) {
  return arguments.length ? (theme = _, redraw()) : theme;
}

function _caption(_) {
  return arguments.length ? (caption = _, redraw()) : caption;
}

function _selection(_) {
  return arguments.length ? (selection = _) : selection;
}

minimap.onBrush(function(extent){

  var duration = audio.duration();

  selection = {
    duration: duration * (extent[1] - extent[0]),
    start: extent[0] ? extent[0] * duration : null,
    end: extent[1] < 1 ? extent[1] * duration : null
  };

  d3.select("#duration strong").text(Math.round(10 * selection.duration) / 10)
    .classed("red", theme && theme.maxDuration && theme.maxDuration < selection.duration);

});

// Resize video and preview canvas to maintain aspect ratio
function resize(width, height) {

  var widthFactor = 640 / width,
      heightFactor = 360 / height,
      factor = Math.min(widthFactor, heightFactor);

  d3.select("canvas")
    .attr("width", factor * width)
    .attr("height", factor * height);

  d3.select("#canvas")
    .style("width", (factor * width) + "px");

  d3.select("video")
    .attr("height", widthFactor * height);

  d3.select("#video")
    .attr("height", (widthFactor * height) + "px");

  context.setTransform(factor, 0, 0, factor, 0, 0);

}

function redraw() {

  resize(theme.width, theme.height);

  video.kill();

  var renderer = getRenderer(theme);

  renderer.backgroundImage(backgroundFileCanvasImage || theme.backgroundImageFile || null);
  renderer.watermarkImage(logoFileCanvasImage || theme.watermarkImageFile || null);
  // renderer.logoImage(logoFileCanvasImage || null);

  renderer.drawFrame(context, {
    caption: caption,
    waveform: sampleWave,
    frame: 0
  });

}

function loadAudio(f, cb) {

  d3.queue()
    .defer(getWaveform, f)
    .defer(audio.src, f)
    .await(function(err, data){

      if (err) {
        return cb(err);
      }

      file = f;
      minimap.redraw(data.peaks);

      cb(err);

    });

}

function loadLogoImage(f, cb) {
  logoFile = f;
  if( logoFile && logoFile.logoImage ) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      var reader = new FileReader();
      reader.onloadend = function(event) {
          logoFileCanvasImage = new Image();
          logoFileCanvasImage.onload = function(event) {
            redraw();
            cb(null);
          };
          logoFileCanvasImage.src = event.target.result;
      };
      logoFile = new File([xhr.response ], logoFile.name );
      reader.readAsDataURL(xhr.response);

    };
    xhr.open('GET', "./settings/images/" + logoFile.logoImage );
    xhr.responseType = 'blob';
    xhr.send();

  } else {
    logoFileCanvasImage = null;
    redraw();
  }
}

function loadBackgroundImage(f, cb) {
  var reader;
  backgroundFile = f;
  if(backgroundFile) {
    reader = new FileReader();
    reader.readAsDataURL(backgroundFile);
    reader.onload = function(event) {
      backgroundFileCanvasImage = new Image();
      backgroundFileCanvasImage.onload = function(event) {
        redraw();
        cb(null);
      }
      backgroundFileCanvasImage.src = event.target.result;
    }
  } else {
    backgroundFileCanvasImage = null;
    redraw();
  }
}

module.exports = {
  caption: _caption,
  theme: _theme,
  logoImage : _logoImage,
  file: _file,
  backgroundFile: _backgroundFile,
  logoFile: _logoFile,
  selection: _selection,
  loadAudio: loadAudio,
  loadBackgroundImage: loadBackgroundImage,
  loadLogoImage: loadLogoImage
};
