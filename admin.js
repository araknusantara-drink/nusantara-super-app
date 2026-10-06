const SUPABASE_URL = "https://xevkttwbzfosxmslnrku.supabase.co";
const SUPABASE_KEY = "sb_publishable_nqqizWWCx2Wztrdc1ya4XQ_BHaRWM0N";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let user = null;
let me = null;
let products = [];
let shift = null;
let paymentRealtimeChannel = null;

const $ = id => document.getElementById(id);

function showError(message) {
  const box = $("access");

  if (!box) return;

  box.classList.add("error");

  box.innerHTML = `
    <strong>Dashboard gagal dimuat.</strong>
    <br><br>
    ${String(message)}
    <br><br>
    <button onclick="location.reload()">🔄 Coba lagi</button>
  `;
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}


/* =========================
   START
========================= */

async function start() {

  try {

    if (!window.supabase) {
      throw new Error(
        "Library Supabase tidak berhasil dimuat."
      );
    }

    $("access").textContent =
      "Memeriksa login...";

    const sessionResult =
      await db.auth.getSession();

    if (sessionResult.error) {
      throw sessionResult.error;
    }

    user =
      sessionResult.data?.session?.user || null;

    if (!user) {
      deny("Silakan login terlebih dahulu.");
      return;
    }


    $("access").textContent =
      "Memeriksa hak akses Owner...";


    const profileResult =
      await db
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();


    if (profileResult.error) {
      throw profileResult.error;
    }

    if (!profileResult.data) {
      deny("Profil pengguna tidak ditemukan.");
      return;
    }


    me = profileResult.data;


    if (
      !["owner", "admin", "staff"].includes(me.role)
      || me.is_active !== true
    ) {

      deny(
        "Akses ditolak. Dashboard hanya untuk Owner/Admin/Staff."
      );

      return;
    }


    $("access").hidden = true;
    $("app").hidden = false;


    setupTabs();
    setupButtons();
    setupPaymentRealtime();


    await loadProducts();
    await loadDashboard();
    await loadOrders();
    await loadCustomers();
    await loadPayments();
    await loadPromos();
    await loadMovements();
    await loadShifts();
    await loadSettings();


  } catch (error) {

    console.error("DASHBOARD ERROR:", error);

    showError(
      error?.message ||
      "Terjadi kesalahan saat memuat dashboard."
    );

  }

}


/* =========================
   ACCESS
========================= */

function deny(message) {

  $("access").innerHTML = `
    <strong>${esc(message)}</strong>
    <br><br>
    <a href="./">Kembali ke website</a>
  `;

}


/* =========================
   TABS
========================= */

function setupTabs() {

  document
    .querySelectorAll("#tabs button")
    .forEach(button => {

      button.onclick = () => {

        document
          .querySelectorAll(".tab")
          .forEach(section => {
            section.hidden = true;
          });

        const target =
          $(button.dataset.tab);

        if (target) {
          target.hidden = false;
        }

      };

    });

}


/* =========================
   BUTTONS
========================= */

function setupButtons() {

  $("logout").onclick = async () => {

    await db.auth.signOut();

    location.href = "./";

  };


  $("refreshDash").onclick =
    loadDashboard;

  $("period").onchange =
    loadDashboard;


  $("addProduct").onclick = () => {

    $("productForm").hidden = false;

    clearProductForm();

  };


  $("cancelProduct").onclick = () => {

    $("productForm").hidden = true;

  };


  $("productForm").onsubmit =
    saveProduct;


  $("refreshOrders").onclick =
    loadOrders;

  $("closeOrderDetail").onclick = () => { $("orderDetail").hidden = true; };


  $("addMove").onclick = () => {

    $("moveForm").hidden = false;

  };


  $("cancelMove").onclick = () => {

    $("moveForm").hidden = true;

  };


  $("moveForm").onsubmit =
    saveMovement;


  $("refreshCustomers").onclick =
    loadCustomers;


  $("customerSearch").oninput =
    loadCustomers;


  $("refreshPayments").onclick =
    loadPayments;

  $("addPromo").onclick = () => { $("promoForm").hidden = false; clearPromoForm(); };
  $("cancelPromo").onclick = () => { $("promoForm").hidden = true; };
  $("promoForm").onsubmit = savePromo;


  $("openShift").onclick =
    openShift;


  $("closeShift").onclick =
    closeShift;


  $("settingsForm").onsubmit =
    saveSettings;

  const resetSection = $("resetOrdersSection");
  const resetButton = $("resetTestOrdersButton");

  if (me?.role === "owner") {
    resetSection.hidden = false;
    resetButton.onclick = resetTestOrders;
  }

  $("getStoreLocation").onclick = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung lokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        $("storeLat").value = pos.coords.latitude.toFixed(7);
        $("storeLng").value = pos.coords.longitude.toFixed(7);
      },
      err => alert("Lokasi toko gagal diambil: " + err.message),
      { enableHighAccuracy:true, timeout:15000 }
    );
  };

}


/* =========================
   PRODUCTS
========================= */

