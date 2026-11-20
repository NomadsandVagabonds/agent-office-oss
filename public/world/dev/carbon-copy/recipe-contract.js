// The model picks parts and colors. Dimensions, animation and collision belong to the game.
export const traits=['heavy','ringing','rolling'];
export const bodies=['box','low oval','ball','upright column','horizontal tube','bowl','slab','cone','U frame'];
export const fittings=['shell','stalk eyes','eyes','ears','muzzle','beak','horns','wings','tail','four legs','two legs','fins','wheels','bell','screen','handle','spout','lid','keys','leaves','flower','antenna','weight','ladder','rotor','sail','clock','bucket','fork','feet'];
export const palette={red:'#c04c3c',orange:'#d58342',yellow:'#e8bd4b',brass:'#b39850',cream:'#e1d7b5',white:'#e9e7d6',gray:'#868a87',silver:'#a8b2b2',black:'#373d39',green:'#669369',teal:'#438984',blue:'#507daa',purple:'#9969a0',pink:'#dc9aae',brown:'#96684b'};
const pick=values=>({type:'string',enum:values});
export const schema={type:'object',additionalProperties:false,properties:{
  body:pick(bodies),color:pick(Object.keys(palette)),accent:pick(Object.keys(palette)),
  fittings:{type:'array',minItems:1,maxItems:4,items:pick(fittings)},
  trait:pick(['ordinary',...traits])
},required:['body','color','accent','fittings','trait']};
export const instructions='Art direct a small toy of the requested object. Choose the nearest body silhouette, main color, accent and one to four distinctive fittings from the allowed parts. For example a turtle has a low oval body with shell, four legs, tail and eyes. A rotorcraft has a horizontal tube body with rotor, tail and feet. For a request containing an accessory keep the main object and put the accessory on it. Use ordinary for most things. Heavy, rolling and ringing describe real gameplay behavior. Respond only with the JSON fields body, color, accent, fittings, trait.';
