/**
 *
 * fnstraj | Simple CouchDB Wrapper
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * Needs checkup (HEAD) check to verify that we're good to
 * continue forward with Daemon execution.
 *
 */

var url = require("url");
var http = require("http");



//////////////////////////////////
// GRAB ENVIRONMENTAL VARIABLES //
//////////////////////////////////
var db_host = process.env.COUCHDB_HOST;
var db_port = process.env.COUCHDB_PORT;
var db_user = process.env.COUCHDB_USER;
var db_pass = process.env.COUCHDB_PASS;



///////////////////////////
// DATABASE READ REQUEST //
///////////////////////////
exports.read = function( path, callback ) {
    if ( path.substr(-1) === "/" ) {
        // CASE: URL is a listing OR view... what shall we do

        path += "_all_docs?include_docs=true";
    }

    var buffer = "";
    var couchdb = http.get({
        auth: db_user + ":" + db_pass,
        host: db_host,
        path: path, 
        port: db_port
    }, function( response ) {
        response.setEncoding('utf8');

        response.on("data", function( data ) {
            buffer += data;
        });

        response.on("end", function() {
            var results = JSON.parse( buffer );

            callback( results );
        });
    }).on("error", function() {
        callback( false, true );
    });
};



////////////////////////////
// DATABASE WRITE REQUEST //
////////////////////////////
exports.write = function( path, data, callback ) {
    // Critical: Can't support amends!
    exports.read( path, function( results ) {
        if ( !results.error ) {
            // Data is being rewriten - how do we change the URL?

            if ( data._rev === results._rev ) {
                // CASE: Revisions match

            }
        }

        var couchdb = http.request({
            auth: db_user + ":" + db_pass,
            host: db_host,
            path: path,
            port: db_port,
            headers: { "Content-Type": "application/json" },
            method: "PUT"
        }, function() {
            if ( typeof callback !== "undefined") {
                callback();
            }
        }).on("error", function() {
              callback( false, true );
        });

        couchdb.write( JSON.stringify(data) );
        couchdb.end();
    });
};



/////////////////////////////
// DATABASE DELETE REQUEST //
/////////////////////////////
exports.remove = function( path, rev, callback ) {
    var couchdb = http.request({
        auth: db_user + ":" + db_pass,
        host: db_host,
        path: path,
        port: db_port,
        headers: { "If-Match": rev },
        method: "DELETE"
    }, function() {
        if ( typeof callback !== "undefined") {
            callback();
        }
    }).on("error", function() {
        if ( typeof callback !== "undefined" ) {
            callback( false, true );
        }
    });

    couchdb.end();
};