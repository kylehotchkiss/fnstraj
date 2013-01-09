/**
 *
 * fnstraj | Executible
 * Copyright 2011-2013 Hotchkissmade
 * Released under the GPL
 *
 */

var fnstraj = require('./library/fnstraj.js');
var sanitize = require('validator').sanitize;

if ( process.argv.length >= 4 ) {
    //
    // Required
    //
    var latitude  = sanitize(process.argv[2]).toFloat();
    var longitude = sanitize(process.argv[3]).toFloat();

    //
    // Other Options
    //
    var model     = process.argv[4] || "gfs";
    var altitude  = sanitize(process.argv[5]).toFloat() || 0;
    var bRadius   = sanitize(process.argv[6]).toFloat() || 8;
    var lift      = sanitize(process.argv[7]).toFloat() || 1.359;
    var burst     = sanitize(process.argv[8]).toFloat() || 30000;
    var size      = sanitize(process.argv[9]).toFloat() || 0;
    var weight    = sanitize(process.argv[10]).toFloat() || 0;


    //
    // Date Setup
    //
    var now = new Date();
    var utc = now.getTime() + ( now.getTimezoneOffset() * 60000 );

    flight = {
        options: {
            model: model,
            resolution: 1
        },
        launch: {
            latitude: sanitize(latitude).toFloat(),
            longitude: sanitize(longitude).toFloat(),
            altitude: sanitize(altitude).toFloat(),
            timestamp: utc
        },
        balloon: {
            radius: bRadius,
            lift: lift,
            burst: burst
        },
        parachute: {
            radius: size,
            weight: 0
        },

        context: "terminal",
        debug: false
    };

    fnstraj.predict( flight );
} else {
    //
    // Help message
    //
    console.log("Usage: node app.js [latitude] [longitude] [altitude] [balloon radius] [balloon lift] [balloon burst] [chute radius] [chute weight]");
}