async function loadProducts() {

  const result =
    await db
      .from("products")
      .select("*")
      .order("id", { ascending: false });


  if (result.error) {

    $("productRows").innerHTML = `
      <tr>
        <td colspan="6">
          ${esc(result.error.message)}
        </td>
      </tr>
    `;

    return;

  }


  products =
    result.data || [];


  $("activeProducts").textContent =
    products.filter(p => p.is_active).length;


  $("stockCount").textContent =
    products.reduce(
      (total, product) =>
        total + Number(product.stock || 0),
      0
    );


  $("mproduct").innerHTML =
    products.map(product => `
      <option value="${product.id}">
        ${esc(product.name)}
      </option>
    `).join("");


  $("productRows").innerHTML =
    products.map(product => `

      <tr>

        <td>
          <b>${esc(product.name)}</b>
        </td>

        <td>
          ${esc(product.sku || "-")}
        </td>

        <td>
          ${rupiah(product.price)}
        </td>

        <td>
          ${product.stock}
        </td>

        <td>
          ${product.is_active ? "Aktif" : "Nonaktif"}
        </td>

        <td>

          <button
            onclick="editProduct(${product.id})">
            Edit
          </button>

          <button
            class="danger"
            onclick="deleteProduct(${product.id})">
            Hapus
          </button>

        </td>

      </tr>

    `).join("");

}


function clearProductForm() {

  [
    "pid",
    "pname",
    "psku",
    "pprice",
    "pcost",
    "pstock",
    "pmin",
    "pdesc",
    "pimage"
  ].forEach(id => {

    $(id).value = "";

  });


  $("pactive").value = "true";

}


window.editProduct = function(id) {

  const product =
    products.find(
      item => item.id == id
    );

  if (!product) return;


  $("productForm").hidden = false;

  $("pid").value =
    product.id;

  $("pname").value =
    product.name;

  $("psku").value =
    product.sku || "";

  $("pprice").value =
    product.price;

  $("pcost").value =
    product.cost_price;

  $("pstock").value =
    product.stock;

  $("pmin").value =
    product.min_stock;

  $("pdesc").value =
    product.description || "";

  $("pimage").value =
    product.image_url || "";

  $("pactive").value =
    String(product.is_active);

};


async function saveProduct(event) {

  event.preventDefault();


  const id =
    $("pid").value;


  const name =
    $("pname").value.trim();


  const data = {

    name,

    sku:
      $("psku").value.trim() || null,

    description:
      $("pdesc").value.trim() || null,

    image_url:
      $("pimage").value.trim() || null,

    price:
      Number($("pprice").value),

    cost_price:
      Number($("pcost").value) || 0,

    stock:
      Number($("pstock").value) || 0,

    min_stock:
      Number($("pmin").value) || 0,

    is_active:
      $("pactive").value === "true"

  };


  let result;


  if (id) {

    result =
      await db
        .from("products")
        .update(data)
        .eq("id", id);

  } else {

    result =
      await db
        .from("products")
        .insert({
          ...data,
          slug:
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              + "-" +
              Date.now()
        });

  }


  if (result.error) {

    $("pmsg").textContent =
      "Gagal: " +
      result.error.message;

    return;

  }


  $("productForm").hidden = true;

  await loadProducts();

}


window.deleteProduct =
  async function(id) {

    if (!confirm(
      "Hapus produk ini?"
    )) return;


    const result =
      await db
        .from("products")
        .delete()
        .eq("id", id);


    if (result.error) {

      alert(result.error.message);

      return;

    }


    await loadProducts();

  };


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

  const now = new Date();
  const period = $("period").value;
  let startDate;
  if (period === "year") startDate = new Date(now.getFullYear(), 0, 1);
  else if (period === "month") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  else startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const iso = startDate.toISOString();

  const [paymentResult, refundResult, orderResult] = await Promise.all([
    db.from("payments")
      .select("amount,status,created_at")
      .gte("created_at", iso)
      .in("status", ["paid","refunded"]),

    db.from("payments")
      .select("refund_amount,refunded_at")
      .eq("refund_status","succeeded")
      .gte("refunded_at", iso),

    db.from("orders")
      .select("id,status,created_at,total_amount,discount_amount")
      .gte("created_at", iso)
      .neq("status","cancelled")
  ]);

  if (paymentResult.error || refundResult.error || orderResult.error) {
    console.error("ANALYTICS ERROR", paymentResult.error || refundResult.error || orderResult.error);
    return;
  }

  const payments = paymentResult.data || [];
  const refunds = refundResult.data || [];
  const orders = orderResult.data || [];

  const gross = payments.reduce((t,r) => t + Number(r.amount || 0), 0);
  const refundTotal = refunds.reduce((t,r) => t + Number(r.refund_amount || 0), 0);
  const net = gross - refundTotal;
  const avg = orders.length ? net / orders.length : 0;

  let items = [];
  const orderIds = orders.map(o => o.id);

  if (orderIds.length) {
    const itemResult = await db.from("order_items")
      .select("order_id,product_id,quantity,unit_price,subtotal,products(name,cost_price)")
      .in("order_id", orderIds);

    if (!itemResult.error) items = itemResult.data || [];
    else console.error("ANALYTICS ITEM ERROR", itemResult.error);
  }

  const grossProfit =
    items.reduce(
      (t,r) =>
        t +
        ((Number(r.unit_price || 0) -
          Number(r.products?.cost_price || 0)) *
          Number(r.quantity || 0)),
      0
    ) - refundTotal;

  const lowStock =
    products.filter(
      p => Number(p.stock || 0) <= Number(p.min_stock || 0)
    );

  $("sales").textContent = rupiah(net);
  $("orderCount").textContent = orders.length;
  $("refundTotal").textContent = rupiah(refundTotal);
  $("grossProfit").textContent = rupiah(grossProfit);
  $("avgOrder").textContent = rupiah(avg);
  $("lowStockCount").textContent = lowStock.length;

  const top = {};

  items.forEach(r => {
    const id = r.product_id;

    if (!top[id]) {
      top[id] = {
        name: r.products?.name || ("Produk #" + id),
        qty: 0,
        sales: 0
      };
    }

    top[id].qty += Number(r.quantity || 0);
    top[id].sales += Number(r.subtotal || 0);
  });

  const topRows =
    Object.values(top)
      .sort((a,b) => b.qty - a.qty)
      .slice(0,5);

  $("topProducts").innerHTML =
    topRows.length
      ? topRows.map((r,i) =>
          "<p><b>" + (i+1) + ". " + esc(r.name) +
          "</b><br><small>" + r.qty +
          " terjual · " + rupiah(r.sales) +
          "</small></p>"
        ).join("")
      : "<p>Belum ada penjualan.</p>";

  $("lowStockProducts").innerHTML =
    lowStock.length
      ? lowStock
          .slice()
          .sort((a,b) => Number(a.stock) - Number(b.stock))
          .slice(0,8)
          .map(p =>
            "<p><b>" + esc(p.name) +
            "</b><br><small>Stok " +
            Number(p.stock || 0) +
            " · minimum " +
            Number(p.min_stock || 0) +
            "</small></p>"
          ).join("")
      : "<p>Semua stok aman.</p>";
}

