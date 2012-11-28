/**
 *
 * fnstraj | GrADS Functions
 * Copyright 2011-2012 Hotchkissmade
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


//
// automatically pick model :P
//


exports.wind = function( frame, time, model, table, cache, stats, parentCallback ) {
    var gfs_hourset, gfs_offset, now, lev, u_ext, v_ext;
    var radians = Math.PI / 180;
    var degrees = 180 / Math.PI;
    var baseURL = "http://nomads.ncep.noaa.gov:9090/dods/";



    now = new Date( time );
    now.setHours( now.getHours() - 5 ); // Probably timezone related fix? Does this need to choose the timezone? Should we not use GMT below?



    ////////////////////////////
    // Lazy null-dreamcatcher //
    ////////////////////////////
    for ( var i = 0; i < arguments.length; i++ ) {
        if ( arguments[i] === null || arguments === NaN ) {
            console.log("\033[0;31mlogicfail: NULL caught/grads.js.\033[0m");

            parentCallback( true );

            break;
        }

        //
        // quit loop exec via var or something (can't fit in logic flow)
        //
    }



    //////////////////////////////////
    // Offset Determination for RAP //
    //////////////////////////////////
    var rap_offset = Math.round(( now.getUTCMinutes() / 60) * 18 );



    ///////////////////////////////////////////////
    // Hourset & Offset Determinaion for GFS(HD) //
    ///////////////////////////////////////////////
    if ( model === "gfs" || model === "gfshd" ) {
        var hour = now.getUTCHours();

        if ( hour < 6 ) {
            gfs_hourset = 0;
        } else if ( hour >= 6 && hour < 12 ) {
            gfs_hourset = 6;
        } else if ( hour >= 12 && hour < 18 ) {
            gfs_hourset = 12;
        } else if ( hour >= 18 && hour < 24 ) {
            gfs_hourset = 18;
        }

        gfs_offset = Math.round(( hour - gfs_hourset ) / 3);
        gfs_hourset = ( gfs_hourset < 10 ) ? "0" + gfs_hourset : gfs_hourset;
    }



    ///////////////////////////
    // Date/Time Corrections //
    ///////////////////////////
    var year        = now.getUTCFullYear();
    var month       = ( now.getUTCMonth() < 9 ) ? "0" + ( now.getUTCMonth() + 1 ) : ( now.getUTCMonth() + 1); // wtf why is this one month in the future
    var date        = ( now.getUTCDate() < 10 ) ? "0" + now.getUTCDate() : now.getUTCDate(); // Check this on the 10th of the month (appears fine)
    var hour        = ( now.getUTCHours() < 10 ) ? "0" + now.getUTCHours() : now.getUTCHours(); // Check this on the 10th hour (utc?)



    ///////////////////////////////////
    // Coordinate Mapping (to Model) //
    ///////////////////////////////////
    if ( model === "rap" ) {
        latitude  = Math.floor((( frame.latitude - 16.281 ) / ( 58.02525454545 )) * 226 ); // WRONG.
        longitude = Math.floor((( -139.85660300000 - ( frame.longitude + 57.69083517955 )) / -139.85660300000 ) * 427 ); // WRONG.
        modelURL = "rap/rap" + year + month + date + "/rap_" + hour + "z.ascii?";



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
        latitude  = Math.floor( (( frame.latitude + 180 ) / 360 ) * 180 );
        longitude = Math.floor( frame.longitude + 180 );
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
        latitude  = Math.floor((( frame.latitude + 90 ) / ( 180 )) * 360 );
        longitude = Math.floor(( frame.longitude / 359.5 ) / 719 );
        //modelURl =



        //////////////////////////////////
        // Altitude Level Determination //
        //////////////////////////////////

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
            console.log("\033[0;31mgradsfail: Request Error (can you reach http://nomads.ncep.noaa.gov:9090/ ?)\033[0m");

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
                console.log("\033[0;31mgradsfail: Unknown Error (probably time offset).\033[0m");

                parentCallback( true );
            } else {
                cache[u_ext] = results.u_wind;
                cache[v_ext] = results.v_wind;
                u_wind = results.u_wind.substring( results.u_wind.indexOf("[0],") + 5, results.u_wind.indexOf("\n", 30));
                v_wind = results.v_wind.substring( results.v_wind.indexOf("[0],") + 5, results.v_wind.indexOf("\n", 30));
                u_wind = u_wind.trim();
                v_wind = v_wind.trim();

                offset     = Math.atan2( v_wind, u_wind ) * degrees; // Is an offset from {below} value.
                heading    = ( 270 + offset ) - 180; // Proper direction - Pretty damned critical.
                speed      = Math.sqrt( Math.pow(Math.abs(v_wind), 2) + Math.pow(Math.abs(u_wind), 2) );

                // Can I be moved into primary loop via callback of any sort?
                newPoints = position.travel(table[table.length - 2 ], speed * 60, heading);
                table[table.length - 1].latitude = newPoints[0];
                table[table.length - 1].longitude = newPoints[1];
                // end moveme

                parentCallback();
            }
        }
    });
}