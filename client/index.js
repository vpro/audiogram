var d3 = require("d3"),
    $ = require("jquery"),
    preview = require("./preview.js"),
    video = require("./video.js"),
    _ = require("underscore"),
    audio = require("./audio.js");


d3.queue()
    .defer(d3.json, "/settings/logos.json")
    .defer(d3.json, "/settings/themes.json")
    .await(function(err, logos, themes) {

        var errorMessage;

        // Themes are missing or invalid
        if (err || !d3.keys(themes).filter(function(d){ return d !== "default"; }).length) {
            if (err instanceof SyntaxError) {
                errorMessage = "Error in settings/themes.json:<br/><code>" + err.toString() + "</code>";
            } else if (err instanceof ProgressEvent) {
                errorMessage = "Error: no settings/themes.json.";
            } else if (err) {
                errorMessage = "Error: couldn't load settings/themes.json.";
            } else {
                errorMessage = "No themes found in settings/themes.json.";
            }
            d3.select("#loading-bars").remove();
            d3.select("#loading-message").html(errorMessage);
            if (err) {
                throw err;
            }
            return;
        }

        for (var key in themes) {
            themes[key] = $.extend({}, themes.default, themes[key]);
        }

        preloadImages(themes);
        preloadLogos(logos);
    });

function submitted() {

  d3.event.preventDefault();

  var theme = preview.theme(),
      caption = preview.caption(),
      selection = preview.selection(),
      backgroundFile = preview.backgroundFile(),
      logoFile = preview.logoFile(),
      logoImage = preview.logoImage(),
      file = preview.file();

  if (!file) {
    d3.select("#row-audio").classed("error", true);
    return setClass("error", "No audio file selected.");
  }

  if (theme.maxDuration && selection.duration > theme.maxDuration) {
    return setClass("error", "Your Audiogram must be under " + theme.maxDuration + " seconds.");
  }

  if (!theme || !theme.width || !theme.height) {
    return setClass("error", "No valid theme detected.");
  }

  video.kill();
  audio.pause();

  var formData = new FormData();

  formData.append("audio", file);
  formData.append("backgroundImage", backgroundFile);
  formData.append("logoImage", logoFile);

  if (selection.start || selection.end) {
    formData.append("start", selection.start);
    formData.append("end", selection.end);
  }
  formData.append("theme", JSON.stringify($.extend({}, theme, { backgroundImageFile: null })));
  formData.append("caption", caption);

  setClass("loading");
  d3.select("#loading-message").text("Uploading audio...");

	$.ajax({
		url: "/submit/",
		type: "POST",
		data: formData,
		contentType: false,
    dataType: "json",
		cache: false,
		processData: false,
		success: function(data){
      poll(data.id, 0);
		},
    error: error

  });

}

function poll(id) {

  setTimeout(function(){
    $.ajax({
      url: "/status/" + id + "/",
      error: error,
      dataType: "json",
      success: function(result){
        if (result && result.status && result.status === "ready" && result.url) {
          video.update(result.url, preview.theme().name);
          setClass("rendered");
        } else if (result.status === "error") {
          error(result.error);
        } else {
          d3.select("#loading-message").html(statusMessage(result));
          poll(id);
        }
      }
    });

  }, 2500);

}

function error(msg) {

  if (msg.responseText) {
    msg = msg.responseText;
  }

  if (typeof msg !== "string") {
    msg = JSON.stringify(msg);
  }

  if (!msg) {
    msg = "Unknown error";
  }

  d3.select("#loading-message").text("Loading...");
  setClass("error", msg);

}

function initializeLogos(err, logosWithImages) {
    d3.select("#input-logo")
        .on("change", updateLogoFile)
        .selectAll("option")
        .data(logosWithImages)
        .enter()
        .append("option")
        .text(function(d){
            return d.name;
        }).attr("data-content", function(d) {
            if ( d.logoImage ) {
                return "<div class='logo-preview' style='background-image:url( \"./settings/images/"+  d.logoImage + " \");'></div>";
            } else {
                return "";
            }
        });

}
// Once images are downloaded, set up listeners
function initialize(err, themesWithImages) {

  // Populate dropdown menu
  d3.select("#input-theme")
    .on("change", updateTheme)
    .selectAll("option")
    .data(themesWithImages)
    .enter()
    .append("option")
      .text(function(d){
        return d.name;
      }).attr("data-content", function(d) {
        return "<div class='theme-preview' style='color:"+ d.foregroundColor +";background-image:url( \"./settings/images/"+  d.backgroundImage + " \");'>"+ d.name +"</div>";
      });

  // Get initial theme
  d3.select("#input-theme").each(updateTheme);

  // Get initial caption (e.g. back button)
  d3.select("#input-caption").on("change keyup", updateCaption).each(updateCaption);

  // Space bar listener for audio play/pause
  d3.select(document).on("keypress", function(){
    if (!d3.select("body").classed("rendered") && d3.event.key === " " && !d3.matcher("input, textarea, button, select").call(d3.event.target)) {
      audio.toggle();
    }
  });

  // Button listeners
  d3.selectAll("#play, #pause").on("click", function(){
    d3.event.preventDefault();
    audio.toggle();
  });

  d3.select("#restart").on("click", function(){
    d3.event.preventDefault();
    audio.restart();
  });

  // If there's an initial piece of audio (e.g. back button) load it
  d3.select("#input-audio").on("change", updateAudioFile).each(updateAudioFile);
  d3.select("#input-background-image").on("change", updateBackgroundFile).each(updateBackgroundFile);

  d3.select("#input-background-image-clear").on("click", function(){
      $("#input-background-image").replaceWith($("#input-background-image").val('').clone(true));
      d3.select("#input-background-image").on("change", updateBackgroundFile).each(updateBackgroundFile);
  });

  d3.select("#return").on("click", function(){
    d3.event.preventDefault();
    video.kill();
    setClass(null);
  });

  d3.select("#submit").on("click", submitted);

}