/* =========================
   ORDERS
========================= */

async function loadOrders() {
  let query = db.from("orders").select("*").order("created_at",{ascending:false}).limit(300);
  const from = $("ofrom").value, to = $("oto").value, status = $("ostatus").value;
  if (from) query=query.gte("created_at",new Date(from+"T00:00:00").toISOString());
  if (to) query=query.lt("created_at",new Date(new Date(to+"T00:00:00").getTime()+86400000).toISOString());
  if (status) query=query.eq("status",status);
  const result=await query;
  if(result.error){ $("orderRows").innerHTML=`<tr><td colspan="6">${esc(result.error.message)}</td></tr>`; return; }
  $("orderRows").innerHTML=(result.data||[]).map(order=>`<tr><td><b>${esc(order.order_number)}</b></td><td>${esc(order.user_id)}</td><td>${esc(order.status)}</td><td>${rupiah(order.total_amount)}</td><td>${new Date(order.created_at).toLocaleString("id-ID")}</td><td><button type="button" onclick="openOrderDetail(${order.id})">Detail</button></td></tr>`).join("");
}

window.openOrderDetail = async function(id) {
  const box=$("orderDetail"), body=$("orderDetailBody"); box.hidden=false; body.innerHTML="Memuat detail pesanan...";
  const {data,error}=await db.rpc("admin_order_detail",{p_order_id:id});
  if(error){body.innerHTML=`<p>${esc(error.message)}</p>`;return;}
  const order=data?.order||{}, customer=data?.customer||{}, items=data?.items||[], payments=data?.payments||[];
  const statusOptions=["pending","confirmed","processing","shipped","delivered","cancelled","refunded"].map(x=>`<option value="${x}" ${x===order.status?"selected":""}>${x}</option>`).join("");
  const itemRows=items.length?items.map(item=>`<tr><td>${esc(item.product_name||"-")}${item.sku?`<br><small>SKU: ${esc(item.sku)}</small>`:""}</td><td>${item.quantity}</td><td>${rupiah(item.unit_price)}</td><td>${rupiah(item.subtotal)}</td></tr>`).join(""):"<tr><td colspan=\"4\">Belum ada item.</td></tr>";
  const payRows=payments.length?payments.map(p=>`<tr><td>${esc(p.provider||"-")}</td><td>${esc(p.payment_method||"-")}</td><td>${esc(p.transaction_id||"-")}</td><td>${esc(p.status||"-")}</td><td>${rupiah(p.amount)}</td></tr>`).join(""):"<tr><td colspan=\"5\">Belum ada pembayaran.</td></tr>";
  body.innerHTML=`<div class="card"><h3>${esc(order.order_number||"-")}</h3><p><b>Customer:</b> ${esc(customer.full_name||"-")}</p><p><b>Email:</b> ${esc(customer.email||"-")}</p><p><b>Telepon:</b> ${esc(customer.phone||"-")}</p><p><b>Dibuat:</b> ${order.created_at?new Date(order.created_at).toLocaleString("id-ID"):"-"}</p><label><b>Status</b><select id="detailOrderStatus">${statusOptions}</select></label><button type="button" id="saveOrderStatus" style="margin-top:8px;">Simpan status</button></div><div class="table" style="margin-top:12px;"><table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${itemRows}</tbody></table></div><div class="card" style="margin-top:12px;"><p>Subtotal: <b>${rupiah(order.subtotal)}</b></p><p>Diskon: <b>${rupiah(order.discount_amount)}</b></p><p>Ongkir: <b>${rupiah(order.shipping_fee)}</b></p><p>Biaya pembayaran: <b>${rupiah(order.payment_fee)}</b></p><p>Total: <b>${rupiah(order.total_amount)}</b></p><p>Catatan: ${esc(order.customer_note||"-")}</p></div><div class="table" style="margin-top:12px;"><table><thead><tr><th>Provider</th><th>Metode</th><th>Transaksi</th><th>Status</th><th>Nominal</th></tr></thead><tbody>${payRows}</tbody></table></div>`;
  body.insertAdjacentHTML("beforeend", `
    <div class="card" style="margin-top:12px;">
      <h3>Koreksi Owner</h3>
      <label>Diskon manual (Rp)
        <input id="detailDiscount" type="number" min="0" step="1000" value="${Number(order.discount_amount||0)}">
      </label>
      <button type="button" id="saveOrderDiscount" style="margin-top:8px;">Simpan diskon</button>
      <button type="button" id="deleteOrderButton" class="danger" style="margin-top:8px;">Hapus order</button>
      <p class="note">Order yang sudah memiliki pembayaran <b>paid</b> tidak dapat dihapus.</p>
    </div>
  `);

  $("saveOrderStatus").onclick=async()=>{
    const nextStatus=$("detailOrderStatus").value;
    if(!confirm(`Ubah status pesanan menjadi "${nextStatus}"?`))return;
    const rpc=await db.rpc("admin_update_order_status",{p_order_id:id,p_status:nextStatus});
    if(rpc.error){alert(rpc.error.message);return;}
    alert(rpc.data?.message||"Status berhasil diubah.");
    await loadOrders(); await openOrderDetail(id);
  };

  $("saveOrderDiscount").onclick=async()=>{
    if(!["owner","admin"].includes(me?.role)){alert("Hanya Owner/Admin yang dapat mengubah diskon.");return;}
    const discount=Number($("detailDiscount").value||0);
    if(discount<0){alert("Diskon tidak valid.");return;}
    const rpc=await db.rpc("admin_update_order_financials",{p_order_id:id,p_discount:discount});
    if(rpc.error){alert(rpc.error.message);return;}
    alert("Diskon berhasil diterapkan. Total order diperbarui.");
    await loadOrders(); await openOrderDetail(id);
  };

  $("deleteOrderButton").onclick=async()=>{
    if(!["owner","admin"].includes(me?.role)){alert("Hanya Owner/Admin yang dapat menghapus order.");return;}
    if(!confirm("Hapus order ini? Hanya order Pending/Cancelled tanpa pembayaran Paid yang boleh dihapus."))return;
    const rpc=await db.rpc("admin_delete_order",{p_order_id:id});
    if(rpc.error){alert(rpc.error.message);return;}
    alert(rpc.data?.message||"Order berhasil dihapus.");
    $("orderDetail").hidden=true;
    await loadOrders(); await loadDashboard(); await loadPayments();
  };
};


