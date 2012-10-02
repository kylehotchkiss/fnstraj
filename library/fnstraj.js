/**
 *
 * fnstraj | fnstraj loop
 * Copyright 2011-2012 Hotchkissmade
 * Released under the GPL
 *
 * Logic flow is fairly consise, don't read too much into the parameters,
 * NULLs are abound and fairly frivolous for most things. Generally, program
 * flow involves running the loop, passing control to grads.js, then regaining
 * program control here. Flow also flies around async.whilst a bit, which is
 * explained well enough below.
 *
 * fnstraj.vertPred - Quick predictor for time-tracking purposes. 
 * fnstraj.predict - fnstraj (linear) predictor loop
 *
 */ 
var async    = require('async');
var grads    = require('./grads.js');
var physics  = require('./physics.js');
var position = require('./position.js');
 


//////////////////////////////////////
// Vertical Predictor (Frame Count) //
//////////////////////////////////////
exports.vertPred = function( launchAlt, burstAlt, radius, lift ) {    
    var table     = [ launchAlt ];
    var flying    = true;
    var status    = "ascending";
    var altitude  = launchAlt;

    while ( flying ) {
        if ( status === "ascending") {
            var ascended = position.ascend( table[ table.length - 1 ], burstAlt, lift, radius );    
            var currAlt = ( ascended * 60 ) + altitude;

            if ( currAlt >= burstAlt ) {
                status = "descending";
            } else {
                altitude = currAlt; 
                table[ table.length ] = altitude;
            }
        } else if ( status === "descending") {            
            var descended = 5; //position.descend( table[ frame - 1], 2267, 1.52);
            var currAlt = altitude - ( descended * 60 );

            if ( currAlt < 0 ) {
                status = "landed";
                flying = false;
            } else {
                altitude = currAlt;
                table[ table.length ] = altitude;
            }
        }
    }    

    return table.length;
}



///////////////////////////////////
// fnstraj Linear Predictor Loop //
///////////////////////////////////
exports.predict = function() {
    
    // schema establish, ditch the consts kthxbyez.
    // Can we create an object? cleannnerrrr
    
    var cache = [],
        stats = {
            frames: 0,
            gradsHits: 0,
            cacheHits: 0,
        }, 
        
        
        
        table = [{
            latitude: 37.403672, 
            longitude: -79.170205,
            altitude: 0
        }],
        flight = {
            flying: true,
            status: "ascending",
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
            
    
    
    async.whilst(
        ////////////////////
        // LOOP CONDITION // 
        ////////////////////
        function () {            
            return flight.flying;
        },
        
        
        
        //////////////////
        // PRIMARY LOOP //
        //////////////////
        function ( callback ) { 
            var timestep = flight.launch.timestamp + ((table.length - 1 ) * 1000); //ms or s bro
            
            if ( flight.status === "ascending" ) {
                var ascended = position.ascend( table[table.length - 1].altitude, flight.balloon.burst, flight.balloon.lift, flight.balloon.radius );
                var currAlt = ( ascended * 60 ) + table[table.length - 1].altitude;
                     
                if ( currAlt >= flight.balloon.burst ) {
                    //
                    // Burst!
                    //
                    flight.points = {
                        burst: { latitude: table[table.length - 1].latitude, longitude: table[table.length - 1].longitude, altitude: table[table.length - 1].altitude }
                    };
                    flight.status = "descending";   
                    callback(); // Blank return - Yikes. Eval this.
                } else {
                    table[table.length] = { altitude: currAlt };
                    
                    stats.frames++;
                    
                    grads.wind( table[table.length - 2 ], timestep, "rap", table, cache, stats, callback ); // Variable me!
                }            
            } else if ( flight.status === "descending" ) {
                var descended = 5;
                var currAlt = table[table.length - 1].altitude - ( descended * 60 );
                    
                if ( currAlt < 0 ) {
                    //
                    // Crash! (Or land?)
                    //
                    flight.flying = false;
                    
                    console.log(JSON.stringify(stats));
                    
                    callback();
                } else {
                    table[table.length] = { altitude: currAlt };
                    
                    stats.frames++;
                    
                    grads.wind( table[table.length - 2 ], timestep, "rap", table, cache, stats, callback ); // Variable me!
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