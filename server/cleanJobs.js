var settings  = require("../settings/");
var redisClient = require("../lib/transports/redis/remote")(settings.redisHost);

module.exports = function(req, res) {
    redisClient.cleanJobs( function() {
        res.json({ mesg: 'alles ok' });
    });
};