/* =========================
   STOCK
========================= */

async function loadMovements() {

  const result =
    await db
      .from("inventory_movements")
      .select("*")
      .order(
        "created_at",
        { ascending: false }
      )
      .limit(300);


  $("moveRows").innerHTML =
    result.error
      ? `
        <tr>
          <td colspan="5">
            ${esc(result.error.message)}
          </td>
        </tr>
      `
      :
      (result.data || [])
        .map(move => {

          const product =
            products.find(
              p => p.id == move.product_id
            );


          return `

            <tr>

              <td>
                ${esc(
                  product?.name ||
                  move.product_id
                )}
              </td>

              <td>
                ${esc(move.type)}
              </td>

              <td>
                ${move.quantity}
              </td>

              <td>
                ${esc(move.note || "-")}
              </td>

              <td>
                ${new Date(
                  move.created_at
                ).toLocaleString("id-ID")}
              </td>

              <td>
                <button onclick="editMovement(${move.id})">Edit</button>
                <button class="danger" onclick="deleteMovement(${move.id})">Hapus</button>
              </td>

            </tr>

          `;

        }).join("");

}

window.editMovement = async function(id) {
  const result = await db.from("inventory_movements").select("id,type,quantity,note,product_id").eq("id", id).maybeSingle();
  if (result.error || !result.data) { alert(result.error?.message || "Pergerakan tidak ditemukan."); return; }
  const movement = result.data;
  const type = prompt("Tipe (in / out):", movement.type);
  if (type === null) return;
  const normalizedType = type.trim().toLowerCase();
  if (!["in","out"].includes(normalizedType)) { alert("Tipe harus in atau out."); return; }
  const qtyText = prompt("Jumlah:", String(movement.quantity));
  if (qtyText === null) return;
  const quantity = Number(qtyText);
  if (!Number.isInteger(quantity) || quantity <= 0) { alert("Jumlah harus bilangan bulat lebih dari 0."); return; }
  const note = prompt("Catatan:", movement.note || "");
  if (note === null) return;
  const rpc = await db.rpc("admin_update_inventory_movement", { p_id:id, p_type:normalizedType, p_quantity:quantity, p_note:note.trim() || null });
  if (rpc.error) { alert(rpc.error.message); return; }
  await loadProducts(); await loadMovements();
};

window.deleteMovement = async function(id) {
  if (!confirm("Hapus pergerakan ini? Stok produk juga akan dikoreksi otomatis.")) return;
  const rpc = await db.rpc("admin_delete_inventory_movement", { p_id:id });
  if (rpc.error) { alert(rpc.error.message); return; }
  await loadProducts(); await loadMovements();
};

