// Gemini's two custom studio characters, shared by the homepage and co-op.
export const GUEST_PRESETS = Object.freeze([
  { id:'yellow-alien', label:'Yellow Alien', look:{species:'alien',skin:'#e0a638',hair:'bald',hairColor:'#241608',facial:'none',outfit:'consul',outfitColor:'#dfa22e',accessory:'goggles'} },
  { id:'pink-cowgirl', label:'Pink Cowgirl', look:{species:'human',skin:'#e3aa84',hair:'braids',hairColor:'#db7093',facial:'lashes',outfit:'tunic',outfitColor:'#e88fb0',accessory:'cowboy'} },
].map(p=>Object.freeze({...p,look:Object.freeze(p.look)})));
export const guestPreset = id => GUEST_PRESETS.find(p=>p.id===id);
