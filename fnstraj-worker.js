/**
 *
 * fnstraj | Worker
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * Garbage Collection based on process.nextTick(), but if possible,
 * we want to catch stack overflows and and see what happened.
 *
 * Multiple Worker processes requirements:
 * 1) Delete-on-Grab database interactions (risky)
 * 2) Manually set offset (of about 5s) to avoid duplicates.
 *
 */
var async	 = require('async');
var fnstraj	 = require('./library/fnstraj.js');
var helpers	 = require('./library/helpers.js');
var database = require('./library/database.js');


var fnstraj_sleep = process.env.FNSTRAJ_SLEEP;


////////////////////////////////////////
// WORKER LOOP (Optimized for Heroku) //
////////////////////////////////////////
var daemon = function() {

	database.read('/queue/', function( results, error ) {
		if ( typeof error !== "undefined" && error ) {
			/////////////////////////////////
			// CASE: DATABASE DOWN/FORWARD //
			/////////////////////////////////
			sleep();
		} else {
			var queue = results.rows;

			if ( typeof queue === "object" && typeof queue[0] !== "undefined" ) {
				//////////////////
				// DATA SORTING //
				//////////////////
				var thisID		= queue[0].id;
				var thisRev		= queue[0].value.rev;
				var thisFlight	= queue[0].doc.parameters;

				////////////////
				// TIME SETUP //
				////////////////
				var now = new Date();
				var utc = now.getTime() + ( now.getTimezoneOffset() * 60000 );
				
				/////////////////////
				// OPTIONS PARSING //
				/////////////////////
				if ( typeof thisFlight.options.overrideClimb === "boolean" && thisFlight.options.overrideClimb ) {
					overrideClimb = true;
				} else {
					overrideClimb = false;
				}
				

				/////////////////////////////////
				// FLIGHT OBJECT ESTABLISHMENT //
				/////////////////////////////////
				var flight = {
					options: {
						model: thisFlight.options.model,
						context: "daemon",
						flightID: thisID,
						
						// Optional
						debug: false,
						resolution: 1,
						overrideClimb: overrideClimb
					}, launch: {
						altitude: thisFlight.launch.altitude,						
						latitude: thisFlight.launch.latitude,
						longitude: thisFlight.launch.longitude,
						timestamp: utc
					}, balloon: {
						lift: thisFlight.balloon.lift,
						burst: thisFlight.balloon.burst,
						burstRadius: thisFlight.balloon.burstRadius,						
						launchRadius: thisFlight.balloon.launchRadius
					}, payload: {
						weight:	thisFlight.payload.weight,
						chuteRadius: thisFlight.payload.chuteRadius,						
					}
				};

				/////////////////////////////////////////
				// RUN PREDICTOR BASED ON ABOVE OBJECT //
				/////////////////////////////////////////
				fnstraj.predict( flight, function( error ) {

					if ( typeof error !== "undefined" && error ) {
						/////////////////////////////////////
						// CASE: PREDICTION FAILED/FORWARD //
						/////////////////////////////////////

						/* Until gfs/hd hoursets are stable, we can't requeue with success */

						database.remove('/queue/' + thisID, thisRev, function( error ) {
							// We're a bit error agnostic at this point, for some reason.
							
							console.log("Prediction " + thisID + " failed - removing.");
							
							// can we log to database? output.logError would be neat.

							helpers.sendMail('kyle@kylehotchkiss.com', 'fnstraj failed', 'lol');
							
							advance();
						});
					} else {
						////////////////////////////
						// CASE: COMPLETE/FORWARD //
						////////////////////////////
						database.remove('/queue/' + thisID, thisRev, function( error ) {
							if ( typeof error !== "undefined" && error ) {
								console.log("CRITICAL: Cannot connect to database");
								
								// Can we do anything about this? We could forever-loop for DB?
								
								advance();
							} else {
								helpers.sendMail('kyle@kylehotchkiss.com', 'fnstraj update', 'we\'re finished with your report'); 
							
								advance();
							}
						});
					}

				});

			} else {
				//////////////////////////////
				// CASE: NO ENTRIES/FORWARD //
				//////////////////////////////
				sleep();
			}
		}
	});
}



////////////////////
// DAEMON ADVANCE //
////////////////////
var advance = function() {
	process.nextTick( function() {
		daemon();
	});
};



//////////////////
// DAEMON SLEEP //
//////////////////
var sleep = function() {
	setTimeout(function() {
		process.nextTick( function() {
			daemon();
		});
	}, fnstraj_sleep); 
};



///////////////////////////////
// Initalization + Preflight //
///////////////////////////////
(function() {
	//
	// Check for
	// 1) Database config 2) Sleep Config
	//
	daemon();
})();
