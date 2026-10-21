'use strict';

const arena = require('./public/arena-map');
const {width:WIDTH,height:HEIGHT,walls} = arena;
const RADIUS = 18;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const idle = () => ({mx:0,my:0,ax:1,ay:0,fire:false,dash:false});

function spawn(player, index = 0) {
  Object.assign(player, {
    x:player.team === 'blue' ? arena.spawnInset : WIDTH-arena.spawnInset, y:arena.spawnYs[index % 3],
    hp:100, angle:player.team === 'blue' ? 0 : Math.PI,
    cooldown:0, dashCooldown:0, dashTime:0, invulnerable:1.2,
    deadUntil:0, lastInput:0, input:idle()
  });
}

function overlaps(x, y, radius, wall) {
  const dx = x - clamp(x, wall.x, wall.x + wall.w);
  const dy = y - clamp(y, wall.y, wall.y + wall.h);
  return dx * dx + dy * dy < radius * radius;
}

function move(player, dx, dy) {
  const x = clamp(player.x + dx, RADIUS, WIDTH - RADIUS);
  if (!walls.some(wall => overlaps(x, player.y, RADIUS, wall))) player.x = x;
  const y = clamp(player.y + dy, RADIUS, HEIGHT - RADIUS);
  if (!walls.some(wall => overlaps(player.x, y, RADIUS, wall))) player.y = y;
}

function step(room, dt, now) {
  for (const player of room.players) {
    if (player.hp <= 0) {
      if (now >= player.deadUntil) spawn(player, room.players.filter(p => p.team === player.team).indexOf(player));
      continue;
    }
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const input = player.input;
    const length = Math.hypot(input.mx, input.my);
    if (input.dash && player.dashCooldown === 0 && length > 0) {
      player.dashTime = .15;
      player.dashCooldown = 2;
    }
    input.dash = false;
    const slices = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < slices; i++) {
      const speed = player.dashTime > 0 ? 640 : 220;
      const distance = speed * dt / slices / Math.max(1, length);
      move(player, input.mx * distance, input.my * distance);
      player.dashTime = Math.max(0, player.dashTime - dt / slices);
    }
    const aimLength = Math.hypot(input.ax, input.ay);
    if (aimLength > .01) player.angle = Math.atan2(input.ay, input.ax);
    if (input.fire && player.cooldown === 0 && aimLength > .01) {
      const vx = Math.cos(player.angle), vy = Math.sin(player.angle);
      room.bullets.push({x:player.x,y:player.y,vx:vx*620,vy:vy*620,team:player.team,owner:player.id,life:1.7});
      player.cooldown = .32;
    }
  }
  room.bullets = room.bullets.filter(bullet => {
    const slices = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < slices; i++) {
      bullet.x += bullet.vx * dt / slices;
      bullet.y += bullet.vy * dt / slices;
      bullet.life -= dt / slices;
      if (bullet.life <= 0 || bullet.x < 0 || bullet.x > WIDTH || bullet.y < 0 || bullet.y > HEIGHT || walls.some(wall => overlaps(bullet.x, bullet.y, 5, wall))) return false;
      const target = room.players.find(player => player.team !== bullet.team && player.hp > 0 && Math.hypot(player.x - bullet.x, player.y - bullet.y) <= RADIUS + 5);
      if (target) {
        if (target.invulnerable <= 0) {
          target.hp = Math.max(0, target.hp - 25);
          if (target.hp === 0) {
            target.deadUntil = now + 3;
            target.input = idle();
            room.score[bullet.team]++;
          }
        }
        return false;
      }
    }
    return true;
  });
}

module.exports = {arena, walls, clamp, spawn, step};
