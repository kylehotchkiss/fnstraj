/**
 *
 * fnstraj | Executible
 * Copyright 2011-2012 Hotchkissmade
 * Released under the GPL
 *
 */
 
var fnstraj = require('./library/fnstraj.js');



flight = {
    launch: {
        latitude: 37.403672, 
        longitude: -79.170205,
        altitude: 0,
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
