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


    await loadProducts();
    await loadDashboard();
    await loadOrders();
    await loadCustomers();
    await loadPayments();
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


  $("openShift").onclick =
    openShift;


  $("closeShift").onclick =
    closeShift;


  $("settingsForm").onsubmit =
    saveSettings;

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

  const period =
    $("period").value;


  let start;


  if (period === "year") {

    start =
      new Date(
        now.getFullYear(),
        0,
        1
      );

  } else if (period === "month") {

    start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

  } else {

    start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

  }


  const result =
    await db
      .from("orders")
      .select(
        "id,total_amount,status,created_at"
      )
      .gte(
        "created_at",
        start.toISOString()
      )
      .neq(
        "status",
        "cancelled"
      );


  if (result.error) return;


  const rows =
    result.data || [];


  $("sales").textContent =
    rupiah(
      rows.reduce(
        (total, row) =>
          total +
          Number(row.total_amount || 0),
        0
      )
    );


  $("orderCount").textContent =
    rows.length;

}


/* =========================
   ORDERS
========================= */

async function loadOrders() {

  let query =
    db
      .from("orders")
      .select("*")
      .order(
        "created_at",
        { ascending: false }
      )
      .limit(300);


  const from =
    $("ofrom").value;

  const to =
    $("oto").value;

  const status =
    $("ostatus").value;


  if (from) {

    query =
      query.gte(
        "created_at",
        new Date(
          from + "T00:00:00"
        ).toISOString()
      );

  }


  if (to) {

    query =
      query.lt(
        "created_at",
        new Date(
          new Date(
            to + "T00:00:00"
          ).getTime() +
          86400000
        ).toISOString()
      );

  }


  if (status) {

    query =
      query.eq(
        "status",
        status
      );

  }


  const result =
    await query;


  $("orderRows").innerHTML =
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
        .map(order => `

          <tr>

            <td>
              ${esc(order.order_number)}
            </td>

            <td>
              ${esc(order.user_id)}
            </td>

            <td>
              ${esc(order.status)}
            </td>

            <td>
              ${rupiah(order.total_amount)}
            </td>

            <td>
              ${new Date(
                order.created_at
              ).toLocaleString("id-ID")}
            </td>

          </tr>

        `).join("");

}


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

  const { data, error } = await db.functions.invoke("admin-customers", {
    body: { action: "list" }
  });

  const result = {
    data: data?.customers || [],
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
  const { data, error } = await db.functions.invoke("admin-customers", { body: { action:"delete", user_id:id } });
  if (error) { alert(error.message || "Gagal memproses customer."); return; }
  if (data?.error) { alert(data.error); return; }
  alert(data?.message || "Berhasil.");
  await loadCustomers();
};


/* =========================
   PAYMENTS
========================= */

async function loadPayments() {

  let query =
    db
      .from("payments")
      .select("*")
      .limit(500);


  const period =
    $("payPeriod").value;

  const now =
    new Date();


  let start = null;


  if (period === "today") {

    start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

  }


  if (period === "month") {

    start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

  }


  if (period === "year") {

    start =
      new Date(
        now.getFullYear(),
        0,
        1
      );

  }


  if (start) {

    query =
      query.gte(
        "created_at",
        start.toISOString()
      );

  }


  const result =
    await query;


  let rows =
    result.data || [];


  const sort =
    $("paySort").value;


  if (sort === "az") {

    rows.sort(
      (a, b) =>
        String(
          a.transaction_id || ""
        ).localeCompare(
          String(
            b.transaction_id || ""
          )
        )
    );

  }


  if (sort === "date_asc") {

    rows.sort(
      (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at)
    );

  }


  if (sort === "date_desc") {

    rows.sort(
      (a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at)
    );

  }


  if (sort === "amount_desc") {

    rows.sort(
      (a, b) =>
        Number(b.amount) -
        Number(a.amount)
    );

  }


  $("payRows").innerHTML =
    result.error
      ? `
        <tr>
          <td colspan="6">
            ${esc(result.error.message)}
          </td>
        </tr>
      `
      :
      rows.map(payment => `

        <tr>

          <td>
            ${esc(
              payment.transaction_id || "-"
            )}
          </td>

          <td>
            ${payment.order_id}
          </td>

          <td>
            ${esc(
              payment.payment_method || "-"
            )}
          </td>

          <td>
            ${esc(payment.status)}
          </td>

          <td>
            ${rupiah(payment.amount)}
          </td>

          <td>
            ${new Date(
              payment.created_at
            ).toLocaleString(
              "id-ID"
            )}
          </td>

        </tr>

      `).join("");

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


/* =========================
   RUN
========================= */

start();
