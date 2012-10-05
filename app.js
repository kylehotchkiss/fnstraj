/**
 *
 * fnstraj | Executible
 * Copyright 2011-2012 Hotchkissmade
 * Released under the GPL
 *
 */
 
var fnstraj = require('./library/fnstraj.js');
var sanitize = require('validator').sanitize;



if ( process.argv.length >= 5 ) {
    latitude = sanitize(process.argv[2]).toFloat();
    longitude = sanitize(process.argv[3]).toFloat();
    altitude = sanitize(process.argv[4]).toFloat();
    
    
    flight = {
        launch: {
            latitude: sanitize(latitude).toFloat(), 
            longitude: sanitize(longitude).toFloat(),
            altitude: sanitize(altitude).toFloat(),
            timestamp: new Date().getTime()
        },
        balloon: {
            radius: 8,
            lift: 2,
            burst: 30000
        },
        parachute: {
            radius: 0,
            weight: 0
        }
    };
    
    fnstraj.predict( flight );
} else {
    console.log("Usage: node app.js [latitude] [longitude] [altitude]");
}

