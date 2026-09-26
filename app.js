const products=[
{id:1,name:"Nusantara Signature",price:250000,icon:"🍾"},
{id:2,name:"Nusantara Reserve",price:425000,icon:"🥃"},
{id:3,name:"Nusantara Premium",price:325000,icon:"🍷"},
{id:4,name:"Nusantara Limited",price:575000,icon:"🍸"}];
let cart=JSON.parse(localStorage.getItem("nusantara_cart")||"[]");
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
function renderProducts(){document.querySelector("#products").innerHTML=products.map(p=>`<article class="product"><div class="product-image">${p.icon}</div><h3>${p.name}</h3><div class="price">${rupiah(p.price)}</div><button class="add" onclick="addToCart(${p.id})">Tambah</button></article>`).join("")}
function addToCart(id){const p=products.find(x=>x.id===id),i=cart.find(x=>x.id===id);if(i)i.qty++;else cart.push({...p,qty:1});localStorage.setItem("nusantara_cart",JSON.stringify(cart));renderCart()}
function renderCart(){const e=document.querySelector("#cart");if(!cart.length){e.textContent="Keranjang masih kosong.";return}const total=cart.reduce((s,x)=>s+x.price*x.qty,0);e.innerHTML=cart.map(x=>`${x.name} × ${x.qty} — ${rupiah(x.price*x.qty)}`).join("<br>")+`<hr><strong>Total: ${rupiah(total)}</strong>`}
renderProducts();renderCart();