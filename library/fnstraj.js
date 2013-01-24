/**
 *
 * fnstraj | fnstraj loop
 * Copyright 2011-2013 Kyle Hotchkiss
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
exports.predict = function( flight, parentCallback ) {
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
    if ( flight.options.context === "terminal" ) {
        console.log("\033[1;34m\n FNSTRAJ BALLOON TRAJECTORY PREDICTOR\033[0m");
        console.log("   Generating flight path with NOAA " + flight.options.model + " (this will take several minutes)...");

        if ( flight.options.debug ) {
            console.log("\n\033[1;37m URL root: http://nomads.ncep.noaa.gov:9090/dods/\033[0m");
        }
    }



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

                    if ( flight.options.context === "terminal") {
                        console.log("\n   Predictor Complete - See exports/ for results!\n");
                    }

                    process.nextTick(function() {
                        ///////////////////////
                        // Timer and Outputs //
                        ///////////////////////
                        stats.endTime = new Date().getTime();
                        stats.predictorTime = (( stats.endTime - stats.startTime ) / 1000) + "s";

                        /////////////
                        // Cleanup //
                        /////////////
                        delete stats.endTime; delete stats.startTime;
                        delete flight.flying; delete flight.status;

                        if ( flight.options.debug ) {
                            console.log("\n   Stats: " + JSON.stringify(stats) + "\n");
                        }

                        output.export(flight, table, stats, parentCallback);
                    });
                }
            }
        },



        ///////////////////////////////
        // FINALIZE & ERROR HANDLING //
        ///////////////////////////////
        function ( error ) {
            if ( error != null ) {
                //
                // Error... Do what you will.
                // For queue-worker mode, this should globalCallback with an error
                //

                parentCallback( error );
            }
        }
    );
}