async function saveMovement(event) {

  event.preventDefault();


  const productId =
    Number($("mproduct").value);

  const quantity =
    Number($("mqty").value);

  const type =
    $("mtype").value;


  const product =
    products.find(
      p => p.id == productId
    );


  if (!product) return;


  const newStock =
    product.stock +
    (
      type === "in"
        ? quantity
        : type === "out"
          ? -quantity
          : quantity
    );


  if (newStock < 0) {

    $("mmsg").textContent =
      "Stok tidak boleh minus.";

    return;

  }


  const movement =
    await db
      .from("inventory_movements")
      .insert({

        product_id:
          productId,

        type,

        quantity,

        note:
          $("mnote").value.trim()
          || null,

        created_by:
          user.id

      });


  if (movement.error) {

    $("mmsg").textContent =
      movement.error.message;

    return;

  }


  const update =
    await db
      .from("products")
      .update({
        stock: newStock
      })
      .eq(
        "id",
        productId
      );


  if (update.error) {

    $("mmsg").textContent =
      update.error.message;

    return;

  }


  $("moveForm").hidden = true;

  await loadProducts();
  await loadMovements();

}


/* =========================
   CUSTOMER
========================= */

async function loadCustomers() {

  const { data, error } = await db.rpc("admin_list_customers");

const result = {
  data: data || [],
  error
};


  const search =
    $("customerSearch")
      .value
      .toLowerCase();


  const rows =
    (result.data || [])
      .filter(customer => {

        const text = `
          ${customer.full_name || ""}
          ${customer.email || ""}
          ${customer.phone || ""}
          ${customer.id}
        `.toLowerCase();

        return text.includes(search);

      });


  $("customerRows").innerHTML =
    result.error
      ? `
        <tr>
          <td colspan="5">
            ${esc(result.error.message)}
          </td>
        </tr>
      `
      :
      rows.map(customer => `

        <tr>

          <td>
            ${esc(
              customer.full_name || "-"
            )}
          </td>

          <td>
            ${esc(
              customer.email || "-"
            )}
          </td>

          <td>
            ${esc(
              customer.phone || "-"
            )}
          </td>

          <td>
            ${esc(customer.role)}
          </td>

          <td>
            ${customer.is_active
              ? "Ya"
              : "Tidak"}
          </td>

          <td>
            ${new Date(
              customer.created_at
            ).toLocaleDateString(
              "id-ID"
            )}
          </td>

          <td>
            <button class="danger" onclick="deleteCustomer('${customer.id}')">Hapus</button>
          </td>

        </tr>

      `).join("");

}
window.deleteCustomer = async function(id) {
  if (!confirm("Hapus customer ini? Jika punya riwayat pesanan, akun akan DINONAKTIFKAN dan akses login diblokir agar histori transaksi tetap aman.")) return;
  const { data, error } = await db.rpc("admin_delete_customer", {
  p_user_id: id
});
  if (error) { alert(error.message || "Gagal memproses customer."); return; }
  if (data?.error) { alert(data.error); return; }
  alert(data?.message || "Berhasil.");
  await loadCustomers();
};


/* =========================
   PAYMENTS
========================= */

function setupPaymentRealtime() {
  if (paymentRealtimeChannel) {
    db.removeChannel(paymentRealtimeChannel);
    paymentRealtimeChannel = null;
  }

  paymentRealtimeChannel = db
    .channel("owner-payment-realtime")
    .on("postgres_changes", { event:"*", schema:"public", table:"payments" }, async () => {
      await loadPayments();
      await loadDashboard();
    })
    .subscribe();
}

async function loadPayments() {

  let query = db.from("payments").select("*").limit(500);
  const period = $("payPeriod").value;
  const now = new Date();
  let start = null;

  if (period === "today") start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") start = new Date(now.getFullYear(), 0, 1);
  if (start) query = query.gte("created_at", start.toISOString());

  const result = await query;
  let rows = result.data || [];
  const sort = $("paySort").value;

  if (sort === "az") rows.sort((a,b) => String(a.transaction_id || "").localeCompare(String(b.transaction_id || "")));
  if (sort === "date_asc") rows.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === "date_desc") rows.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === "amount_desc") rows.sort((a,b) => Number(b.amount) - Number(a.amount));

  $("payRows").innerHTML = result.error
    ? "<tr><td colspan=\"7\">" + esc(result.error.message) + "</td></tr>"
    : rows.map(payment => {
        const refundLabel = payment.refund_status === "succeeded" ? "Refund berhasil" :
          payment.refund_status === "pending" ? "Refund diproses" :
          payment.refund_status === "requested" ? "Menunggu Owner" :
          payment.refund_status === "failed" ? "Refund otomatis gagal" : "-";
        const canRefund = payment.status === "paid" && ["none","requested","failed"].includes(payment.refund_status);
        const canManualRefund = payment.status === "paid" && payment.refund_status === "failed" && ["owner","admin"].includes(me?.role);
        let action = "-";
        if (canManualRefund) {
          action = "<button type=\"button\" onclick=\"confirmManualRefund(" + Number(payment.id) + "," + Number(payment.order_id) + ")\" >Refund Manual</button>";
        } else if (canRefund) {
          action = "<button type=\"button\" onclick=\"processPaymentRefund(" + Number(payment.order_id) + ")\" >" +
            (payment.refund_status === "requested" ? "Proses Refund" : "Refund") + "</button>";
        }
        return "<tr>" +
          "<td>" + esc(payment.transaction_id || "-") + "</td>" +
          "<td>" + payment.order_id + "</td>" +
          "<td>" + esc(payment.payment_method || "-") + "</td>" +
          "<td>" + esc(payment.status) + (payment.refund_status && payment.refund_status !== "none" ? "<br><small>" + esc(refundLabel) + "</small>" : "") + "</td>" +
          "<td>" + rupiah(payment.amount) + "</td>" +
          "<td>" + new Date(payment.created_at).toLocaleString("id-ID") + "</td>" +
          "<td>" + action + "</td>" +
          "</tr>";
      }).join("");
}

