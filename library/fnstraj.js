/**
 *
 * fnstraj | fnstraj loop
 * Copyright 2011-2013 Hotchkissmade
 * Released under the GPL
 *
 * Logic flow is fairly consise, don't read too much into the parameters,
 * NULLs are abound and fairly frivolous for most things. Generally, program
 * flow involves running the loop, passing control to grads.js, then regaining
 * program control here. Flow also flies around async.whilst a bit, which is
 * explained well enough below.
 *
 *
 */
var async    = require('async');
var grads    = require('./grads.js');
var output   = require('./output.js');
var physics  = require('./physics.js');
var position = require('./position.js');



///////////////////////////////////
// fnstraj Linear Predictor Loop //
///////////////////////////////////
exports.predict = function( flight ) {
    ////////////////////
    // Initialization //
    ////////////////////
    var cache = [],
        stats = { frames: 0, gradsHits: 0, cacheHits: 0, startTime: new Date().getTime() },
        table = [{ latitude: flight.launch.latitude, longitude: flight.launch.longitude, altitude: flight.launch.altitude }];

    flight.flying = true;
    flight.status = "ascending";



    ////////////////////////
    // Options Processing //
    ////////////////////////
    if ( typeof flight.options.model === "undefined" || (( flight.options.model !== "rap" && flight.options.model !== "gfs" && flight.options.model != "gfshd" ))) {
        flight.options.model = "gfs";
    }



    //////////////////////////////////////////
    // Pretty-printed Console Notifications //
    //////////////////////////////////////////
    console.log("\033[1;34m\n FNSTRAJ BALLOON TRAJECTORY PREDICTOR\033[0m\n");
    console.log(" Using the NOAA " + flight.options.model + " weather model.\n");
    console.log("\033[1;37m Generating flight path (this will take several minutes)...\n\033[0m ");



    async.whilst(
        ////////////////////
        // LOOP CONDITION //
        ////////////////////
        function() { return flight.flying; },



        //////////////////
        // PRIMARY LOOP //
        //////////////////
        function ( callback ) {
            var timestep = flight.launch.timestamp + ((table.length - 1 ) * 1000); //ms or s bro

            if ( flight.status === "ascending" ) {
                var ascended = 5;//position.ascend( table[table.length - 1].altitude, flight.balloon.burst, flight.balloon.lift, flight.balloon.radius );
                var currAlt = ( ascended * 60 ) + table[table.length - 1].altitude; // CONSTANT TO VARIABLE: Percision

                if ( currAlt < flight.balloon.burst ) {
                    table[table.length] = { altitude: currAlt };

                    stats.frames++;

                    grads.wind( table[table.length - 2 ], timestep, flight, table, cache, stats, callback ); // Variable me!
                } else {
                    /////////////////////////////////////////////
                    // BURST                                   //
                    // Logic flow: transision to descent mode. //
                    /////////////////////////////////////////////
                    flight.points = {
                        burst: { latitude: table[table.length - 1].latitude, longitude: table[table.length - 1].longitude, altitude: table[table.length - 1].altitude }
                    };

                    flight.status = "descending";

                    callback();
                }
            } else if ( flight.status === "descending" ) {
                var descended = 5;
                var currAlt = table[table.length - 1].altitude - ( descended * 60 ); // CONSTANT TO VARIABLE: Precision

                if ( currAlt > 0 ) {
                    table[table.length] = { altitude: currAlt };

                    stats.frames++;

                    grads.wind( table[table.length - 2 ], timestep, flight, table, cache, stats, callback );
                } else {
                    /////////////////////////////////////////////////
                    // LANDING                                     //
                    // Logic flow: calculation complete, finalize. //
                    /////////////////////////////////////////////////
                    flight.flying = false;

                    process.nextTick(function() {
                        ///////////////////////
                        // Timer and Outputs //
                        ///////////////////////
                        stats.endTime = new Date().getTime();
                        stats.predictorTime = (( stats.endTime - stats.startTime ) / 1000) + "s";
                        delete stats.endTime; delete stats.startTime;

                        console.log(" " + JSON.stringify(stats) + "\n");

                        output.writeFiles(flight, table, callback);
                    });
                }
            }
        },



        ///////////////////////////////
        // FINALIZE & ERROR HANDLING //
        ///////////////////////////////
        function ( error ) {
            if ( error != null ) {
                console.log("Closing");
            }
        }
    );
}