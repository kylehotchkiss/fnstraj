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

/*if ( process.env.NODEFLY_KEY ) {
	require('nodefly').profile(
		process.env.NODEFLY_KEY,
		['Heroku']
	);
}*/

var async	 = require('async');
var fnstraj	 = require('./library/fnstraj.js');
var helpers	 = require('./library/helpers.js');
var database = require('./library/database.js');

var fnstraj_mode = process.env.FNSTRAJ_MODE || "development";
var fnstraj_sleep = process.env.FNSTRAJ_SLEEP || 3000;
var fnstraj_debug = process.env.FNSTRAJ_DEBUG || false;


/*
	flag compatibility will not be easy by any means. We have to get the entire queue, and interate each
	item by it's queue order. Each item must be marked as processing, and deleted if done. We also
	must check SPOT if the item is queued as such. SPOT checking must quit when two SPOT locations
	show up as the same altitude.
*/

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
			var i = 0;
			var queue = results.rows;

			if ( typeof queue === "object" && typeof queue[0] !== "undefined" ) {
				////////////////////////////////
				// CASE: QUEUE FOUND, ADVANCE //
				////////////////////////////////
				while ( queue[i].doc.flags.active ) {
					i++;
				}


				////////////////////
				// INITIALIZATION //
				////////////////////
				var thisID = queue[i].id;
				var thisRev = queue[i].value.rev;
				var thisFlight = queue[i].doc.parameters;
				var now = new Date();
				var timestamp = now.getTime();


				/////////////////////
				// OPTIONS PARSING //
				/////////////////////
				if ( typeof thisFlight.options.overrideClimb !== "undefined" && thisFlight.options.overrideClimb ) {
					overrideClimb = true;
				} else {
					overrideClimb = false;
				}


				/////////////////////////////////
				// FLIGHT OBJECT ESTABLISHMENT //
				/////////////////////////////////
				var flight = {
					flags: {
						spot: false,
						active: true,
						lastActivity: false
					}, options: {
						model: thisFlight.options.model,
						context: "daemon",
						flightID: thisID,

						// Optional
						resolution: 1,
						overrideClimb: overrideClimb
					}, launch: {
						altitude: parseFloat(thisFlight.launch.altitude),
						latitude: parseFloat(thisFlight.launch.latitude),
						longitude: parseFloat(thisFlight.launch.longitude),
						timestamp: timestamp
					}, balloon: {
						lift: parseFloat(thisFlight.balloon.lift),
						burst: parseFloat(thisFlight.balloon.burst),
						burstRadius: parseFloat(thisFlight.balloon.burstRadius),
						launchRadius: parseFloat(thisFlight.balloon.launchRadius)
					}, payload: {
						weight:	parseFloat(thisFlight.payload.weight),
						chuteRadius: parseFloat(thisFlight.payload.chuteRadius),
					}
				};


				/////////////////////////////////
				// Set our ACTIVE flag to TRUE //
				/////////////////////////////////
				var setActive = { _rev: thisRev, parameters: flight };

				database.write('/queue/' + thisID, data, function( error ) { // Do something.
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
								// can we log to database? output.logError would be neat.

								if ( thisFlight.meta.email !== "" ) {
									// Too bad if you don't have an email until 0.3.5
									emailContent = "Hey There,\n\nWe are sad to inform you that your trajectory request did not successfully compile. fnstraj is very new software, and we still have some kinks to work out. We are unable to re-queue your flight at this time, but feel free to try again, with a different model.\n\nThanks for experimenting with us,\n- fnstraj";

									helpers.sendMail( thisFlight.meta.email, "fnstraj failed: flight #" + thisID, emailContent);
								}

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
									if ( thisFlight.meta.email !== "" ) {
										emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + thisID + "\n\nThanks for experimenting with us,\n-fnstraj";

										helpers.sendMail( thisFlight.meta.email, "fnstraj prediction: flight #" + thisID, emailContent );
									}

									advance();
								}
							});
						}
					});
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
	// 1) Database config
	// 2) Sleep Config
	// 3) Starting offset
	//
	daemon();
})();