async function processPaymentRefund(orderId) {
  if (!user) return;

  const payment = await db.from("payments")
    .select("refund_status,refund_reason")
    .eq("order_id", Number(orderId))
    .order("id", { ascending:false })
    .limit(1)
    .maybeSingle();

  const reason = payment.data?.refund_reason || "CANCELLATION";
  if (!confirm("Proses FULL REFUND untuk order #" + orderId + "?\n\nDana akan dikembalikan melalui Xendit ke metode pembayaran asal.")) return;

  try {
    const session = await db.auth.getSession();
    const accessToken = session?.data?.session?.access_token;
    if (!accessToken) throw new Error("Sesi login sudah berakhir.");

    const response = await fetch(SUPABASE_URL + "/functions/v1/payment-refund", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
      body: JSON.stringify({ order_id:Number(orderId), action:"execute", reason })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const code = result.xendit_error_code ? " [" + result.xendit_error_code + "]" : "";
      const detail = result.detail?.message ? " — " + result.detail.message : "";
      throw new Error((result.error || "Refund gagal diproses.") + code + detail);
    }

    alert(result.status === "succeeded" ? "Refund berhasil diproses." : "Refund sudah dikirim ke Xendit. Menunggu konfirmasi webhook.");
    await loadPayments();
    await loadDashboard();
  } catch (error) {
    alert("Refund gagal: " + error.message);
  }
}

window.confirmManualRefund = async function(paymentId, orderId) {
  if (!user || !["owner","admin"].includes(me?.role)) {
    alert("Akses ditolak. Refund manual hanya untuk Owner/Admin.");
    return;
  }

  const payment = await db.from("payments")
    .select("id,order_id,amount,status,refund_status,refund_reason,payment_method,payment_bank_code,payment_ewallet_code")
    .eq("id", Number(paymentId))
    .maybeSingle();

  if (payment.error) {
    alert("Gagal membaca pembayaran: " + payment.error.message);
    return;
  }

  if (!payment.data || payment.data.status !== "paid" || payment.data.refund_status !== "failed") {
    alert("Refund manual hanya tersedia setelah refund otomatis gagal.");
    return;
  }

  const reason = prompt(
    "Konfirmasi REFUND MANUAL untuk order #" + orderId + "\n\n" +
    "Nominal: " + rupiah(payment.data.amount) + "\n" +
    "Metode: " + (payment.data.payment_method || "-") + "\n\n" +
    "Pastikan dana SUDAH benar-benar dikembalikan ke customer.\n" +
    "Masukkan alasan/catatan refund:"
  );

  if (reason === null) return;
  const finalReason = reason.trim() || "MANUAL_REFUND";

  if (!confirm(
    "Yakin konfirmasi refund manual?\n\n" +
    "Order #" + orderId + "\n" +
    "Nominal: " + rupiah(payment.data.amount) + "\n\n" +
    "Setelah dikonfirmasi, status pembayaran dan order akan menjadi REFUNDED."
  )) return;

  const result = await db.rpc("admin_confirm_manual_refund", {
    p_payment_id: Number(paymentId),
    p_reason: finalReason
  });

  if (result.error) {
    alert("Refund manual gagal: " + result.error.message);
    return;
  }

  alert(
    "Refund manual berhasil dikonfirmasi.\n\n" +
    "Order #" + orderId + " → REFUNDED\n" +
    "Nominal: " + rupiah(payment.data.amount)
  );

  await loadPayments();
  await loadDashboard();
  await loadOrders();
}

/* =========================
   SHIFT
========================= */

async function loadShifts() {

  const result =
    await db
      .from("shifts")
      .select("*")
      .order(
        "opened_at",
        { ascending: false }
      )
      .limit(200);


  if (result.error) {

    $("currentShift").textContent =
      result.error.message;

    return;

  }


  const rows =
    result.data || [];


  shift =
    rows.find(
      row => row.status === "open"
    ) || null;


  $("currentShift").innerHTML =
    shift
      ? `
        <b>SHIFT AKTIF</b>
        <br>
        Dibuka:
        ${new Date(
          shift.opened_at
        ).toLocaleString("id-ID")}
        <br>
        Order:
        ${shift.total_orders}
        · Penjualan:
        ${rupiah(shift.total_sales)}
      `
      :
      "Tidak ada shift aktif.";


  $("shiftRows").innerHTML =
    rows
      .filter(
        row =>
          row.status === "closed"
      )
      .map(row => `

        <tr>

          <td>
            ${new Date(
              row.opened_at
            ).toLocaleString("id-ID")}
          </td>

          <td>
            ${
              row.closed_at
                ? new Date(
                    row.closed_at
                  ).toLocaleString(
                    "id-ID"
                  )
                : "-"
            }
          </td>

          <td>
            ${row.total_orders}
          </td>

          <td>
            ${rupiah(
              row.total_sales
            )}
          </td>

          <td>
            ${rupiah(
              row.total_discount
            )}
          </td>

          <td>

            <button
              onclick="editShift(${row.id})">
              Edit
            </button>

            <button
              class="danger"
              onclick="deleteShift(${row.id})">
              Hapus
            </button>

          </td>

        </tr>

      `).join("");

}


