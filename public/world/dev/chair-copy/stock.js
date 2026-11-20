// The copy lab reads the game's prop recipes and the floor versions that replace them.
import { PROPS } from '../../props/index.js';
import { coin, keycard } from '../../props/loot.js';
import { ICON_MODELS } from '../../backrooms/inventory-items.js';
import { ITEM_DEFS } from '../../backrooms/inventory-state.js';
import { chairVox, crtVox, keyboardVox, keyboardKeysVox, WORKSTATION } from '../../backrooms/workstation.model.js';
import { deskVox, LEVEL_DESK } from '../../backrooms/desk.model.js';
import { cabinetVox, boxesVox, STORAGE } from '../../backrooms/storage.model.js';
import { binVox, trolleyVox, coolerVox, SMALLS } from '../../backrooms/smalls.model.js';
import { whole, CABINETS } from '../../backrooms/cabinets.model.js';
import { Vox, VOXEL, M } from '../../vox/vox.js';
import { CLOTH } from './misprint.js';

const floorModels = {
  chair:[()=>chairVox({colour:CLOTH}),WORKSTATION.scale], desk:[deskVox,LEVEL_DESK.scale], crt:[crtVox,WORKSTATION.scale],
  keyboard:[()=>keyboardVox().stamp(keyboardKeysVox()),WORKSTATION.scale], cabinet:[cabinetVox,STORAGE.scale],
  boxes:[()=>boxesVox(0),STORAGE.scale], bin:[binVox,SMALLS.scale], trolley:[trolleyVox,SMALLS.scale], cooler:[coolerVox,SMALLS.scale],
  coin:[coin,1], keycard:[keycard,1],
};
for (const kind of CABINETS.kinds) floorModels['file-'+kind]=[()=>whole(kind),CABINETS.scale];
const labels = {cabinet:'Filing cabinet',crt:'CRT monitor',desklamp:'Desk lamp',camera:'Camcorder','torch-prepared':'Taped flashlight',liftleaf:'Elevator door leaf',coffeemachine:'Coffee machine',acunit:'Air conditioner',roombadock:'Roomba dock',boxes:'Carton stack',liftframe:'Elevator frame',planttall:'Tall plant',bigboard:'Operations board',floorlamp:'Floor lamp',taskboard:'Task board',cafetable:'Café table',sidetable:'Side table',catbed:'Cat bed',fuelstand:'Fuel stand',trophycase:'Trophy case',discoball:'Disco ball',callplate:'Elevator call plate',liftpanel:'Elevator panel',vacantsign:'Vacancy sign',coatrack:'Coat rack',doormat:'Door mat'};
for(const kind of CABINETS.kinds) labels['file-'+kind]=({two:'Two-drawer file',three:'Three-drawer file',four:'Four-drawer file',tall:'Five-drawer file',lateral:'Lateral file'})[kind];
export const stockLabel = id => labels[id] || ITEM_DEFS[id]?.name || id[0].toUpperCase()+id.slice(1);
export const stockIds = [...new Set([...Object.keys(PROPS),...Object.keys(ICON_MODELS),...Object.keys(floorModels)])].sort((a,b)=>stockLabel(a).localeCompare(stockLabel(b)));

// Pocket items are sculpted as polygons. Sample their actual painted triangles, including narrow
// handles and the white edges of paper, at a finer pitch than the full-size office furniture.
function pocket(id) {
  const b={pos:[],nor:[],uv:[],alb:[],ao:[],idx:[]};
  ICON_MODELS[id](b,1,{grounded:true});
  const vox=new Vox(), sub=3, byte=l=>Math.round(255*Math.min(1,l<=.0031308?12.92*l:1.055*l**(1/2.4)-.055));
  for(let i=0;i<b.idx.length;i+=3) {
    const a=b.idx[i]*3, c=b.idx[i+1]*3, d=b.idx[i+2]*3;
    const u=[0,1,2].map(k=>b.pos[c+k]-b.pos[a+k]), v=[0,1,2].map(k=>b.pos[d+k]-b.pos[a+k]);
    const n=Math.max(1,Math.ceil(sub*Math.max(Math.hypot(...u),Math.hypot(...v),Math.hypot(u[0]-v[0],u[1]-v[1],u[2]-v[2]))*1.45));
    const ink=M((byte(b.alb[a])<<16)|(byte(b.alb[a+1])<<8)|byte(b.alb[a+2]),0);
    for(let j=0;j<=n;j++)for(let k=0;k<=n-j;k++) {
      const t=j/n,s=k/n;
      vox.set(Math.floor((b.pos[a]+u[0]*t+v[0]*s)*sub),Math.floor((b.pos[a+1]+u[1]*t+v[1]*s)*sub),Math.floor((b.pos[a+2]+u[2]*t+v[2]*s)*sub),ink);
    }
  }
  return {vox,cell:VOXEL/sub};
}

export function readStock(id) {
  if (!stockIds.includes(id)) throw Error('Unknown copy stock '+id);
  let vox,cell=VOXEL;
  if (floorModels[id]) { const [make,scale]=floorModels[id]; vox=make(); cell*=scale; }
  else if (ICON_MODELS[id]) ({vox,cell}=pocket(id));
  else vox=PROPS[id].make({id:id+':backrooms',type:id});
  let bounds=vox.bounds();
  if(bounds.y0!==0){vox=new Vox().stamp(vox,0,-bounds.y0,0);bounds=vox.bounds();}
  return {id,vox,cell,bounds};
}
