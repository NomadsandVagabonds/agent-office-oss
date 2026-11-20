import { stockIds, stockLabel, readStock } from './stock.js';
import { developEdition, editionNames } from './editions.js';
import { drawPositive } from './positive.js';
const select=document.querySelector('#stock'), prints=document.querySelector('#prints');
for(const id of stockIds)select.add(new Option(stockLabel(id),id));
function show(id){
  const source=readStock(id), names=['Original',...editionNames(source)];
  const cards=names.map((name,i)=>{
    const fig=document.createElement('figure'),canvas=document.createElement('canvas');
    canvas.height=canvas.width=128;
    drawPositive(canvas.getContext('2d'),i?developEdition(source,i-1):source);
    const cap=document.createElement('figcaption');cap.textContent=name;
    fig.append(canvas,cap);return fig;
  });
  prints.replaceChildren(...cards);select.value=id;
  document.querySelector('#title').textContent=stockLabel(id);
  const q=new URLSearchParams({chairstudy:'1',seed:'7',themes:'yellow',count:'1',depths:'1',cast:'none',pursuer:'0',graphics:'high',vhs:'1',stock:id});
  document.querySelector('#try').href='../backrooms.html?'+q;
  history.replaceState(null,'','#'+id);
}
const shift=n=>show(stockIds[(stockIds.indexOf(select.value)+n+stockIds.length)%stockIds.length]);
document.querySelector('#previous').onclick=()=>shift(-1);document.querySelector('#next').onclick=()=>shift(1);
select.onchange=()=>show(select.value);show(stockIds.includes(location.hash.slice(1))?location.hash.slice(1):'desk');
