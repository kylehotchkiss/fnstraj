# fnstraj
This repository represents the backend for fnstraj, [which is now a webapp for all to use!](http://fnstraj.org/). Feel free to browse around, but if you're looking for a quick trajectory report, the web interface is 1,000x easier than the (now broken) terminal interface.

The frontend is available in another repo: [/kylehotchkiss/fnstraj-frontend](/kylehotchkiss/fnstraj-frontend)

## Description (simple/tl;dr)
Predicts the landing location of a weather balloon's payload. This is the code that makes it run as a daemon.

## Description (technical)
This is written to run as a worker process (or daemon) on Heroku as the processing part of [http://fnstraj.org/](http://fnstraj.org/). It is written in Node.js; uses CouchDB for data services; and works with other neat APIs like Mailgun, The Google Geocoding API, 

## Special Thanks
* UKHAS, for your absolutely brilliant web resources on ballooning.
* Wolfram Alpha, for always knowing the answer to "Air Pressure at 80,000ft".
* Austin Jones, for helping me with these insanely complicated math questions every time I ask.
* Nathan Hotchkiss, for saying "cool" when I showed you this. And for listening to me talk about it for years.
* The friends who supported me in this, taking some time to at least see what it does!
* My old boss at work for encouraging me to try new technologies to make this project happen!