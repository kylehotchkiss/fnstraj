/**
 *
 * fnstraj | Executible
 * Copyright 2011-2012 Hotchkissmade
 * Released under the GPL
 *
 */

var fnstraj = require('./library/fnstraj.js');
var sanitize = require('validator').sanitize;

if ( process.argv.length >= 4 ) {
    //
    // Required
    //
    latitude  = sanitize(process.argv[2]).toFloat();
    longitude = sanitize(process.argv[3]).toFloat();

    altitude  = sanitize(process.argv[4]).toFloat() || 0;
    bRadius   = sanitize(process.argv[5]).toFloat() || 8;
    lift      = sanitize(process.argv[6]).toFloat() || 1.359;
    burst     = sanitize(process.argv[7]).toFloat() || 30000;
    size      = sanitize(process.argv[8]).toFloat() || 0;
    weight    = sanitize(process.argv[9]).toFloat() || 0;

    flight = {
        options: {
            model: "gfs"
        },

        launch: {
            latitude: sanitize(latitude).toFloat(),
            longitude: sanitize(longitude).toFloat(),
            altitude: sanitize(altitude).toFloat(),
            timestamp: new Date().getTime()
        },
        balloon: {
            radius: bRadius,
            lift: lift,
            burst: burst
        },
        parachute: {
            radius: size,
            weight: 0
        }
    };

    fnstraj.predict( flight );
} else {
    //
    // Help message
    //
    console.log("Usage: node app.js [latitude] [longitude] [altitude] [balloon radius] [balloon lift] [balloon burst] [chute radius] [chute weight]");
}

