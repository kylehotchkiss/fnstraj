/**
 *
 * fnstraj | Worker Process
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * Garbage Collection based on process.nextTick(), but if possible,
 * we want to catch stack overflows and and see what happened.
 *
 * In the future, delete database.write error handlers
 *
 */

var async	 = require('async');
var spot     = require('./library/spot.js');
var fnstraj	 = require('./library/fnstraj.js');
var helpers	 = require('./library/helpers.js');
var database = require('./library/database.js');


var fnstraj_mode = process.env.FNSTRAJ_MODE || "development";
var fnstraj_sleep = process.env.FNSTRAJ_SLEEP || 3000;
var fnstraj_debug = process.env.FNSTRAJ_DEBUG || false;


////////////////////////////////////////
// WORKER LOOP (Optimized for Heroku) //
////////////////////////////////////////
var daemon = function() {

	database.read('/fnstraj-queue/', function( results, error ) {
		if ( typeof error !== "undefined" && error ) {
			/////////////////////////////////
			// CASE: DATABASE DOWN/FORWARD //
			/////////////////////////////////
			sleep();
		} else {
			var i = 0, j = 0;
			var queue = results.rows;

			if ( typeof queue === "object" && typeof queue[0] !== "undefined" ) {
				///////////////////////////////
				// CASE: QUEUE FOUND/FORWARD //
				///////////////////////////////
				while ( typeof queue[j] !== "undefined" && typeof queue[j].doc !== "undefined" ) {
					// CouchDB Object Cleanup
					queue[j].parameters = queue[j].doc.parameters;
					delete queue[j].doc;

					j++;
				}


				//////////////////////////////////////////////////////////
				// Determine if queue items are already being worked on //
				//////////////////////////////////////////////////////////
				var continueQueue = false;

				if ( queue.length === 1 ) {
					if ( !queue[i].parameters.flags.active ) {
						continueQueue = true;
					}
				} else {
					while ( queue[i].parameters.flags.active ) {
						if ( i < ( queue.length - 1) ) {
							i++;
						} else {
							break;
						}
					}

					if ( !queue[i].parameters.flags.active ) {
						continueQueue = true;
					}
				}


				if ( continueQueue ) {
					////////////////////
					// INITIALIZATION //
					////////////////////
					var thisID = queue[i].parameters.options.id || queue[i].id;
					var thisRev = queue[i].value.rev;
					var thisFlight = queue[i].parameters;
					var now = new Date();
					var timestamp = now.getTime();


					/////////////////////
					// OPTIONS PARSING //
					/////////////////////
					if ( typeof thisFlight.options.overrideClimb !== "undefined" && thisFlight.options.overrideClimb ) {
						// This isn't an option that would be forwarded from the queue. Consider removing/Depricate
						overrideClimb = true;
					} else {
						overrideClimb = false;
					}

					if ( typeof thisFlight.flags.spot !== "undefined" && thisFlight.flags.spot ) {
						// This isn't an option that would be forwarded from the queue. Consider removing/Depricate
						useSpot = thisFlight.flags.spot;
					} else {
						useSpot = false;
					}


					/////////////////////////////////
					// FLIGHT OBJECT ESTABLISHMENT //
					/////////////////////////////////
					var flight = {
						flags: {
							spot: useSpot,
							active: true,
							lastActivity: false
						}, meta: {
							name: thisFlight.meta.name,
							email: thisFlight.meta.email,
							program: thisFlight.meta.program
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
					database.write('/fnstraj-queue/' + thisID, { parameters: flight }, function( revision, error ) {
						flight.flags.active = false;

						if ( thisFlight.flags.spot ) {
							//////////////////////////////////////////
							// SPOT Tracking / Live Trajectory Mode //
							//////////////////////////////////////////

							console.log("Livetrack: Spot " + thisFlight.flags.spot);

							spot.getTracking( thisFlight.flags.spot, function( tracking, error ) {

								if ( typeof error !== "undefined" && error ) {
									//////////////////////////////////
									// CASE: POINTS UNAVAILABLE/DIE //
									//////////////////////////////////
									database.write('/fnstraj-queue/' + thisID, { parameters: flight }, function( revision, error ) {
										advance();
									});
								} else {
									////////////////////////////////////////
									// CASE: TRACKING DATA EXISTS/FORWARD //
									////////////////////////////////////////
									database.read('/fnstraj-flights/' + thisID, function( spotBase, error ) {
										if ( typeof error !== "undefined" && error ) {
											sleep();
										} else {
											if ( spotBase.error ) {
												///////////////////////////////////////////
												// Run First Prediction of SPOT Tracking //
												///////////////////////////////////////////
												fnstraj.predict( flight, false, function( predictorError ) {
													database.write('/fnstraj-queue/' + thisID, { parameters: flight }, function( revision, error ) {
														if ( typeof predictorError !== "undefined" && predictorError ) {
															/////////////////////////////////////
															// CASE: PREDICTION FAILED/FORWARD //
															/////////////////////////////////////


														} else {
															////////////////////////////
															// CASE: COMPLETE/FORWARD //
															////////////////////////////

														}

														advance();
													});
												});

											} else {
												///////////////////////////////////////
												// Run From Last SPOT Tracking Point //
												///////////////////////////////////////

												var repredict = spot.processTracking( tracking, spotBase );

												// if predict > flight.prediction.length, delete queue item

												if ( repredict ) {
													//////////////////////////////////////////
													// CASE: REPREDICT FROM LAST SPOT POINT //
													//////////////////////////////////////////
													if ( spot.determineOverride( tracking, spotBase ) ) {
														spotBase.parameters.options.overrideClimb = true;

														console.log("OVERRIDE CLIMB");
													}


													spotBase.parameters.launch.latitude  = spotBase.flightpath[repredict].latitude;
													spotBase.parameters.launch.longitude = spotBase.flightpath[repredict].longitude;
													spotBase.parameters.launch.altitude  = spotBase.prediction[repredict].altitude;
													spotBase.parameters.launch.timestamp += repredict * 60000;



													fnstraj.predict( spotBase.parameters, spotBase.flightpath, function( predictorError ) {
														database.write('/fnstraj-queue/' + thisID, { parameters: flight }, function( revision, error ) {
															if ( typeof predictorError !== "undefined" && predictorError ) {
																/////////////////////////////////////
																// CASE: PREDICTION FAILED/FORWARD //
																/////////////////////////////////////


															} else {
																////////////////////////////
																// CASE: COMPLETE/FORWARD //
																////////////////////////////

															}

															advance();
														});
													});
												} else {
													//////////////////////////////////
													// CASE: NO NEW TRACKING POINTS //
													//////////////////////////////////
													database.write('/fnstraj-queue/' + thisID, { parameters: flight }, function( revision, error ) {
														sleep();
													});
												}
											}
										}
									});
								}
							});

						} else {
							//////////////////////////////////////////
							// RUN PREDICTOR BASED ON FLIGHT OBJECT //
							//////////////////////////////////////////
							fnstraj.predict( flight, false, function( error ) {
								//
								// Use only one database.remove, handle errors beforehand
								//

								if ( typeof error !== "undefined" && error ) {
									/////////////////////////////////////
									// CASE: PREDICTION FAILED/FORWARD //
									/////////////////////////////////////

									/* Until gfs/hd hoursets are stable, we can't requeue with success */
									database.remove('/fnstraj-queue/' + thisID, revision, function( error ) {
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
									database.remove('/fnstraj-queue/' + thisID, revision, function( error ) { // THISREV IS NOT LATEST
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
						}
					});
				} else {
					///////////////////////////////////////
					// CASE: QUEUE IS ALL-ACTIVE/FORWARD //
					///////////////////////////////////////
					sleep();
				}
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
	//////////////////////////////////////////////
	// Database Configuration and Status Checks //
	//////////////////////////////////////////////
	if (
		typeof process.env.COUCHDB_HOST === "undefined" ||
		typeof process.env.COUCHDB_PORT === "undefined" ||
		typeof process.env.COUCHDB_USER === "undefined" ||
		typeof process.env.COUCHDB_PASS === "undefined"
	) {
		console.log("Database configuration unavailable! RTFM! ...dies...");
	} else {

		if ( typeof process.env.FNSTRAJ_SLEEP === "undefined" ) {
			console.log("FNSTRAJ_SLEEP was undefined, defaulting to 3 seconds.");
		}

		if ( typeof process.argv[2] === "string" && parseInt(process.argv[2]) !== NaN ) {
			//////////////////////////////////////////////////////
			// CASE: OFFSET FOUND IN ARGUMENTS, RUN WITH OFFSET //
			//////////////////////////////////////////////////////
			setTimeout(function() {
				daemon();
			}, ( process.argv[2] * 1000 ));
		} else {
			daemon();
		}
	}
})();