async function openShift() {

  if (shift) {

    alert(
      "Sudah ada shift aktif."
    );

    return;

  }


  const openingStock =
    products.reduce(
      (total, product) =>
        total +
        Number(product.stock || 0),
      0
    );


  const result =
    await db
      .from("shifts")
      .insert({

        opened_by:
          user.id,

        status:
          "open",

        opening_stock:
          openingStock

      });


  if (result.error) {

    alert(
      result.error.message
    );

    return;

  }


  await loadShifts();

}


async function closeShift() {

  if (!shift) {

    alert(
      "Tidak ada shift aktif."
    );

    return;

  }


  const result =
    await db
      .from("orders")
      .select(
        "id,total_amount,discount_amount,shipping_fee,status"
      )
      .gte(
        "created_at",
        shift.opened_at
      )
      .neq(
        "status",
        "cancelled"
      );


  if (result.error) {

    alert(
      result.error.message
    );

    return;

  }


  const rows =
    result.data || [];


  const sales =
    rows.reduce(
      (total, row) =>
        total +
        Number(
          row.total_amount || 0
        ),
      0
    );


  const discount =
    rows.reduce(
      (total, row) =>
        total +
        Number(
          row.discount_amount || 0
        ),
      0
    );


  const shipping =
    rows.reduce(
      (total, row) =>
        total +
        Number(
          row.shipping_fee || 0
        ),
      0
    );


  const closingStock =
    products.reduce(
      (total, product) =>
        total +
        Number(product.stock || 0),
      0
    );


  const update =
    await db
      .from("shifts")
      .update({

        closed_by:
          user.id,

        closed_at:
          new Date().toISOString(),

        status:
          "closed",

        closing_stock:
          closingStock,

        total_orders:
          rows.length,

        total_sales:
          sales,

        total_discount:
          discount,

        total_shipping:
          shipping

      })
      .eq(
        "id",
        shift.id
      );


  if (update.error) {

    alert(
      update.error.message
    );

    return;

  }


  await loadShifts();

}


window.editShift =
  async function(id) {

    const note =
      prompt(
        "Catatan koreksi shift:"
      );


    if (note === null) return;


    const result =
      await db
        .from("shifts")
        .update({
          notes: note
        })
        .eq(
          "id",
          id
        );


    if (result.error) {

      alert(
        result.error.message
      );

      return;

    }


    await loadShifts();

  };


window.deleteShift =
  async function(id) {

    if (!confirm(
      "Hapus riwayat shift ini?"
    )) return;


    const result =
      await db
        .from("shifts")
        .delete()
        .eq(
          "id",
          id
        );


    if (result.error) {

      alert(
        result.error.message
      );

      return;

    }


    await loadShifts();

  };


/* =========================
   PROMOS
========================= */

function clearPromoForm() {
  ["promoId","promoCode","promoValue","promoMin","promoMax","promoLimit","promoStart","promoEnd"].forEach(id => { $(id).value = ""; });
  $("promoPerUser").value = "1"; $("promoType").value = "percent"; $("promoActive").value = "true"; $("promoMsg").textContent = "";
}

function toLocalInput(value) { if (!value) return ""; const d=new Date(value); const pad=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()); }

async function loadPromos() {
  const r=await db.from("promo_codes").select("*").order("id",{ascending:false});
  if(r.error){ $("promoRows").innerHTML='<tr><td colspan="7">'+esc(r.error.message)+'</td></tr>'; return; }
  $("promoRows").innerHTML=(r.data||[]).map(p=>{
    const discount=p.discount_type==="percent" ? esc(p.discount_value)+"%" : rupiah(p.discount_value);
    const period=(p.starts_at?new Date(p.starts_at).toLocaleString("id-ID"):"-")+" s/d "+(p.ends_at?new Date(p.ends_at).toLocaleString("id-ID"):"-");
    return '<tr><td><b>'+esc(p.code)+'</b></td><td>'+discount+'</td><td>'+rupiah(p.min_subtotal)+'</td><td>'+p.used_count+(p.usage_limit?"/"+p.usage_limit:"")+'</td><td>'+period+'</td><td>'+ (p.is_active?"Aktif":"Nonaktif") +'</td><td><button onclick="editPromo('+p.id+')">Edit</button> <button class="danger" onclick="deletePromo('+p.id+')">Hapus</button></td></tr>';
  }).join("");
}

window.editPromo=async function(id){ const r=await db.from("promo_codes").select("*").eq("id",id).single(); if(r.error)return alert(r.error.message); const p=r.data; $("promoForm").hidden=false; $("promoId").value=p.id; $("promoCode").value=p.code; $("promoType").value=p.discount_type; $("promoValue").value=p.discount_value; $("promoMin").value=p.min_subtotal; $("promoMax").value=p.max_discount??""; $("promoLimit").value=p.usage_limit??""; $("promoPerUser").value=p.per_user_limit; $("promoStart").value=toLocalInput(p.starts_at); $("promoEnd").value=toLocalInput(p.ends_at); $("promoActive").value=String(p.is_active); };

