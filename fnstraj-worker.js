/**
 *
 * fnstraj | Worker
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 *
 * Garbage Collection based on process.nextTick(), but if possible,
 * we want to catch stack overflows and and see what happened.
 *
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
			sleep();
		} else {
			var queue = results.rows;

			for ( item in queue ) {
				console.log(queue[item].id);				
			}
			
			// try-del
			
			database.remove('/queue/' + queue[0].id, queue[0].value.rev, function() {
				
				console.log("maybe it's removed");
				
			});

			// FIFO select one.


			/*var flight = {
					options: {
						context:	"daemon",
						flightID:	"123456789",
						model:		model,
						resolution: 1
					},
					launch: {
						latitude:	sanitize(latitude).toFloat(),
						longitude:	sanitize(longitude).toFloat(),
						altitude:	sanitize(altitude).toFloat(),
						timestamp:	utc
					},
					balloon: {
						radius:	 bRadius,
						lift:		lift,
						burst:		burst
					},
					parachute: {
						radius:	 size,
						weight:	 0
					}
			};*/


			/*fnstraj.predict( flight, function( error ) {
				//
				// WHERE ARE WE GETTING OUR FLIGHT DATA FROM?
				//

				if ( typeof error !== "undefined" && error ) {
					sleep();
				} else {
					advance();
				}
			});*/

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
		console.log("Sleeping for a few...");

		process.nextTick( function() {
			daemon();
		});
	}, 300000); // 5min
};


///////////////////
// Initalization //
///////////////////
daemon();