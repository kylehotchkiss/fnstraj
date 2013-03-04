/**
 *
 * fnstraj | SPOT GPS Tracker Interface
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 */

var https = require("https");
var position = require("./position");


var trackingStatus = function( tracking ) {
    //
    // Currently bases status off of movement,
    // needs to check timestamps for status in past hour.
    //
    var status, point1, point2, point3, length1, length2;

    if ( tracking.length === 1 ) {
        //////////////////////////////////////////////
        // To save resources, a flight started with //
        // a single tracking point will be ignored  //
        //////////////////////////////////////////////
        status = "neutral";

    } else if ( tracking.length < 3 ) {
        /////////////////////////
        // Two tracking points //
        /////////////////////////
        point1 = [tracking[tracking.length - 1].latitude, tracking[tracking.length - 1].longitude];
        point2 = [tracking[tracking.length].latitude, tracking[tracking.length].longitude];

        length1 = position.distance(point1[0], point1[1], point2[0], point2[1]) / 1000;

        if ( length1 < 100 ) {
            status = "neutral";
        } else {
            status = "active";
        }
    } else {
        //////////////////////////////////
        // Safest Context Determination //
        //////////////////////////////////
        point1 = [tracking[tracking.length - 2].latitude, tracking[tracking.length - 2].longitude];
        point2 = [tracking[tracking.length - 1].latitude, tracking[tracking.length - 1].longitude];
        point3 = [tracking[tracking.length].latitude, tracking[tracking.length].longitude];

        length1 = position.distance(point1[0], point1[1], point2[0], point2[1]) / 1000;
        length2 = position.distance(point2[0], point2[1], point3[0], point3[1]) / 1000;

        if ( length1 < 100 && length2 < 100 ) {
            status = "neutral";
        } else {
            status = "active";
        }
    }

    return status;
}


exports.getTracking = function( apikey, callback ) {
    ///////////////////////////////////////////////
    // Return a list of points from the SPOT API //
    ///////////////////////////////////////////////
    var spotHost = "api.findmespot.com";
    var spotPath = "/spot-main-web/consumer/rest-api/2.0/public/feed/" + apikey + "/message.json";

    var buffer = "";
    var trackedPath = [];

    var couchdb = https.get({
        host: spotHost,
        path: spotPath
    }, function( response ) {
        response.setEncoding('utf8');

       response.on("data", function( data ) {
            buffer += data;
       });

       response.on("end", function() {
            var results = JSON.parse( buffer );

            if ( results.response.errors ) {
                callback( false, true );
            } else {

                var tracking = results.response.feedMessageResponse.messages.message;

                for ( var point in tracking ) {
                    if ( tracking[point].messageType === "TRACK" ) {
                        trackedPath[trackedPath.length] = tracking[point];
                    }
                }

                callback( trackedPath );
            }
        });
    }).on("error", function() {
        callback( false, true );
    });
};


exports.processTracking = function( tracking, flight ) {
    //
    // Adds New Points
    // Check Status
    //
    // Return index to base predictions off of for latest tracking point,
    // return false if no need repredict
    //
    var difference;
    var greatestDifference = 0;
    var baseTime = flight.parameters.launch.timestamp / 1000;
    baseTime = baseTime.toFixed(0);

    if ( typeof flight.flightpath === "undefined" ) {
        flight.flightpath = [];
    }

    for ( var newPoint in tracking ) {
        ///////////////////////////////////////
        // CHECK IF POINT EXISTS, ADD IF NEW //
        ///////////////////////////////////////
        difference = Math.round(( tracking[newPoint].unixTime - baseTime ) / 60);

        if ( difference > 0 && difference <= flight.prediction[0].length ) {
            if ( typeof flight.flightpath[difference] === "undefined" || flight.flightpath[difference] === null ) {
                console.log("Offset: " + difference);

                flight.flightpath[difference] = tracking[newPoint];

                if ( difference > greatestDifference ) {
                    greatestDifference = difference;
                }
            }
        }
    }

    if ( greatestDifference > 0 ) {
        return greatestDifference;
    } else {
        return false;
    }
}


exports.determineOverride = function( tracking, flight ) {
    if ( tracking.length > flight.parameters.points.burst.index ) {
        return true;
    } else {
        return false;
    }
}