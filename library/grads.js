/**
 *
 * fnstraj | GrADS Functions
 * Copyright 2011-2012 Hotchkissmade
 * Released under the GPL
 *
 * grads.wind - return wind speed and direction.
 *
 */
var url   = require("url");
var http  = require("http");
var async = require('async');
var position = require('./position.js');



exports.wind = function( frame, time, model, table, cache, stats, parentCallback ) {
    var lev, u_ext, v_ext;
    var radians = Math.PI / 180;
    var degrees = 180 / Math.PI;
    var baseURL = "http://nomads.ncep.noaa.gov:9090/dods/";



    ///////////////////////////
    // Date/Time Corrections //
    ///////////////////////////    
    now    = new Date( time );
    now.setHours( now.getHours() - 5 ); // Probably timezone related fix?
    year   = now.getUTCFullYear();
    month  = ( now.getUTCMonth() < 10 ) ? "0" + ( now.getUTCMonth() + 1 ) : ( now.getUTCMonth() + 1);
    date   = ( now.getUTCDate() < 10 ) ? "0" + now.getUTCDate() : now.getUTCDate();    
    hour   = ( now.getUTCHours() < 10 ) ? "0" + now.getUTCHours() : now.getUTCHours();
    minute = Math.round(( now.getUTCMinutes() / 60) * 18 );


 
    ///////////////////////////////////
    // Coordinate Mapping (to Model) //
    ///////////////////////////////////
    if ( model === "rap" ) {
        //
        // Investigate an *actual* formula for this, champ. Not linear.
        // 
        latitude  = Math.floor(( ( frame.latitude - 16.281 ) / ( 58.02525454545 ) ) * 226 ); // WRONG.
        longitude = Math.floor(( ( -139.85660300000 - ( frame.longitude + 57.69083517955 )) / -139.85660300000 ) * 427 ); // WRONG.

        modelURL = "rap/rap" + year + month + date + "/rap_" + hour + "z.ascii?";
    } else if ( model === "gfs" ) {
        // pick right forecast hourset
        
        modelURL = "gfs/gfs" + year + month + date + "/gfs_" + hour + "z.ascii?";
    } else if ( model === "gfshd" ) {

    }



    //////////////////////////////////
    // Altitude Level Determination //
    //////////////////////////////////
    if ( frame.altitude < 12000 ) {
        level = Math.round(( frame.altitude / 12000 ) * 36); // Does this apply to GFS/GFSHD?

        u_ext = "ugrdprs[" + minute + "][" + level + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrdprs[" + minute + "][" + level + "][" + latitude + "][" + longitude + "]";
    } else if ( frame.altitude >= 12000 && frame.altitude < 14000 ) {
        u_ext = "ugrd180_150mb[" + minute + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrd180_150mb[" + minute + "][" + latitude + "][" + longitude + "]";
    } else if ( frame.altitude >= 14000 && frame.altitude < 15000 ) {
        u_ext = "ugrd150_120mb[" + minute + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrd150_120mb[" + minute + "][" + latitude + "][" + longitude + "]";
    } else if ( frame.altitude >= 15000 && frame.altitude < 17000 ) {
        u_ext = "ugrd120_90mb[" + minute + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrd120_90mb[" + minute + "][" + latitude + "][" + longitude + "]";
    } else if ( frame.altitude >= 17000 && frame.altitude < 19000 ) {
        u_ext = "ugrd90_60mb[" + minute + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrd90_60mb[" + minute + "][" + latitude + "][" + longitude + "]";
    } else if ( frame.altitude >= 19000 && frame.altitude < 24000 ) {
        u_ext = "ugrd60_30mb[" + minute + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrd60_30mb[" + minute + "][" + latitude + "][" + longitude + "]";
    } else if ( frame.altitude >= 24000 ) {
        u_ext = "ugrd30_0mb[" + minute + "][" + latitude + "][" + longitude + "]";
        v_ext = "vgrd30_0mb[" + minute + "][" + latitude + "][" + longitude + "]";
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
            console.log("Grads Fail");
                
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
                console.log("gradsfail fuuuuuu");
                
                parentCallback( true );
            } else {
                u_wind = results.u_wind.substring( results.u_wind.indexOf("[0],") + 5, results.u_wind.indexOf("\n", 30));
                v_wind = results.v_wind.substring( results.v_wind.indexOf("[0],") + 5, results.v_wind.indexOf("\n", 30));
                u_wind = u_wind.trim();
                v_wind = v_wind.trim();
             
                cache[u_ext] = u_wind;
                cache[v_ext] = v_wind;
                
                heading = Math.atan2( v_wind, u_wind ) * degrees;
                speed = Math.sqrt( Math.pow(Math.abs(v_wind), 2) + Math.pow(Math.abs(u_wind), 2) );
                
                // Can I be moved into primary loop via callback of any sort?
                newPoints = position.travel(table[table.length - 2 ], speed * 60, heading);                           
                table[table.length - 1].latitude = newPoints[0];
                table[table.length - 1].longitude = newPoints[1];
                // end moveme
                
                console.log(newPoints[1] + "," + newPoints[0] + "," + table[table.length - 1].altitude );
                
                parentCallback();
            }
        }
    });
}