async function savePromo(e){ e.preventDefault(); const id=$("promoId").value; const data={code:$("promoCode").value.trim().toUpperCase(),discount_type:$("promoType").value,discount_value:Number($("promoValue").value),min_subtotal:Number($("promoMin").value)||0,max_discount:$("promoMax").value?Number($("promoMax").value):null,usage_limit:$("promoLimit").value?Number($("promoLimit").value):null,per_user_limit:Number($("promoPerUser").value)||1,starts_at:$("promoStart").value?new Date($("promoStart").value).toISOString():null,ends_at:$("promoEnd").value?new Date($("promoEnd").value).toISOString():null,is_active:$("promoActive").value==="true",updated_at:new Date().toISOString()}; const r=id?await db.from("promo_codes").update(data).eq("id",id):await db.from("promo_codes").insert(data); if(r.error){$("promoMsg").textContent="Gagal: "+r.error.message;return;} $("promoForm").hidden=true; await loadPromos(); }

window.deletePromo=async function(id){ if(!confirm("Hapus kode promo ini?"))return; const r=await db.from("promo_codes").delete().eq("id",id); if(r.error)return alert(r.error.message); await loadPromos(); };


/* =========================
   SETTINGS
========================= */

async function loadSettings() {

  const result =
    await db
      .from("business_settings")
      .select("*")
      .eq(
        "setting_key",
        "store"
      )
      .maybeSingle();


  if (result.error) return;


  const value =
    result.data?.setting_value || {};


  $("sname").value =
    value.name || "";

  $("sphone").value =
    value.phone || "";

  $("saddress").value =
    value.address || "";

  $("sage").value =
    value.age || 21;

  $("smode").value =
    value.mode || "open";

  const shippingResult = await db
    .from("business_settings")
    .select("setting_value")
    .eq("setting_key","shipping")
    .maybeSingle();

  const shipping = shippingResult.data?.setting_value || {};
  $("storeLat").value = shipping.store_lat ?? "";
  $("storeLng").value = shipping.store_lng ?? "";

}


async function saveSettings(event) {

  event.preventDefault();


  const value = {

    name:
      $("sname").value.trim(),

    phone:
      $("sphone").value.trim(),

    address:
      $("saddress").value.trim(),

    age:
      Number(
        $("sage").value
      ) || 21,

    mode:
      $("smode").value

  };

  const shippingValue = {
    store_lat: $("storeLat").value ? Number($("storeLat").value) : null,
    store_lng: $("storeLng").value ? Number($("storeLng").value) : null,
    tiers: [
      { max_km: 3, fee: 5000 },
      { max_km: 7, fee: 8000 },
      { max_km: 12, fee: 12000 },
      { max_km: 20, fee: 18000 }
    ],
    unavailable_above_km: 20
  };

  if ((shippingValue.store_lat === null) !== (shippingValue.store_lng === null)) {
    $("smsg").textContent = "Latitude dan longitude toko harus diisi bersama.";
    return;
  }

  const shippingSave = await db.from("business_settings").upsert({
    setting_key:"shipping",
    setting_value:shippingValue,
    updated_by:user.id
  },{onConflict:"setting_key"});

  if (shippingSave.error) {
    $("smsg").textContent = "Gagal menyimpan ongkir: " + shippingSave.error.message;
    return;
  }


  const result =
    await db
      .from("business_settings")
      .upsert(
        {
          setting_key: "store",
          setting_value: value,
          updated_by: user.id
        },
        {
          onConflict:
            "setting_key"
        }
      );


  $("smsg").textContent =
    result.error
      ? "Gagal: " +
        result.error.message
      : "Pengaturan tersimpan.";

}


async function resetTestOrders() {
  if (me?.role !== "owner") {
    alert("Akses ditolak. Fitur ini hanya untuk Owner.");
    return;
  }

  const first = confirm(
    "⚠️ RESET DATA PESANAN TESTING\\n\\n" +
    "Semua order dan data transaksi lokal terkait akan dihapus. " +
    "Produk, customer, stok, akun, pengaturan toko, dan transaksi eksternal Xendit tidak dihapus.\\n\\n" +
    "Lanjutkan?"
  );

  if (!first) return;

  const phrase = prompt(
    'Konfirmasi akhir: ketik "RESET PESANAN" untuk melanjutkan.'
  );

  if (phrase !== "RESET PESANAN") {
    alert("Reset dibatalkan. Teks konfirmasi tidak cocok.");
    return;
  }

  const button = $("resetTestOrdersButton");
  const msg = $("resetOrdersMsg");
  button.disabled = true;
  msg.textContent = "Memproses reset...";

  try {
    const { data, error } = await db.rpc("owner_reset_test_orders");

    if (error) throw error;

    msg.textContent =
      "Reset berhasil. " +
      (data?.orders_deleted ?? 0) +
      " pesanan dihapus. Dashboard akan dimuat ulang.";

    await Promise.all([
      loadDashboard(),
      loadOrders(),
      loadPayments(),
      loadPromos()
    ]);

    msg.textContent =
      "✅ Reset berhasil. " +
      (data?.orders_deleted ?? 0) +
      " pesanan, " +
      (data?.payments_deleted ?? 0) +
      " pembayaran, dan " +
      (data?.promo_redemptions_deleted ?? 0) +
      " redemption promo dibersihkan.";
  } catch (error) {
    console.error("RESET TEST ORDERS ERROR:", error);
    msg.textContent =
      "❌ Reset gagal: " + (error?.message || "Terjadi kesalahan.");
  } finally {
    button.disabled = false;
  }
}


/* =========================
   RUN
========================= */

start();
