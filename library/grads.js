/**
 *
 * fnstraj | GrADS Functions
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * grads.wind - return wind speed and direction.
 *
 * A LOT happens in this file. Most everything, actually. Most things are
 * explained fairly well below, except for model offsets. These are what help
 * determine which forecast time to choose. They are based off of the time
 * difference between model forecast periods.
 *
 */

var url   = require("url");
var http  = require("http");
var async = require('async');
var position = require('./position.js');

var fnstraj_debug = process.env.FNSTRAJ_DEBUG || false;


exports.wind = function( frame, time, flight, table, cache, stats, parentCallback ) {
    var gfs_hourset, gfs_offset, lev, u_ext, v_ext;
    var now     = new Date( time + (table.length * 60000) );
    var launch  = new Date( flight.launch.timestamp );
    var radians = Math.PI / 180;
    var degrees = 180 / Math.PI;
    var model   = flight.options.model;
    var baseURL = "http://nomads.ncep.noaa.gov:9090/dods/";


    if ( frame.latitude && frame.longitude ) {
        ////////////////////////////////////////////
        // Hourset & Offset Determination for RAP //
        ////////////////////////////////////////////
        if ( model === "rap" ) {
            launch.setTime( launch.getTime() - 18000000 );

            rap_offset  = now.getHours() - launch.getHours();

            rap_hourset = launch.getHours();

           if ( launch.getDate() !== now.getDate() ) {
               rap_offset = now.getHours() + ( 23 - launch.getHours() );
           } else {
               rap_offset  = now.getHours() - rap_hourset;
           }

            rap_hourset = ( rap_hourset < 10 ) ? "0" + rap_hourset : rap_hourset;
        }



        ///////////////////////////////////////////////
        // Hourset & Offset Determinaion for GFS(HD) //
        ///////////////////////////////////////////////
        if ( model === "gfs" || model === "gfshd" ) {
            //
            // What's happening below is called Time Travelling.
            // We have to tell the predictor the wrong time because
            // NOAA doesn't release hoursets on the hour, or anywhere
            // near it for that matter. So yeah. 5 hours back.
            //
            launch.setTime( launch.getTime() - 18000000 );

            if ( launch.getHours() <= 5 ) {
                gfs_hourset = 0;
            } else if ( launch.getHours() > 5 && launch.getHours() <= 11 ) {
                gfs_hourset = 6;
            } else if ( launch.getHours() > 11 && launch.getHours() <= 17 ) {
                gfs_hourset = 12;
            } else if ( launch.getHours() > 17 && launch.getHours() <= 23 ) {
                gfs_hourset = 18;
            }

            if ( launch.getDate() !== now.getDate() ) {
                gfs_offset = now.getHours() + ( 23 - gfs_hourset );
            } else {
                gfs_offset  = now.getHours() - gfs_hourset;
            }

            gfs_hourset = ( gfs_hourset < 10 ) ? "0" + gfs_hourset : gfs_hourset;
        }



        ///////////////////////////
        // Date/Time Corrections //
        ///////////////////////////
        var year  = launch.getFullYear();
        var month = ( launch.getMonth() < 9 ) ? "0" + ( launch.getMonth() + 1 ) : ( launch.getMonth() + 1);
        var date  = ( launch.getDate() < 10 ) ? "0" + launch.getDate() : launch.getDate();
        var hour  = ( launch.getHours() < 10 ) ? "0" + launch.getHours() : launch.getHours();



        ///////////////////////////////////
        // Coordinate Mapping (to Model) //
        ///////////////////////////////////
        if ( model === "rap" ) {
            latitude  = Math.floor((( frame.latitude - 16.28100000000 ) * 226 ) / ( 58.02525454545 - 16.28100000000 ));
            longitude = Math.floor((( frame.longitude + 139.85660300000 ) * 427 ) / ( -57.69083517955 + 139.85660300000 ));
            modelURL = "rap/rap" + year + month + date + "/rap_" + rap_hourset + "z.ascii?";



            //////////////////////////////////
            // Altitude Level Determination //
            //////////////////////////////////
            if ( frame.altitude < 12000 ) {
                level = Math.round(( frame.altitude / 12000 ) * 36);

                u_ext = "ugrdprs[" + rap_offset + "][" + level + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrdprs[" + rap_offset + "][" + level + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 12000 && frame.altitude < 14000 ) {
                u_ext = "ugrd180_150mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd180_150mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 14000 && frame.altitude < 15000 ) {
                u_ext = "ugrd150_120mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd150_120mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 15000 && frame.altitude < 17000 ) {
                u_ext = "ugrd120_90mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd120_90mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 17000 && frame.altitude < 19000 ) {
                u_ext = "ugrd90_60mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd90_60mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 19000 && frame.altitude < 24000 ) {
                u_ext = "ugrd60_30mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd60_30mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 24000 ) {
                u_ext = "ugrd30_0mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd30_0mb[" + rap_offset + "][" + latitude + "][" + longitude + "]";
            }
        } else if ( model === "gfs" ) {
            latitude  = Math.floor((( frame.latitude + 90 ) * 180 ) / ( 90 + 90 ));
            safeLongitude = frame.longitude < 0 ? 360 + frame.longitude : frame.longitude;
            longitude = Math.floor((( safeLongitude ) * 359 ) / ( 360 ));
            modelURL = "gfs/gfs" + year + month + date + "/gfs_" + gfs_hourset + "z.ascii?";



            //////////////////////////////////
            // Altitude Level Determination //
            //////////////////////////////////
            if ( frame.altitude < 1829 ) {
                u_ext = "ugrd_1829m[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd_1829m[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 1829 && frame.altitude < 2743 ) {
                u_ext = "ugrd_2743m[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd_2743m[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 2743 && frame.altitude < 3658 ) {
                u_ext = "ugrd_3658m[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd_3658m[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } if ( frame.altitude >= 3658 && frame.altitude < 25908 ) {
                level = Math.round(( frame.altitude / 25908 ) * 25);

                u_ext = "ugrdprs[" + gfs_offset + "][" + level + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrdprs[" + gfs_offset + "][" + level + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 25908 && frame.altitude < 44307 ) {
                u_ext = "ugrd30_0mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd30_0mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            }
        } else if ( model === "gfshd" ) {
            latitude  = Math.floor((( frame.latitude + 90 ) * 360 ) / ( 90 + 90 ));
            safeLongitude = frame.longitude < 0 ? 360 + frame.longitude : frame.longitude;
            longitude = Math.floor((( safeLongitude ) * 719 ) / ( 360 ));
            modelURL = "gfs_hd/gfs_hd" + year + month + date + "/gfs_hd_" + gfs_hourset + "z.ascii?";



            //////////////////////////////////
            // Altitude Level Determination //
            //////////////////////////////////
            if ( frame.altitude < 12000 ) {
                level = Math.round(( frame.altitude / 12000 ) * 46);

                u_ext = "ugrdprs[" + gfs_offset + "][" + level + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrdprs[" + gfs_offset + "][" + level + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 12000 && frame.altitude < 14000 ) {
                u_ext = "ugrd180_150mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd180_150mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 14000 && frame.altitude < 15000 ) {
                u_ext = "ugrd150_120mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd150_120mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 15000 && frame.altitude < 17000 ) {
                u_ext = "ugrd120_90mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd120_90mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 17000 && frame.altitude < 19000 ) {
                u_ext = "ugrd90_60mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd90_60mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 19000 && frame.altitude < 24000 ) {
                u_ext = "ugrd60_30mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd60_30mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            } else if ( frame.altitude >= 24000 ) {
                u_ext = "ugrd30_0mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
                v_ext = "vgrd30_0mb[" + gfs_offset + "][" + latitude + "][" + longitude + "]";
            }
        }



        ///////////////////////////////////
        // Get Wind Files (Concurrently) //
        ///////////////////////////////////
        async.parallel({
            u_wind: function( callback ) {
                if ( typeof cache[u_ext] !== "undefined" && cache[u_ext] !== '' ) {
                    //
                    // Pull from gradscache?
                    //
                    callback( null, cache[u_ext] );

                    stats.cacheHits++;
                } else {
                    u_url = url.parse(baseURL + modelURL + u_ext);
                    u_res = "";

                    if ( fnstraj_debug === "true" ) {
                        console.log( "HIT: " + modelURL + u_ext );
                    }

                    u_req = http.get({
                        hostname: u_url.hostname,
                        path: u_url.path
                    }, function( response ) {
                        response.setEncoding('utf8');

                        response.on("data", function( data ) {
                            u_res += data
                        });

                        response.on("end", function() {
                           callback(null, u_res);

                           stats.gradsHits++;
                        });
                    }).on("error", function() {
                        callback(true, null);
                    });
                }
            },

            v_wind: function( callback ) {
                if ( typeof cache[v_ext] !== "undefined" && cache[v_ext] !== '' ) {
                    //
                    // Pull from gradscache?
                    //
                    callback( null, cache[u_ext] );

                    stats.cacheHits++;
                } else {
                    v_url = url.parse(baseURL + modelURL + v_ext);
                    v_res = "";

                    if ( fnstraj_debug === "true" ) {
                        console.log( "HIT: " + modelURL + v_ext );
                    }

                    v_req = http.get({
                        hostname: v_url.hostname,
                        path: v_url.path
                    }, function( response ) {
                        response.setEncoding('utf8');

                        response.on("data", function( data ) {
                            v_res += data
                        });

                        response.on("end", function() {
                            callback(null, v_res);

                            stats.gradsHits++;
                        });
                    }).on("error", function() {
                       callback(true, null);
                    });
                }
            }
        }, function( error, results ) {
            if ( error ) {
                    console.log("Failed: flight #" + flight.options.flightID + " (grads connectivity failure)");

                parentCallback( error );
            } else {
                /////////////////////////////////////////////////////
                // Transform U & V Components to Wind Vector (m/s) //
                /////////////////////////////////////////////////////

                if ( results.u_wind.indexOf("GrADS Data Server") !== -1 && results.v_wind.indexOf("GrADS Data Server") !== -1 ) {
                    //
                    // This piece catches a little bug called a "GrADS Fail."
                    // What's that? your innocent mind ponders. It's the end,
                    // I answer, wallowing in all my lost predictions.
                    //
                    if ( fnstraj_debug === "true" ) {
                        console.log("\n\033[1;31mGrADS Fail:\033[0m");

                        var u_errorStart = results.u_wind.indexOf("because of the following error:<p>\n<b>") + 38;
                        var u_errorEnd   = results.u_wind.indexOf("</b><p>\nCheck the syntax of your request,");
                        var v_errorStart = results.u_wind.indexOf("because of the following error:<p>\n<b>") + 38;
                        var v_errorEnd   = results.u_wind.indexOf("</b><p>\nCheck the syntax of your request,");

                        var errorShown = false;

                        if ( u_errorStart !== -1 && u_errorEnd !== -1 ) {
                            var u_error = results.u_wind.substring(u_errorStart, u_errorEnd);
                            console.log("\033[0;31m" + u_error + "\033[0m\n");
                            errorShown = true;
                        }

                        if ( v_errorStart !== -1 && v_errorEnd !== -1 && errorShown === false ) {
                            var v_error = results.v_wind.substring(v_errorStart, v_errorEnd);
                            console.log("\033[0;31m" + v_error + "\033[0m\n");
                            errorShown = true;
                        }

                        if ( !errorShown ) {
                            console.log("\033[0;31mUnknown Error.\033[0m");
                        }
                    } else {
                        console.log("Failed: flight #" + flight.options.flightID + " (gradsfail)");
                    }

                    parentCallback( true );
                } else {
                    cache[u_ext] = results.u_wind;
                    cache[v_ext] = results.v_wind;
                    u_wind = results.u_wind.substring( results.u_wind.indexOf("[0],") + 5, results.u_wind.indexOf("\n", 30));
                    v_wind = results.v_wind.substring( results.v_wind.indexOf("[0],") + 5, results.v_wind.indexOf("\n", 30));
                    u_wind = u_wind.trim();
                    v_wind = v_wind.trim();

                    if ( u_wind === "9.999E20" || v_wind === "9.999E20" ) {
                        ///////////////////////////////////////////////
                        // CASE: FILL VALUE DETECTED, CANNOT ADVANCE //
                        ///////////////////////////////////////////////
                        console.log("Failed: flight #" + flight.options.flightID + " (Fill value caught)");
                    }

                    offset  = Math.atan2( v_wind, u_wind ) * degrees; // Is an offset from {below} value.
                    heading = ( 270 + offset ) - 180; // Proper direction - Pretty damned critical.
                    speed   = Math.sqrt( Math.pow(Math.abs(v_wind), 2) + Math.pow(Math.abs(u_wind), 2) );

                    newPoints = position.travel(table[table.length - 2], speed * 60, heading);

                    if ( model === "gfs" || model === "gfshd" ) {
                        ////////////////////////////////////
                        // CASE: CHECK LONGITUDE ACCURACY //
                        ////////////////////////////////////
                        if ( newPoints[1] > 180 ) {
                            newPoints[1] = newPoints[1] - 360;
                        }
                    }

                    table[table.length - 1].latitude = newPoints[0];
                    table[table.length - 1].longitude = newPoints[1];

                    parentCallback();
                }
            }
        });
    } else {
        /////////////////////////////////////
        // CASE: CORRUPT DATA VALUE CAUGHT //
        /////////////////////////////////////
        console.log("Failed: flight #" + flight.options.flightID + " (GrADS data was corrupt)");

        parentCallback( true );
    }
}