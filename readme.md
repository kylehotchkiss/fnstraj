# fnstraj
This repository represents the backend for fnstraj, [which is now a webapp for all to use!](http://fnstraj.org/). Feel free to browse around, but if you're looking for a quick trajectory report, the web interface is 1,000x easier than the (now broken) terminal interface.

The frontend code is proprietary for now. If I can get the predictor stable enough (i.e. several hundred lines of error checks), I'll consider publishing the data specs so it can used like an API. It would be pretty neat if this gets popular enough to warrant having its own iOS app. Alas, we dream on.

## Description (simple/tl;dr)
Does a ton of math, makes cool maps. 

## Description (technical)
This is written to run as a worker process (or daemon) on Heroku as the processing part of [http://fnstraj.org/](http://fnstraj.org/). It is written in Node.js; uses CouchDB for data services; and works with other neat APIs like Mailgun, The Google Geocoding API, 

## Special Thanks
* UKHAS, for your absolutely brilliant web resources on ballooning.
* Wolfram Alpha, for always knowing the answer to "Air Pressure at 80,000ft".
* Austin Jones, for helping me with these insanely complicated math questions every time I ask.
* Nathan Hotchkiss, for saying "cool" when I showed you this. And for listening to me talk about it for years.
* The friends who supported me in this, taking some time to at least see what it does!
* My old boss at work for encouraging me to try new technologies to make this project happen!