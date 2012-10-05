# fnstraj
This is the hardest thing I've ever done.  Node.js based trajectory predictor. First (and only) trajectory predictor running on NOAA RAP (as far as I know, please correct me if I'm wrong)


## Usage
This repo is more for people who are interested in hacking the code or learning it how it works. To use this predictor, head on over to http://trajectory.flynearspace.org/. Enjoy :)

1. You'll need Node.js and Google Earth to test.
2. Fork this repo.
3. `npm install` in the directory.
4. `node app.js [your latitude] [your longitude] [your altitude]`
5. You will either get an error message or see a list of coordinates. If you see an error message that says something about a time offset, and you don't live in the EST/EDT timezone, please leave a bug report, as I think this may be a bug. If you see a list of coordinates, look in your `exports/` folder, double click the KML - TADA, kinda a trajectory :)


## Hacking
I'm trying to take as minimalistic an approach towards feature cuft as possible. I would personally like to ensure that the core of this app is the highest quality work I am capable of producing. This code has been through two major rewrites before the alpha ever existed! if you would like to hack at the code, go for it! It's not my intension to bring every great feature upstream, but I would love to see what people can turn this codebase into and how they can make it work better for their personal flights and tracking purposes.


## Special Thanks
* UKHAS, for your absolutely brilliant web resources on ballooning.
* Wolfram Alpha, for always knowing the answer to "Air Pressure at 80,000ft".
* Austin Jones, for helping me with these insanely complicated math questions every time I ask.
* Nathan Hotchkiss, for saying "cool" when I showed you this. And for listening to me talk about it for years.
* The friends who supported me in this, taking some time to at least see what it does!