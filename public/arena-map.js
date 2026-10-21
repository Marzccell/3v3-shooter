'use strict';

// One map definition for the browser and the authoritative LAN server.
(function(root) {
  const scale = 1.25;
  const original = [
    {x:260,y:130,w:90,h:180}, {x:850,y:130,w:90,h:180},
    {x:520,y:260,w:160,h:60}, {x:520,y:400,w:160,h:60},
    {x:260,y:410,w:90,h:180}, {x:850,y:410,w:90,h:180}
  ].map(wall => ({...Object.fromEntries(Object.entries(wall).map(([key,value]) => [key,value*scale])),kind:'barrier'}));
  const extra = [
    {x:510,y:75,w:130,h:55,kind:'planter'},
    {x:510,y:770,w:130,h:55,kind:'planter'},
    {x:530,y:210,w:70,h:75,kind:'crate'},
    {x:530,y:615,w:70,h:75,kind:'crate'},
    {x:210,y:260,w:55,h:80,kind:'crate'},
    {x:210,y:560,w:55,h:80,kind:'crate'}
  ];
  const arena = Object.freeze({
    name:'Arena Sahabat', width:1500, height:900,
    spawnInset:125, spawnYs:Object.freeze([225,450,675]),
    walls:Object.freeze([...original,...extra,...extra.map(wall => ({...wall,x:1500-wall.x-wall.w}))].map(Object.freeze))
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = arena;
  else root.ArenaMap = arena;
})(globalThis);
