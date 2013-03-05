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
        path += "_all_docs?include_docs=true&ascending=true";
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
            var results;

            try {
                results = JSON.parse( buffer );
            } catch ( error ) { }

            if ( typeof callback !== "undefined" && typeof results !== "undefined" ) {
                callback( results );
            } else {
                callback( false, true );
            }
        });
    }).on("error", function() {
        callback( false, true );
    });
};


////////////////////////////
// DATABASE WRITE REQUEST //
////////////////////////////
exports.write = function( path, data, callback ) {
    exports.read( path, function( results ) {
        if ( !results.error ) {
            ////////////////////////////////
            // CASE: DATA EXISTS, REWRITE //
            ////////////////////////////////
            data._rev = results._rev;
        }

        var buffer = "";
        var couchdb = http.request({
            auth: db_user + ":" + db_pass,
            host: db_host,
            path: path,
            port: db_port,
            headers: { "Content-Type": "application/json" },
            method: "PUT"
        }, function( response ) {
            response.setEncoding('utf8');

            response.on("data", function( data ) {
                buffer += data;
            });

            response.on("end", function() {
                var results;

                try {
                    results = JSON.parse( buffer );
                } catch ( error ) { }

                if ( typeof callback !== "undefined" && typeof results === "object" ) {
                    if ( typeof results.rev !== "undefined" ) {
                        callback();
                    } else {
                        callback( true );
                    }
                } else {
                    callback( true );
                }
            });
        }).on("error", function() {
              callback( true );
        });

        couchdb.write( JSON.stringify(data) );
        couchdb.end();
    });
};


/////////////////////////////
// DATABASE DELETE REQUEST //
/////////////////////////////
exports.remove = function( path, callback ) {
    exports.read( path, function( results, error ) {
        if (( typeof error !== "undefined" && error ) || results.error ) {
            if ( typeof callback !== "undefined" ) {
                callback( false, true );
            }
        } else {
            var revision = results._rev;

            var couchdb = http.request({
                auth: db_user + ":" + db_pass,
                host: db_host,
                path: path,
                port: db_port,
                headers: { "If-Match": revision },
                method: "DELETE"
            }, function( response ) {
                response.on("end", function() {
                    if ( typeof callback !== "undefined") {
                        callback();
                    }
                });
            }).on("error", function() {
                if ( typeof callback !== "undefined" ) {
                    callback( false, true );
                }
            });

            couchdb.end();
        }
    });
};