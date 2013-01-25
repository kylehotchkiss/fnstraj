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

var fnstraj	 = require('./library/fnstraj.js');
var database = require('./library/database.js');



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
				var thisFlight  = queue[0];
				var thisID		= thisFlight.id;
				var thisRev		= thisFlight.value.rev;

				var now = new Date();
				var utc = now.getTime() + ( now.getTimezoneOffset() * 60000 );
				
				var flight = {	
					options: {
						debug:      false,
						context:    "terminal",
						flightID:   thisID,
						model:      "gfs",
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
							console.log("prediction was broken, deleting.")
							
							advance();
						});	
					} else {
						////////////////////////////
						// CASE: COMPLETE/FORWARD //
						////////////////////////////
						
						// email user
						
						database.remove('/queue/' + thisID, thisRev, function() { 
							// error handling? Database error means LOST DATA here.
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
	console.log("Sleeping for a few...");
	
	setTimeout(function() {
		process.nextTick( function() {
			daemon();
		});
	}, 300000); // 5min, but needs to be envvar
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
