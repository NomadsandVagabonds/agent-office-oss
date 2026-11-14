// Scouting a floor: a list of places to stand and look, one a second, for --still.
//   LEVEL=roof LOOKS='[{"x":0,"z":0,"yaw":0,"pitch":0.3,"dist":9}]' rig/film shots/levelscout.mjs --fps 3 --still 0.67,1.67
import { levelShot } from './lib.mjs';
const looks = JSON.parse(process.env.LOOKS || '[]');
const shot = levelShot({ name: `scout-${process.env.LEVEL}`, base: process.env.BASE, level: process.env.LEVEL, hour: process.env.HOUR ? Number(process.env.HOUR) : 13, tape: process.env.TAPE, seconds: looks.length });
shot.arg.looks = looks;
shot.tick = function tick(t, i, arg) { const v = arg.looks[Math.min(arg.looks.length - 1, Math.floor(t))]; if (v && office.level && window.__lookAt !== Math.floor(t)) { window.__lookAt = Math.floor(t); office.level.look(v); } };
export default shot;
