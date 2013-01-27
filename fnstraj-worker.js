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
var async    = require('async');
var fnstraj	 = require('./library/fnstraj.js');
var helpers  = require('./library/helpers.js');
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
				var thisID		= queue[0].id;
				var thisRev		= queue[0].value.rev;
				var thisFlight  = queue[0].doc.parameters;


				var now = new Date();
				var utc = now.getTime() + ( now.getTimezoneOffset() * 60000 );


				var flight = {
					options: {
						debug:      false,
						context:    "daemon",
						flightID:   thisID,
						model:      thisFlight.options.model,
						resolution: 1
					},
					launch: {
						latitude:   37.403672,
						longitude:  -79.170205,
						altitude:   0,
						timestamp:  utc
					},
					balloon: {
						radius:     0,
						lift:       0,
						burst:      30000
					},
					parachute: {
						radius:     0,
						weight:     0
					}
				}

				fnstraj.predict( flight, function( error ) {

					if ( typeof error !== "undefined" && error ) {
						/////////////////////////////////////
						// CASE: PREDICTION FAILED/FORWARD //
						/////////////////////////////////////

						// log error
						// email user

						// right now, this is breaking. Delete and report broken queue.

						database.remove('/queue/' + thisID, thisRev, function() {
							console.log("Prediction " + thisID + " failed - removing.")

							helpers.sendMail('kyle@kylehotchkiss.com', 'fnstraj failed', 'lol');
							
							advance();
						});
					} else {
						////////////////////////////
						// CASE: COMPLETE/FORWARD //
						////////////////////////////

						// async.parallel is okay here.

						database.remove('/queue/' + thisID, thisRev, function() {
							// error handling? Database error means LOST DATA here.
							
							helpers.sendMail('kyle@kylehotchkiss.com', 'fnstraj update', 'we\'re finished with your report'); 
								
							advance();
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


	/*

		# Process:

		1) check DB for queries (to multithread, we need to remove entries on grab)
		2) get all relevant flight data (preverified)
		3) build flight object, fnstraj.predict();
		4) on success, delete entry; on failure, log error and ???
		5) mail (or add to mail queue) the job status
		6) nextTick into next iteration

	*/

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
	}, fnstraj_sleep); // 5min, but needs to be envvar
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