function updateAudioFile() {

  d3.select("#row-audio").classed("error", false);

  audio.pause();
  video.kill();

  // Skip if empty
  if (!this.files || !this.files[0]) {
    d3.select("#minimap").classed("hidden", true);
    preview.file(null);
    setClass(null);
    return true;
  }

  d3.select("#loading-message").text("Analyzing...");

  setClass("loading");

  preview.loadAudio(this.files[0], function(err){

    if (err) {
      d3.select("#row-audio").classed("error", true);
      setClass("error", "Error decoding audio file");
    } else {
      setClass(null);
    }

    d3.selectAll("#minimap, #submit").classed("hidden", !!err);

  });

}

function updateBackgroundFile() {
    if ( this.files ) {
      preview.loadBackgroundImage(this.files[0], function(err) {
        if(err) {
          console.warn(err);
        }
      })
    }
}

function updateLogoFile() {
    preview.loadLogoImage(d3.select(this.options[this.selectedIndex]).datum(), function(err) {
        if(err) {
            console.warn(err);
        }
    })
}

function updateCaption() {
  preview.caption(this.value);
}

function updateTheme() {
  preview.theme(d3.select(this.options[this.selectedIndex]).datum());
}

function preloadImages(themes) {

  // preload images
  var imageQueue = d3.queue();

  d3.entries(themes).forEach(function(theme){

    if (!theme.value.name) {
      theme.value.name = theme.key;
    }

    if (theme.key !== "default") {
      imageQueue.defer(preloadImagesForTheme, theme.value);
      // imageQueue.defer(getWatermark, theme.value);
    }

  });

  imageQueue.awaitAll(initialize);

  function preloadImagesForTheme(theme, cb) {
    var queue = d3.queue();
    queue.defer(createImage, theme, "backgroundImage", "backgroundImageFile");
    queue.defer(createImage, theme, "watermarkImage", "watermarkImageFile");
    queue.awaitAll(function() {
      cb(null, theme);
    });
  }

  function createImage(theme, sourceProperty, targetProperty, cb) {
    if (!theme[sourceProperty]) {
      return cb(null, theme);
    }

    theme[targetProperty] = new Image();
    theme[targetProperty].onload = function(){
      return cb(null, theme);
    };
    theme[targetProperty].onerror = function(e){
      console.warn(e);
      return cb(null, theme);
    };
    theme[targetProperty].src = "/settings/images/" + theme[sourceProperty];
  }

}


function preloadLogos(logos) {

    // preload images
    var imageQueue = d3.queue();

    d3.entries(logos).forEach(function(logo){

        if (!logo.value.name) {
            logo.value.name = logo.key;
        }

        if (logo.key !== "default") {
            imageQueue.defer(preloadImagesForLogo, logo.value);
        }

    });

    imageQueue.awaitAll(initializeLogos);

    function preloadImagesForLogo(logo, cb) {
        var queue = d3.queue();
        queue.defer(createImage, logo, "logoImage", "logoImageFile");
        queue.awaitAll(function() {
            cb(null, logo);
        });
    }

    function createImage(logo, sourceProperty, targetProperty, cb) {
        if (!logo[sourceProperty]) {
            return cb(null, logo);
        }

        logo[targetProperty] = new Image();
        logo[targetProperty].onload = function(){
            return cb(null, logo);
        };
        logo[targetProperty].onerror = function(e){
            console.warn(e);
            return cb(null, logo);
        };
        logo[targetProperty].src = "/settings/images/" + logo[sourceProperty];
    }

}


function setClass(cl, msg) {
  d3.select("body").attr("class", cl || null);
  d3.select("#error").text(msg || "");
}

function statusMessage(result) {

  switch (result.status) {
    case "queued":
        var msg = "";

      msg += "Waiting for other jobs to finish, #" + (result.position + 1) + " in queue";
      msg += ". click <a href='/cleanJobs/'>here </a> to empty the queue<br><br>Please wait a few minutes before using... ";
        return msg;

    case "audio-download":
      return "Downloading audio for processing";
    case "trim":
      return "Trimming audio";
    case "probing":
      return "Probing audio file";
    case "waveform":
      return "Analyzing waveform";
    case "renderer":
      return "Initializing renderer";
    case "frames":
      var msg = "Generating frames";
      if (result.numFrames) {
        msg += ", " + Math.round(100 * (result.framesComplete || 0) / result.numFrames) + "% complete";
      }
      return msg;
    case "combine":
      return "Combining frames with audio";
    case "ready":
      return "Cleaning up";
    default:
      return JSON.stringify(result);
  }

}



$(document).on('change', ':file', function() {
    var input = $(this),
        numFiles = input.get(0).files ? input.get(0).files.length : 1,
        label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
    input.trigger('fileselect', [numFiles, label]);
});

// We can watch for our custom `fileselect` event like this
$(document).ready( function() {
    $(':file').on('fileselect', function(event, numFiles, label) {

        var input = $(this).parents('.input-group').find(':text'),
            log = numFiles > 1 ? numFiles + ' files selected' : label;

        if( input.length ) {
            input.val(log);
        } else {
            //if( log ) alert(log);
        }

    });
});
