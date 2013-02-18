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
var helpers  = require('./helpers.js');
var position = require('./position.js');


var fnstraj_debug = process.env.FNSTRAJ_DEBUG || false;


///////////////////////////////////
// fnstraj Linear Predictor Loop //
///////////////////////////////////
exports.predict = function( inputFlight, parentCallback ) {
    ////////////////////
    // Initialization //
    ////////////////////
    var flight = inputFlight; // so we can DELETE later.
    var cache = [];
    var stats = { model: flight.options.model, frames: 0, gradsHits: 0, cacheHits: 0, startTime: new Date().getTime() };
    var table = [{ latitude: flight.launch.latitude, longitude: flight.launch.longitude, altitude: flight.launch.altitude }];

    flight.flying = true;



    ////////////////////////
    // Options Processing //
    ////////////////////////
    if ( typeof flight.options.model === "undefined" || (( flight.options.model !== "rap" && flight.options.model !== "gfs" && flight.options.model != "gfshd" ))) {
        flight.options.model = "gfs";
    }

    if ( typeof flight.options.overrideClimb === "boolean" && flight.options.overrideClimb ) {
        flight.status = "descending";
    } else {
        flight.status = "ascending";
    }



    //////////////////////////////////////////
    // Pretty-printed Console Notifications //
    //////////////////////////////////////////
    console.log("Predicting: flight #" + flight.options.flightID + " on NOAA " + flight.options.model);
    
    if ( fnstraj_debug === "true" ) {
        console.log("URL root: http://nomads.ncep.noaa.gov:9090/dods/");
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
            var timestep = flight.launch.timestamp + ((table.length - 1 ) * 1000); // Add +1 minute for every frame. In the future, this may be dynamic.

            if ( flight.status === "ascending" ) {
                var ascended = 5; //position.ascend( table[table.length - 1].altitude, flight.balloon.burst, flight.balloon.lift, flight.balloon.radius );
                var currAlt = ( ascended * 60 ) + table[table.length - 1].altitude; // CONSTANT TO VARIABLE: Percision

                if ( currAlt < flight.balloon.burst ) {
                    table[table.length] = { altitude: currAlt };

                    stats.frames++;

                    grads.wind( table[table.length - 2 ], timestep, flight, table, cache, stats, callback );
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

                    console.log("Complete: flight #" + flight.options.flightID);

                    process.nextTick(function() {
                        ///////////////////////
                        // Timer and Outputs //
                        ///////////////////////
                        stats.endTime = new Date().getTime();
                        stats.predictorTime = (( stats.endTime - stats.startTime ) / 1000);
                        
                        
                        /////////////
                        // Cleanup //
                        /////////////
                        delete stats.endTime; delete stats.startTime;
                        delete flight.flying; delete flight.status;


                        //////////////////////////
                        // SYNCHRONOUS ANALYSIS //
                        //////////////////////////
                        var analysis = {};
                        analysis.heading = position.heading( table[0].latitude, table[0].longitude, table[table.length - 1].latitude, table[table.length - 1].longitude );
                        analysis.distance = position.distance( table[0].latitude, table[0].longitude, table[table.length - 1].latitude, table[table.length - 1].longitude );
                        analysis.midpoint = position.midpoint( table[0].latitude, table[0].longitude, table[table.length - 1].latitude, table[table.length - 1].longitude );


                        ///////////////////////////
                        // ASYNCHRONOUS ANALYSIS //
                        ///////////////////////////
                        async.parallel([
                            function( callback ) {
                                helpers.coordsToCity(table[0].latitude, table[0].longitude, callback);
                            }, function( callback ) {
                                helpers.coordsToCity(table[table.length - 1].latitude, table[table.length - 1].longitude, callback);
                            }
                        ], function( error, results ) {
                            
                            if ( results[0] ) {
                                flight.points.launch = { name: results[0] };    
                            }
                            
                            if ( results[1] ) {
                                flight.points.landing = { name: results[1] };
                            }
                        
                            output.export(flight, table, analysis, stats, parentCallback);
                            
                        });
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